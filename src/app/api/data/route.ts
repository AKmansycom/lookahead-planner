import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Clears all imported data. Constraints are deleted first because they hold a
// foreign key to Activity. Wrapped in a transaction so a partial wipe can't
// leave orphaned rows. Intentionally deletes everything — this is the explicit
// "start over" action, not a filtered delete.
export async function DELETE() {
  const [constraints, activities] = await prisma.$transaction([
    prisma.constraint.deleteMany({}),
    prisma.activity.deleteMany({}),
  ]);

  return NextResponse.json({
    deletedConstraints: constraints.count,
    deletedActivities: activities.count,
  });
}
