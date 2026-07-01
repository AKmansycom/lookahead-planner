import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/constraints/[id]">) {
  const { id } = await ctx.params;
  const body = await request.json();

  if (body.status !== "OPEN" && body.status !== "CLOSED") {
    return NextResponse.json({ error: "status must be OPEN or CLOSED" }, { status: 400 });
  }

  const constraint = await prisma.constraint.update({
    where: { id: Number(id) },
    data: {
      status: body.status,
      actualRemovalDate: body.status === "CLOSED" ? new Date() : null,
    },
  });

  return NextResponse.json(constraint);
}
