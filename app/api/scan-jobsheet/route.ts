import { NextRequest, NextResponse } from "next/server";
import { scanJobsheet } from "@/lib/jobsheet-actions";

export const runtime = "nodejs";

// A plain multipart upload rather than a Server Action — Next's RSC
// flight protocol chokes on very large base64 strings passed as action
// arguments, but a normal request body has no such limit.
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const result = await scanJobsheet(base64, file.type);
  return NextResponse.json(result);
}
