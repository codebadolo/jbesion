export const STATUS_LABELS = {
  DRAFT: 'Brouillon',
  PENDING_MANAGER: 'En attente Supérieur Hiérarchique',
  PENDING_DAF: 'En attente DAF',
  PENDING_DIRECTOR: 'En attente DG',
  PENDING_CLARIFICATION_DAF: 'Clarification demandée (DAF)',
  PENDING_CLARIFICATION_DIR: 'Clarification demandée (DG)',
  APPROVED: 'Approuvée',
  REJECTED: 'Rejetée',
  IN_EXECUTION: "En cours d'exécution",
  DELIVERED: 'Livrée / Réceptionnée',
}

export const ROLE_LABELS = {
  EMPLOYEE: 'Collaborateur',
  MANAGER: 'Supérieur Hiérarchique',
  DAF: 'DAF',
  DIRECTOR: 'DG',
  ADMIN: 'Administrateur',
}

export const STATUS_COLORS = {
  DRAFT: 'gray',
  PENDING_MANAGER: 'yellow',
  PENDING_DAF: 'orange',
  PENDING_DIRECTOR: 'blue',
  PENDING_CLARIFICATION_DAF: 'amber',
  PENDING_CLARIFICATION_DIR: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
  IN_EXECUTION: 'purple',
  DELIVERED: 'teal',
}

export const FICHE_TYPES = {
  INTERNE: 'interne',
  EXTERNE: 'externe',
}

export const VALIDATION_ACTIONS = {
  APPROVE: 'approve',
  REJECT: 'reject',
  REQUEST_CLARIFICATION: 'request_clarification',
}

// Which roles can validate (approve/reject/request_clarification) at each stage
export const VALIDATION_ROLES = {
  PENDING_MANAGER: 'MANAGER',
  PENDING_DAF: 'DAF',
  PENDING_DIRECTOR: 'DIRECTOR',
}

// Manager responds to clarification at these statuses
export const CLARIFICATION_STATUSES = [
  'PENDING_CLARIFICATION_DAF',
  'PENDING_CLARIFICATION_DIR',
]
