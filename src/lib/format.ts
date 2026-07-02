const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Parse either an ISO timestamp (from the API) or a plain YYYY-MM-DD string.
export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// "2 Jul" style short day label.
export function fmtDay(s: string | null | undefined): string {
  const d = parseDate(s);
  if (!d) return "—";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

// Value for an <input type="date"> (YYYY-MM-DD), using UTC to match stored dates.
export function toDateInput(s: string | null | undefined): string {
  const d = parseDate(s);
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

// Whole days from a → b (positive if b is later).
export function daysBetween(a: string | null | undefined, b: string | null | undefined): number {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da || !db) return 0;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function weekOfLabel(): string {
  const d = new Date();
  return `Week of ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
