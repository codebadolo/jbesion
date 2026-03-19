export const STATUS_LABELS = {
  DRAFT: 'Brouillon',
  PENDING_MANAGER: 'En attente Manager',
  PENDING_DAF: 'En attente DAF',
  PENDING_DIRECTOR: 'En attente Directeur',
  APPROVED: 'Approuvé',
  REJECTED: 'Rejeté',
}

export const ROLE_LABELS = {
  EMPLOYEE: 'Employé',
  MANAGER: 'Manager',
  DAF: 'DAF',
  DIRECTOR: 'Directeur',
  ADMIN: 'Administrateur',
}

export const STATUS_COLORS = {
  DRAFT: 'gray',
  PENDING_MANAGER: 'yellow',
  PENDING_DAF: 'orange',
  PENDING_DIRECTOR: 'blue',
  APPROVED: 'green',
  REJECTED: 'red',
}

export const FICHE_TYPES = {
  INTERNE: 'interne',
  EXTERNE: 'externe',
}

export const VALIDATION_ACTIONS = {
  APPROVE: 'approve',
  REJECT: 'reject',
}

// Which roles can validate at which stage
export const VALIDATION_ROLES = {
  PENDING_MANAGER: 'MANAGER',
  PENDING_DAF: 'DAF',
  PENDING_DIRECTOR: 'DIRECTOR',
}
