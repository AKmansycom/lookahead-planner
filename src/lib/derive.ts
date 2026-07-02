import { Activity, Constraint } from "@/lib/types";
import { parseDate } from "@/lib/format";

const WINDOW_DAYS = 14;

// Mirrors the backend look-ahead rules so live edits update badges instantly
// without a round-trip. `now` is passed in so all rows use one consistent clock.
export function isUpcoming(a: Activity, now: Date): boolean {
  const finish = parseDate(a.plannedFinish);
  if (!finish) return false;
  const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 86400000);
  return finish >= now && finish <= windowEnd;
}

export function isDelayed(a: Activity, now: Date): boolean {
  const start = parseDate(a.plannedStart);
  const finish = parseDate(a.plannedFinish);
  const pastFinishIncomplete = !!finish && finish < now && a.progressPercent < 100;
  const pastStartUnstarted = !!start && start < now && a.progressPercent === 0;
  return pastFinishIncomplete || pastStartUnstarted;
}

export function openConstraintsByActivity(constraints: Constraint[]): Record<string, Constraint[]> {
  const map: Record<string, Constraint[]> = {};
  for (const c of constraints) {
    if (c.status === "OPEN") (map[c.activityId] ||= []).push(c);
  }
  return map;
}
