import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/activities/[id]">) {
  const { id } = await ctx.params;
  const body = await request.json();

  const data: { progressPercent?: number; responsibleEngineer?: string } = {};
  if (typeof body.progressPercent === "number") {
    if (body.progressPercent < 0 || body.progressPercent > 100) {
      return NextResponse.json({ error: "progressPercent must be between 0 and 100" }, { status: 400 });
    }
    data.progressPercent = body.progressPercent;
  }
  if (typeof body.responsibleEngineer === "string") {
    data.responsibleEngineer = body.responsibleEngineer;
  }

  const activity = await prisma.activity.update({ where: { id }, data });
  return NextResponse.json(activity);
}
