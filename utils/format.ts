/** Display formatting helpers — keep all presentation rules in one place. */

export function formatGsm(gsm: number | null | undefined): string {
  return gsm == null ? '—' : `${gsm} GSM`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatConfidence(score: number | null | undefined): string {
  return score == null ? '—' : `${Math.round(score)}%`;
}

export function reviewStatusLabel(status: string): string {
  switch (status) {
    case 'approved': return 'Approved';
    case 'needs_review': return 'Needs review';
    case 'rejected': return 'Rejected';
    default: return status;
  }
}
