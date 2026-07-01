export const LOOKAHEAD_WINDOW_DAYS = 14;

export function isDelayed(plannedStart: Date, plannedFinish: Date, progressPercent: number, now: Date): boolean {
  const pastFinishIncomplete = plannedFinish < now && progressPercent < 100;
  const pastStartUnstarted = plannedStart < now && progressPercent === 0;
  return pastFinishIncomplete || pastStartUnstarted;
}

export function isUpcoming(plannedFinish: Date, now: Date): boolean {
  const windowEnd = new Date(now.getTime() + LOOKAHEAD_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return plannedFinish >= now && plannedFinish <= windowEnd;
}

export function calculatePPC(activities: { plannedFinish: Date; progressPercent: number }[], now: Date): number {
  const inWindow = activities.filter((a) => isUpcoming(a.plannedFinish, now));
  if (inWindow.length === 0) return 0;
  const completed = inWindow.filter((a) => a.progressPercent === 100).length;
  return Math.round((completed / inWindow.length) * 100);
}
