import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDelayed, isUpcoming } from "@/lib/lookahead";

export async function GET(request: NextRequest) {
  const window = request.nextUrl.searchParams.get("window");
  const now = new Date();

  const activities = await prisma.activity.findMany({
    orderBy: { plannedFinish: "asc" },
  });

  const annotated = activities.map((activity) => ({
    ...activity,
    delayed: isDelayed(activity.plannedStart, activity.plannedFinish, activity.progressPercent, now),
    upcoming: isUpcoming(activity.plannedFinish, now),
  }));

  const filtered = window === "upcoming" ? annotated.filter((a) => a.upcoming) : annotated;

  return NextResponse.json(filtered);
}
