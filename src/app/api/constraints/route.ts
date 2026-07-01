import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const constraints = await prisma.constraint.findMany({
    include: { activity: true },
    orderBy: { targetRemovalDate: "asc" },
  });
  return NextResponse.json(constraints);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.activityId || !body.constraintType || !body.description || !body.targetRemovalDate) {
    return NextResponse.json(
      { error: "activityId, constraintType, description and targetRemovalDate are required" },
      { status: 400 }
    );
  }

  const constraint = await prisma.constraint.create({
    data: {
      activityId: body.activityId,
      constraintType: body.constraintType,
      description: body.description,
      targetRemovalDate: new Date(body.targetRemovalDate),
    },
  });

  return NextResponse.json(constraint, { status: 201 });
}
