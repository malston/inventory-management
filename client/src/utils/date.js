// Date-only strings ("2026-10-22") are parsed by Date as UTC midnight, which
// displays as the previous day west of UTC. Parse them as local midnight instead.
export function parseDate(dateString) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return new Date(`${dateString}T00:00:00`)
  }
  return new Date(dateString)
}
