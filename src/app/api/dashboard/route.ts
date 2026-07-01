import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePPC, isDelayed, isUpcoming } from "@/lib/lookahead";

export async function GET() {
  const now = new Date();

  const [activities, openConstraints] = await Promise.all([
    prisma.activity.findMany(),
    prisma.constraint.count({ where: { status: "OPEN" } }),
  ]);

  const upcomingCount = activities.filter((a) => isUpcoming(a.plannedFinish, now)).length;
  const delayedCount = activities.filter((a) =>
    isDelayed(a.plannedStart, a.plannedFinish, a.progressPercent, now)
  ).length;

  return NextResponse.json({
    totalActivities: activities.length,
    upcomingActivities: upcomingCount,
    delayedActivities: delayedCount,
    openConstraints,
    ppc: calculatePPC(activities, now),
  });
}
