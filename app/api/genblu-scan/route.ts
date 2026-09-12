import { NextRequest, NextResponse } from "next/server";
import { analyzeGenbluHomeScreenForApi } from "@/lib/genblu-actions";

export const runtime = "nodejs";
export const maxDuration = 30;

// Reads a customer's name, points, and membership number off a GenBlu
// app home-screen screenshot — for a partner's own registration flow to
// call instead of running its own OCR on the same kind of photo, which
// its dashboard has had trouble reading reliably. Same scanning logic our
// own "No Jobsheet — New Customer" flow already uses (see
// scanGenbluScreenshotForNameAction in lib/genblu-actions.ts), just
// reachable without a staff login. Server-to-server only, so this checks
// a shared secret header instead of the app's normal cookie-based login —
// same pattern as /api/genblu-new-registrations.
function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.GENBLU_SCAN_API_KEY;
  if (!expected) return false; // Refuse every request until a key is actually configured.
  return req.headers.get("x-api-key") === expected;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Missing or invalid x-api-key header." }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded — send it as multipart/form-data under the field name \"file\"." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const scan = await analyzeGenbluHomeScreenForApi(buffer);
  return NextResponse.json({ data: scan });
}

export async function GET(): Promise<Response> {
  return Response.json({ error: "POST only" }, { status: 405 });
}
