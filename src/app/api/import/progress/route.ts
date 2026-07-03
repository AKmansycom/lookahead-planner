import { NextRequest, NextResponse } from "next/server";
import { parseActivityWorkbook } from "@/lib/excel-import";
import { importProgressUpdate } from "@/lib/import";

// Importing hundreds of rows through a connection-pool-limited client takes
// longer than Vercel's default function timeout.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rows = await parseActivityWorkbook(buffer);
  const result = await importProgressUpdate(rows);

  return NextResponse.json(result);
}
