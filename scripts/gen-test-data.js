const ExcelJS = require("exceljs");
const path = require("path");

// Excel serial date (base 1899-12-30), matching src/lib/excel-import.ts's inverse.
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
function toSerial(y, m, d) {
  return (Date.UTC(y, m - 1, d) - EXCEL_EPOCH_MS) / 86400000;
}
function toDateCell(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d, 0, 30, 0)); // matches real files' :30 time-of-day quirk
}

// row spec: [id, wbs, name, plannedStart, plannedFinish, duration, baselineStatus, baselineActualStart, baselineActualFinish, baselineActualDur,
//            progressStatus, progressActualStart, progressActualFinish, progressActualDur]
// Dates are [y,m,d] or null. "today" for this dataset is 2026-07-03; window end 2026-07-17.
const ROWS = [
  ["A-1001", "WTP.02.CIV.01", "Site Clearance & Grubbing", [2025,4,1], [2025,4,10], 6,
    "Completed", [2025,4,1], [2025,4,11], 6],
  ["A-1002", "WTP.02.CIV.02", "Bulk Excavation — Aeration Basin", [2025,4,15], [2025,5,5], 14,
    "Completed", [2025,4,16], [2025,5,7], 15],
  ["A-1003", "WTP.02.STR.01", "Rebar Fixing — Basin Base Slab", [2025,6,1], [2026,5,1], 11,
    "In Progress", [2025,6,5], null, 300],
  ["A-1004", "WTP.02.STR.02", "Formwork — Basin Walls (North)", [2026,6,1], [2026,7,10], 12,
    "In Progress", [2026,6,3], null, 25],
  ["A-1005", "WTP.02.STR.02", "Concrete Pour — Basin Walls (North)", [2026,7,1], [2026,7,14], 7,
    "Completed", [2026,7,1], [2026,7,13], 6],
  ["A-1006", "WTP.02.STR.03", "Waterproof Membrane — Basin", [2026,7,6], [2026,7,13], 5,
    "Not Started", null, null, 0],
  ["A-1007", "WTP.02.CIV.03", "Backfill Around Basin", [2026,7,20], [2026,8,3], 7,
    "Not Started", null, null, 0],
  ["A-1008", "WTP.02.STR.05", "Handrails & Access Platforms — Basin", [2025,6,1], [2025,6,10], 8,
    "Completed", [2025,6,2], [2025,6,9], 7],
  ["A-1009", "WTP.02.MEC.01", "Install Inlet Works Pipework", [2026,5,1], [2026,6,20], 11,
    "In Progress", [2026,5,3], null, 45],
  ["A-1010", "WTP.02.MEP.02", "MEP First Fix — Pump House", [2025,5,1], [2026,8,1], 12,
    "Not Started", null, null, 0],
  ["A-1011", "WTP.02.STR.04", "Structural Steel Erection — Pump House", [2025,3,1], [2025,4,1], 15,
    "Completed", [2025,3,2], [2025,4,2], 16],
  ["A-1012", "WTP.02.ARC.01", "Cladding to Pump House", [2026,7,8], [2026,7,20], 9,
    "Not Started", null, null, 0],
  ["A-1013", "WTP.02.MEC.02", "Install Duty / Standby Pumps", [2026,8,5], [2026,8,19], 10,
    "Not Started", null, null, 0],
  ["A-1014", "WTP.02.ARC.02", "Painting & Protective Coatings", [2025,12,1], [2026,1,15], 4,
    "Completed", [2025,12,1], [2026,1,14], 4],
  ["A-1015", null, "Temporary Site Fencing", [2025,1,1], [2025,1,10], 5,
    "Completed", [2025,1,1], [2025,1,9], 5],
  ["A-1016", "WTP.02.ELE.01", "Ductbank & Cable Containment (Phase-1/Rev.C)", [2026,6,20], [2026,7,11], 7,
    "In Progress", [2026,6,21], null, 11],
  ["A-1017", "WTP.02.CIV.05",
    "Access Road Sub-base & Kerbing — Northgate Perimeter Boundary Works, Package 2 (Civil/Drainage), incl. all associated ancillary structures and appurtenances required for completion of the northern site boundary interface zone",
    [2025,2,1], [2025,3,1], 20,
    "Completed", [2025,2,1], [2025,3,3], 20],
  ["A-1018", "WTP.02.CIV.06", "Chlorination Building Foundations", [2026,4,1], [2026,6,1], 11,
    "In Progress", [2026,4,5], null, 55],
  ["A-1019", "WTP.02.MEC.03", "Install Chemical Dosing Skids", [2026,7,8], [2026,7,16], 8,
    "Not Started", null, null, 0],
  ["A-1020", "WTP.02.ELE.02", "Commissioning & Testing — SCADA", [2026,8,20], [2026,9,5], 13,
    "Not Started", null, null, 0],
  ["A-1021", "WTP.02", "Contract Award", null, [2025,1,15], 0,
    "Completed", null, [2025,1,15], 0],
  ["A-1022", "WTP.02", "Site Mobilization Complete", [2025,2,1], null, 0,
    "Completed", [2025,2,1], null, 0],
  ["A-1023", "WTP.02", "Hot Commissioning Milestone", null, [2026,7,12], 0,
    "Not Started", null, null, 0],
  ["A-1024", "WTP.02.CIV.04", "Underground Drainage Runs", [2026,1,1], [2026,3,1], 14,
    "Completed", [2026,1,2], [2026,2,28], 13],
  ["A-1025", "WTP.02.STR.06", "Erection of Balance Items", [2026,7,9], [2026,7,15], 5,
    "In Progress", [2026,7,9], null, 4],
  // malformed in BOTH files (missing duration) -> never importable, negative control
  ["A-1027", "WTP.02.CIV.08", "Miscellaneous Works With No Duration Recorded", [2026,5,1], [2026,5,15], null,
    "Not Started", null, null, null],
  // unrecognized/oddly-cased status text -> falls back to NOT_STARTED per documented behavior
  ["A-1028", "WTP.02.ELE.03", "on hold pending client decision", [2026,6,1], [2026,7,9], 10,
    "On Hold", null, null, 5],
  ["A-1029", "WTP.02.ELE.04", "  Spare Parts Procurement  ", [2026,4,1], [2026,4,20], 12,
    "completed", [2026,4,1], [2026,4,18], 12],
];

