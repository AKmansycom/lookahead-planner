import { Activity, Constraint, ConstraintType } from "@/lib/types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function fetchActivities(): Promise<Activity[]> {
  return json(await fetch("/api/activities", { cache: "no-store" }));
}

export async function fetchConstraints(): Promise<Constraint[]> {
  return json(await fetch("/api/constraints", { cache: "no-store" }));
}

export async function patchActivity(
  id: string,
  patch: Partial<{
    progressPercent: number;
    responsibleEngineer: string;
    actualStart: string | null;
    actualFinish: string | null;
    varianceReason: string | null;
  }>
): Promise<Activity> {
  return json(
    await fetch(`/api/activities/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
}

export async function createConstraint(input: {
  activityId: string;
  constraintType: ConstraintType;
  description: string;
  targetRemovalDate: string;
}): Promise<Constraint> {
  return json(
    await fetch("/api/constraints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function updateConstraintStatus(id: number, status: "OPEN" | "CLOSED"): Promise<Constraint> {
  return json(
    await fetch(`/api/constraints/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
  );
}

export async function importFile(kind: "baseline" | "progress", file: File): Promise<{ count: number }> {
  const form = new FormData();
  form.append("file", file);
  return json(await fetch(`/api/import/${kind}`, { method: "POST", body: form }));
}
