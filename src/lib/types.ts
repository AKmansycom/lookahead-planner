export type ActivityStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type ConstraintType =
  | "DRAWING"
  | "MATERIAL"
  | "LABOUR"
  | "EQUIPMENT"
  | "APPROVAL"
  | "RFI"
  | "CLIENT_DECISION";

export type ConstraintStatus = "OPEN" | "CLOSED";

export interface Activity {
  id: string;
  activityName: string;
  wbsCode: string | null;
  plannedStart: string;
  plannedFinish: string;
  actualStart: string | null;
  actualFinish: string | null;
  originalDurationDays: number;
  actualDurationDays: number | null;
  status: ActivityStatus;
  progressPercent: number;
  responsibleEngineer: string | null;
  varianceReason: string | null;
  // Computed server-side by GET /api/activities:
  delayed: boolean;
  upcoming: boolean;
}

export interface Constraint {
  id: number;
  activityId: string;
  constraintType: ConstraintType;
  description: string;
  status: ConstraintStatus;
  targetRemovalDate: string;
  actualRemovalDate: string | null;
  activity?: Activity;
}

export interface DashboardStats {
  totalActivities: number;
  upcomingActivities: number;
  delayedActivities: number;
  openConstraints: number;
  ppc: number;
}

export const TYPE_LABELS: Record<ConstraintType, string> = {
  DRAWING: "Drawing",
  MATERIAL: "Material",
  LABOUR: "Labour",
  EQUIPMENT: "Equipment",
  APPROVAL: "Approval",
  RFI: "RFI",
  CLIENT_DECISION: "Client decision",
};

export const TYPE_HUE: Record<ConstraintType, string> = {
  DRAWING: "#8b9dff",
  MATERIAL: "#f4b04a",
  LABOUR: "#2dd4bf",
  EQUIPMENT: "#c084fc",
  APPROVAL: "#34d399",
  RFI: "#ff7a72",
  CLIENT_DECISION: "#f472b6",
};

// Last Planner System variance reasons (why a delayed activity is late).
export const REASONS = [
  "Materials",
  "Labour",
  "Equipment",
  "Design / Info",
  "Preceding work",
  "Access / Space",
  "External / Weather",
  "Other",
];

export function statusMeta(s: ActivityStatus): { label: string; style: string; color: string } {
  if (s === "COMPLETED")
    return { label: "Complete", style: "background:rgba(52,211,153,0.16);color:#4ade9f;", color: "#34d399" };
  if (s === "IN_PROGRESS")
    return { label: "In progress", style: "background:rgba(124,140,255,0.16);color:#a3b0ff;", color: "#8b9dff" };
  return { label: "Not started", style: "background:rgba(255,255,255,0.08);color:#9aa4bd;", color: "#8791ab" };
}

export function derivedStatus(progressPercent: number): ActivityStatus {
  if (progressPercent >= 100) return "COMPLETED";
  if (progressPercent > 0) return "IN_PROGRESS";
  return "NOT_STARTED";
}
