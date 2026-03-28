# Cycles de Vie des Documents — JBESION

## Acteurs et Rôles

| Acteur | Rôle dans le système |
|--------|---------------------|
| **Collaborateur** (Employee) | Crée les fiches de besoin, soumet les demandes |
| **Supérieur Hiérarchique** (Manager) | Premier niveau de validation, voit les fiches de ses subordonnés |
| **DAF** (Dir. Administratif & Financier) | Valide les besoins internes, gère les proformas, approuve les bons |
| **DG** (Directeur Général) | Autorité finale sur toutes les approbations |
| **Comptable** (AF Department) | Crée les bons de commande/paiement, exécute les fiches approuvées |
| **RH** (is_rh) | Crée et gère les fiches mission |
| **Agent de Liaison** (is_agent_liaison) | Exécute les missions terrain, déclare ses absences |
| **Admin** | Accès total, substitut possible pour toute validation |

---

## 1. Fiche de Besoin Interne

> Demande d'achat ou de prestation émanant d'un collaborateur interne.

```
[Collaborateur]         [Manager]           [DAF]               [DG]            [Comptable]
     |                      |                  |                   |                  |
  BROUILLON                 |                  |                   |                  |
     | soumet                |                  |                   |                  |
  EN ATTENTE MANAGER ------->|                  |                   |                  |
     |              approuve |                  |                   |                  |
     |              <clarifie|                  |                   |                  |
     |                       | EN ATTENTE DAF -->|                   |                  |
     |                       |          approuve |                   |                  |
     |                       |          <clarifie|                   |                  |
     |                       |                   | EN ATTENTE DG --->|                  |
     |                       |                   |           approuve|                  |
     |                       |                   |                   | APPROUVÉE        |
     |                       |                   |                   |      exécute---->|
     |                       |                   |                   |            EN COURS D'EXÉCUTION
     |                       |                   |                   |                  | réceptionne
     |                       |                   |                   |                  | LIVRÉE
     |
     +--> REJETÉE (à n'importe quelle étape)
```

| Statut | Qui agit | Action possible |
|--------|----------|-----------------|
| `BROUILLON` | Collaborateur | Modifier, Soumettre |
| `EN ATTENTE MANAGER` | Manager | Approuver, Rejeter, Demander clarification |
| `CLARIFICATION (DAF)` | Manager | Répondre à la clarification du DAF |
| `EN ATTENTE DAF` | DAF | Approuver, Rejeter, Demander clarification |
| `CLARIFICATION (DG)` | Manager | Répondre à la clarification du DG |
| `EN ATTENTE DG` | DG (ou DAF par délégation) | Approuver, Rejeter |
| `APPROUVÉE` | Comptable / DAF | Exécuter (déclenche bon de commande) |
| `EN COURS D'EXÉCUTION` | Comptable | Marquer comme livrée |
| `LIVRÉE` | — | État final |
| `REJETÉE` | — | État final |

---

## 2. Fiche de Besoin Externe

> Demande liée à un partenaire ou prestataire externe. Pas d'étape DAF.

```
[Collaborateur]         [Manager]               [DG]            [Comptable]
     |                      |                     |                  |
  BROUILLON                 |                     |                  |
     | soumet                |                     |                  |
  EN ATTENTE MANAGER ------->|                     |                  |
     |              approuve |                     |                  |
     |              <clarifie|                     |                  |
     |                       | EN ATTENTE DG ------>|                  |
     |                       |               approuve|                 |
     |                       |                      | APPROUVÉE        |
     |                       |                      |      exécute---->|
     |                       |                      |            EN COURS D'EXÉCUTION
     |                       |                      |                  | LIVRÉE
     |
     +--> REJETÉE (à n'importe quelle étape)
```

Meme logique que la fiche interne, **sans l'étape DAF**. Les items incluent un champ `affectation` et une distinction `montant_prestataire` / `montant_client`.

---

## 3. Bon de Commande

> Document financier officialisant l'achat auprès d'un fournisseur. Créé par le comptable, souvent lié à une fiche approuvée.

```
[Comptable]         [Comptable/DAF]         [DAF]               [DG]            [Comptable]
     |                      |                  |                   |                  |
  BROUILLON                 |                  |                   |                  |
     | soumet                |                  |                   |                  |
  EN ATTENTE PROFORMAS ----->|                  |                   |                  |
     |         upload        |                  |                   |                  |
     |         proformas     |                  |                   |                  |
     |                       | EN ATTENTE DAF -->|                   |                  |
     |                       |  sélectionne      |                   |                  |
     |                       |  fournisseur      |                   |                  |
     |                       |  approuve ------->| EN ATTENTE DG --->|                  |
     |                       |                   |           approuve|                  |
     |                       |                   |                   | APPROUVÉ         |
     |                       |                   |                   |      exécute---->|
     |                       |                   |                   |            EN COURS D'EXÉCUTION
     |                       |                   |                   |                  | clôture
     |                       |                   |                   |                  | EXÉCUTÉ / CLÔTURÉ
     |
     +--> REJETÉ (à n'importe quelle étape)
```

