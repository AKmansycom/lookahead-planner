import ExcelJS from "exceljs";

export type ImportStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type ImportRow = {
  activityId: string;
  activityName: string;
  wbsCode?: string;
  status?: ImportStatus;
  plannedStart: Date;
  plannedFinish: Date;
  actualStart?: Date;
  actualFinish?: Date;
  originalDurationDays: number;
  actualDurationDays?: number;
};

const STATUS_MAP: Record<string, ImportStatus> = {
  "Not Started": "NOT_STARTED",
  "In Progress": "IN_PROGRESS",
  Completed: "COMPLETED",
};

const PROGRESS_BY_STATUS: Record<ImportStatus, number> = {
  NOT_STARTED: 0,
  IN_PROGRESS: 50,
  COMPLETED: 100,
};

export function progressPercentForStatus(status: ImportStatus): number {
  return PROGRESS_BY_STATUS[status];
}

// Primavera P6 export columns: A=task_code B=status_code C=wbs_id D=task_name
// E=target_start_date F=target_end_date G=act_start_date H=act_end_date
// I=target_drtn_hr_cnt J=act_drtn_hr_cnt. Dates are Excel serials (base 1899-12-30).
function excelSerialToDate(serial: number): Date {
  const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
  return new Date(EXCEL_EPOCH_MS + serial * 24 * 60 * 60 * 1000);
}

function cellDate(value: ExcelJS.CellValue): Date | undefined {
  if (typeof value === "number") return excelSerialToDate(value);
  if (value instanceof Date) return value;
  return undefined;
}

function cellText(value: ExcelJS.CellValue): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

export async function parseActivityWorkbook(buffer: Buffer): Promise<ImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's own type declarations shadow "Buffer" with a module-local interface
  // that extends ArrayBuffer, incompatible with @types/node's real Buffer. Bypass with any.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  const rows: ImportRow[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= 2) return; // row 1 = Primavera field codes, row 2 = human headers

    const activityId = cellText(row.getCell(1).value);
    const activityName = cellText(row.getCell(4).value);
    const originalDuration = row.getCell(9).value;

    // Milestones (e.g. "Signing of Contract", "Commissioning") have 0 duration and only
    // a start OR a finish date, not both. Treat the single date as both, so they still
    // show up in the look-ahead window instead of being silently dropped.
    let plannedStart = cellDate(row.getCell(5).value);
    let plannedFinish = cellDate(row.getCell(6).value);
    if (plannedStart && !plannedFinish) plannedFinish = plannedStart;
    if (plannedFinish && !plannedStart) plannedStart = plannedFinish;

    if (!activityId || !activityName || !plannedStart || !plannedFinish || originalDuration == null) {
      return; // skip blank/malformed rows
    }

    const statusText = cellText(row.getCell(2).value);
    const actualDuration = row.getCell(10).value;

    rows.push({
      activityId,
      activityName,
      wbsCode: cellText(row.getCell(3).value),
      status: statusText ? STATUS_MAP[statusText] : undefined,
      plannedStart,
      plannedFinish,
      actualStart: cellDate(row.getCell(7).value),
      actualFinish: cellDate(row.getCell(8).value),
      originalDurationDays: Number(originalDuration),
      actualDurationDays: actualDuration != null ? Number(actualDuration) : undefined,
    });
  });

  return rows;
}
