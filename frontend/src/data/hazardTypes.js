/** Infrastructure hazard categories for authority map. */
export const HAZARD_CATEGORIES = {
  road_works: {
    label: 'Road works',
    color: '#f97316',
  },
  missing_tactile_paving: {
    label: 'Missing tactile paving',
    color: '#a855f7',
  },
  poor_lighting: {
    label: 'Poor lighting',
    color: '#eab308',
  },
  uneven_surface: {
    label: 'Uneven surface',
    color: '#92400e',
  },
  construction: {
    label: 'Construction',
    color: '#ef4444',
  },
  obstruction: {
    label: 'Obstruction',
    color: '#6b7280',
  },
}

export const HAZARD_SEVERITIES = {
  low: { label: 'Low', color: '#22c55e' },
  medium: { label: 'Medium', color: '#eab308' },
  high: { label: 'High', color: '#f97316' },
  critical: { label: 'Critical', color: '#ef4444' },
}

export const HAZARD_STATUSES = {
  active: { label: 'Active' },
  resolved: { label: 'Resolved' },
  under_review: { label: 'Under review' },
}

export function getCategoryMeta(category) {
  return HAZARD_CATEGORIES[category] ?? { label: category, color: '#6b7280' }
}

export function getSeverityMeta(severity) {
  return HAZARD_SEVERITIES[severity] ?? { label: severity, color: '#6b7280' }
}