| Statut | Qui agit | Action possible |
|--------|----------|-----------------|
| `BROUILLON` | Comptable | Modifier, Soumettre |
| `EN ATTENTE PROFORMAS` | Comptable / DAF | Uploader proformas fournisseurs |
| `EN ATTENTE DAF` | DAF | Valider proformas, choisir fournisseur, Approuver |
| `EN ATTENTE DG` | DG | Approuver, Rejeter |
| `APPROUVÉ` | Comptable | Lancer l'exécution |
| `EN COURS D'EXÉCUTION` | Comptable | Clôturer |
| `EXÉCUTÉ / CLÔTURÉ` | — | État final |
| `REJETÉ` | — | État final |

---

## 4. Bon de Paiement

> Bon autorisant un décaissement. Créé et géré par le département AF (Comptable / DAF).

```
[Comptable / DAF]           [Comptable / DAF]
        |                          |
    BROUILLON                      |
        | valide                   |
    VALIDÉ ---------------------------> État final
        |
        +--> ANNULÉ (si erreur)
```

| Statut | Qui agit | Action possible |
|--------|----------|-----------------|
| `BROUILLON` | Comptable / DAF | Modifier, Valider |
| `VALIDÉ` | Comptable / DAF | Annuler si nécessaire |
| `ANNULÉ` | — | État final |

Champs clés : bénéficiaire, motif, mode de paiement (`ESPÈCE` ou `CHÈQUE`), montant en chiffres et en lettres.
Peut être lié à une fiche interne ou externe.

---

## 5. Fiche Mission

> Autorisation et suivi des frais de déplacement pour un collaborateur ou prestataire.

```
[RH / Collaborateur]   [Manager]           [DAF]               [DG]        [Agent Liaison]
     |                      |                  |                   |               |
  BROUILLON                 |                  |                   |               |
     | soumet                |                  |                   |               |
  EN ATTENTE MANAGER ------->|                  |                   |               |
     |              approuve |                  |                   |               |
  EN ATTENTE DAF ----------->|                  |                   |               |
     |                       |        approuve  |                   |               |
  EN ATTENTE DG -------------------------------------->|            |               |
     |                       |                  |        approuve   |               |
  APPROUVÉE -------------------------------------------------------->|               |
     |                       |                  |                   |   EN COURS --->|
     |                       |                  |                   |               | TERMINÉE
     |
     +--> REJETÉE (à n'importe quelle étape)
```

| Statut | Qui agit | Action possible |
|--------|----------|-----------------|
| `BROUILLON` | RH / Créateur | Modifier, Soumettre |
| `EN ATTENTE MANAGER` | Manager / DAF / DG / RH | Approuver, Rejeter |
| `EN ATTENTE DAF` | DAF / Admin / RH | Approuver, Rejeter |
| `EN ATTENTE DG` | DG / Admin / RH | Approuver, Rejeter |
| `APPROUVÉE` | — | Passage en cours automatique ou manuel |
| `EN COURS` | Agent de liaison | Exécution terrain |
| `TERMINÉE` | — | État final |
| `REJETÉE` | — | État final |

Frais couverts : hébergement, restauration, transport aller-retour, autres frais.

---

## Synthèse des Rôles par Document

| Document | Collaborateur | Manager | DAF | DG | Comptable / AF | RH | Agent Liaison |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Fiche Interne** | Crée | Valide (1er) | Valide (2e) | Valide (final) | Exécute | — | — |
| **Fiche Externe** | Crée | Valide (1er) | — | Valide (final) | Exécute | — | — |
| **Bon de Commande** | — | — | Proformas + Validation | Approuve | Crée + Exécute | — | — |
| **Bon de Paiement** | — | — | Crée / Valide | — | Crée / Valide | — | — |
| **Fiche Mission** | Crée | Valide (1er) | Valide (2e) | Valide (final) | — | Crée / Gère | Exécute terrain |

---

## Notifications

À chaque changement de statut, les acteurs suivants sont automatiquement notifiés :
- Le **prochain approbateur** concerné par l'action
- Tous les **Admins** du système
- Tous les **DG** du système
- Tous les **DAF** du système

Types de notifications : soumission, avis favorable, approbation, rejet, demande/réponse clarification, en cours d'exécution, livré, bon émis/validé/annulé.
