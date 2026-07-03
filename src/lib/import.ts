import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ImportRow, progressPercentForStatus } from "@/lib/excel-import";

// One upsert per row (861 sequential round-trips) took over 2 minutes; even
// with bounded concurrency it was ~43s once the connection pool had to be
// capped low (see prisma.ts) to stay under Supabase's connection limit. The
// real fix is fewer round-trips, not more connections: batch many rows into
// one multi-row INSERT ... ON CONFLICT statement per network call.
const BATCH_SIZE = 200;
const CONCURRENCY = 3; // matches the pg pool's max connections in prisma.ts

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

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
  await mapWithConcurrency(chunk(rows, BATCH_SIZE), CONCURRENCY, async (batch) => {
    const values = Prisma.join(
      batch.map(
        (row) =>
          Prisma.sql`(${row.activityId}::text, ${row.activityName}::text, ${row.wbsCode ?? null}::text, ${row.plannedStart}::timestamp, ${row.plannedFinish}::timestamp, ${row.originalDurationDays}::integer, 'NOT_STARTED'::"ActivityStatus", 0, now(), now())`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO "Activity" ("id", "activityName", "wbsCode", "plannedStart", "plannedFinish", "originalDurationDays", "status", "progressPercent", "createdAt", "updatedAt")
      VALUES ${values}
      ON CONFLICT ("id") DO UPDATE SET
        "activityName" = EXCLUDED."activityName",
        "wbsCode" = EXCLUDED."wbsCode",
        "plannedStart" = EXCLUDED."plannedStart",
        "plannedFinish" = EXCLUDED."plannedFinish",
        "originalDurationDays" = EXCLUDED."originalDurationDays",
        "updatedAt" = now();
    `;
  });
  return { count: rows.length };
}

// Progress Update import upserts by Activity ID: refreshes status, actual
// dates and derived progress %. Never touches responsibleEngineer or
// varianceReason, which are only ever set manually in the app (the source
// data has no such fields). A row with no recognized status defaults to
// Not Started — real Primavera exports always carry a status, so this only
// matters for malformed input.
export async function importProgressUpdate(rows: ImportRow[]) {
  await mapWithConcurrency(chunk(rows, BATCH_SIZE), CONCURRENCY, async (batch) => {
    const values = Prisma.join(
      batch.map((row) => {
        const status = row.status ?? "NOT_STARTED";
        const progressPercent = progressPercentForStatus(status);
        return Prisma.sql`(${row.activityId}::text, ${row.activityName}::text, ${row.wbsCode ?? null}::text, ${row.plannedStart}::timestamp, ${row.plannedFinish}::timestamp, ${row.originalDurationDays}::integer, ${row.actualStart ?? null}::timestamp, ${row.actualFinish ?? null}::timestamp, ${row.actualDurationDays ?? null}::integer, ${status}::"ActivityStatus", ${progressPercent}::integer, now(), now())`;
      })
    );
    await prisma.$executeRaw`
      INSERT INTO "Activity" ("id", "activityName", "wbsCode", "plannedStart", "plannedFinish", "originalDurationDays", "actualStart", "actualFinish", "actualDurationDays", "status", "progressPercent", "createdAt", "updatedAt")
      VALUES ${values}
      ON CONFLICT ("id") DO UPDATE SET
        "status" = EXCLUDED."status",
        "actualStart" = EXCLUDED."actualStart",
        "actualFinish" = EXCLUDED."actualFinish",
        "actualDurationDays" = EXCLUDED."actualDurationDays",
        "progressPercent" = EXCLUDED."progressPercent",
        "updatedAt" = now();
    `;
  });
  return { count: rows.length };
}