// A-1026: malformed (blank name) in baseline only -> skipped there; well-formed in progress
// -> tests that Progress Update can create an activity baseline never successfully imported.
const A1026_BASELINE = ["A-1026", "WTP.02.CIV.07", "", [2026,5,1], [2026,5,10], 6, "Completed", [2026,5,1], [2026,5,9], 6];
const A1026_PROGRESS = ["A-1026", "WTP.02.CIV.07", "Miscellaneous Punch-list Closeout", [2026,5,1], [2026,5,10], 6, "Completed", [2026,5,1], [2026,5,9], 6];

const HEADER_ROW1 = ["task_code","status_code","wbs_id","task_name","target_start_date","target_end_date","act_start_date","act_end_date","target_drtn_hr_cnt","act_drtn_hr_cnt","delete_record_flag"];
const HEADER_ROW2 = ["Activity ID","Activity Status","WBS Code","Activity Name","(*)Planned Start","(*)Planned Finish","Actual Start","Actual Finish","Original Duration(d)","(*)Actual Duration(d)","Delete This Row"];

function writeDateCell(cell, ymd, useTrueDate) {
  if (!ymd) return; // leave blank
  const [y, m, d] = ymd;
  if (useTrueDate) {
    cell.value = toDateCell(y, m, d);
    cell.numFmt = "yyyy-mm-dd";
  } else {
    cell.value = toSerial(y, m, d);
  }
}

async function buildWorkbook(rows) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Sheet1");
  sheet.addRow(HEADER_ROW1);
  sheet.addRow(HEADER_ROW2);

  rows.forEach((r, idx) => {
    const [id, wbs, name, start, finish, dur, status, actStart, actFinish, actDur] = r;
    const rowNum = idx + 3;
    const useTrueDate = idx % 2 === 0; // alternate true-Date cells vs raw serials
    const row = sheet.getRow(rowNum);
    row.getCell(1).value = id;
    row.getCell(2).value = status;
    row.getCell(3).value = wbs === null ? null : wbs;
    row.getCell(4).value = name;
    writeDateCell(row.getCell(5), start, useTrueDate);
    writeDateCell(row.getCell(6), finish, useTrueDate);
    writeDateCell(row.getCell(7), actStart, !useTrueDate);
    writeDateCell(row.getCell(8), actFinish, !useTrueDate);
    row.getCell(9).value = dur === null ? null : dur;
    row.getCell(10).value = actDur === null ? null : actDur;
    row.commit();
  });

  return wb;
}

async function main() {
  const baselineRows = rows_for("baseline");
  const progressRows = rows_for("progress");

  const baselineWb = await buildWorkbook(baselineRows);
  const progressWb = await buildWorkbook(progressRows);

  const outDir = path.resolve(__dirname, "..", "sample-data");
  await baselineWb.xlsx.writeFile(path.join(outDir, "edge-case-baseline.xlsx"));
  await progressWb.xlsx.writeFile(path.join(outDir, "edge-case-progress.xlsx"));
  console.log("Wrote edge-case-baseline.xlsx and edge-case-progress.xlsx");
}

function rows_for(kind) {
  // Baseline: uniform "Not Started"/no actuals for every row except A-1001 (deliberately
  // Completed with actuals in the baseline file itself, to prove baseline import ignores
  // status/actuals even when the source file has them populated) and A-1026 (blank name).
  const out = [];
  for (const r of ROWS) {
    const [id, wbs, name, start, finish, dur, pStatus, pActStart, pActFinish, pActDur] = r;
    if (kind === "baseline") {
      const isA1001 = id === "A-1001";
      out.push([
        id, wbs, name, start, finish, dur,
        isA1001 ? "Completed" : "Not Started",
        isA1001 ? [2025,4,1] : null,
        isA1001 ? [2025,4,11] : null,
        isA1001 ? 6 : 0,
      ]);
    } else {
      out.push([id, wbs, name, start, finish, dur, pStatus, pActStart, pActFinish, pActDur]);
    }
  }
  if (kind === "baseline") out.push(A1026_BASELINE);
  else out.push(A1026_PROGRESS);
  return out;
}

main().catch((e) => { console.error(e); process.exit(1); });
