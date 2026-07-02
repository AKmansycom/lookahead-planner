import { prisma } from "@/lib/prisma";
import { ImportRow, progressPercentForStatus } from "@/lib/excel-import";

// Upserting hundreds of rows one at a time (awaiting each round-trip to the DB
// in sequence) took over 2 minutes for the 861-row sample files. Run a bounded
// number of upserts concurrently instead — capped at the pg pool's default max
// connections (10) so we don't exhaust the connection pool.
const CONCURRENCY = 10;

async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// Baseline import seeds/updates planning fields only. Status/progress/actuals
// are owned by Progress Update imports, never by Baseline.
export async function importBaseline(rows: ImportRow[]) {
  await mapWithConcurrency(rows, CONCURRENCY, async (row) => {
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
  });
  return { count: rows.length };
}

// Progress Update import upserts by Activity ID: refreshes status, actual
// dates and derived progress %. Never touches responsibleEngineer, which is
// only ever set manually in the app (the source data has no such field).
export async function importProgressUpdate(rows: ImportRow[]) {
  await mapWithConcurrency(rows, CONCURRENCY, async (row) => {
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
  });
  return { count: rows.length };
}
