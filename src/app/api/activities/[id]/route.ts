import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ActivityStatus, Prisma } from "@/generated/prisma/client";

function statusForProgress(progressPercent: number): ActivityStatus {
  if (progressPercent >= 100) return "COMPLETED";
  if (progressPercent > 0) return "IN_PROGRESS";
  return "NOT_STARTED";
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/activities/[id]">) {
  const { id } = await ctx.params;
  const body = await request.json();

  const data: Prisma.ActivityUpdateInput = {};

  if (typeof body.progressPercent === "number") {
    if (body.progressPercent < 0 || body.progressPercent > 100) {
      return NextResponse.json({ error: "progressPercent must be between 0 and 100" }, { status: 400 });
    }
    data.progressPercent = body.progressPercent;
    // Keep status consistent with progress (status is derived from progress in the UI).
    data.status = statusForProgress(body.progressPercent);
  }
  if (typeof body.responsibleEngineer === "string") {
    data.responsibleEngineer = body.responsibleEngineer || null;
  }
  if ("actualStart" in body) {
    data.actualStart = body.actualStart ? new Date(body.actualStart) : null;
  }
  if ("actualFinish" in body) {
    data.actualFinish = body.actualFinish ? new Date(body.actualFinish) : null;
  }
  if ("varianceReason" in body) {
    data.varianceReason = body.varianceReason || null;
  }

  const activity = await prisma.activity.update({ where: { id }, data });
  return NextResponse.json(activity);
}
