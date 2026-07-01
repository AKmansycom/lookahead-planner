import { prisma } from "@/lib/prisma";
import { ImportRow, progressPercentForStatus } from "@/lib/excel-import";

// Baseline import seeds/updates planning fields only. Status/progress/actuals
// are owned by Progress Update imports, never by Baseline.
export async function importBaseline(rows: ImportRow[]) {
  for (const row of rows) {
    await prisma.activity.upsert({
      where: { id: row.activityId },
      create: {
        id: row.activityId,
        activityName: row.activityName,
        wbsCode: row.wbsCode,
        plannedStart: row.plannedStart,
        plannedFinish: row.plannedFinish,
        originalDurationDays: row.originalDurationDays,
      },
      update: {
        activityName: row.activityName,
        wbsCode: row.wbsCode,
        plannedStart: row.plannedStart,
        plannedFinish: row.plannedFinish,
        originalDurationDays: row.originalDurationDays,
      },
    });
  }
  return { count: rows.length };
}

// Progress Update import upserts by Activity ID: refreshes status, actual
// dates and derived progress %. Never touches responsibleEngineer, which is
// only ever set manually in the app (the source data has no such field).
export async function importProgressUpdate(rows: ImportRow[]) {
  for (const row of rows) {
    const progressPercent = row.status ? progressPercentForStatus(row.status) : undefined;
    await prisma.activity.upsert({
      where: { id: row.activityId },
      create: {
        id: row.activityId,
        activityName: row.activityName,
        wbsCode: row.wbsCode,
        plannedStart: row.plannedStart,
        plannedFinish: row.plannedFinish,
        originalDurationDays: row.originalDurationDays,
        actualStart: row.actualStart,
        actualFinish: row.actualFinish,
        actualDurationDays: row.actualDurationDays,
        status: row.status ?? "NOT_STARTED",
        progressPercent: progressPercent ?? 0,
      },
      update: {
        status: row.status,
        actualStart: row.actualStart,
        actualFinish: row.actualFinish,
        actualDurationDays: row.actualDurationDays,
        progressPercent,
      },
    });
  }
  return { count: rows.length };
}
