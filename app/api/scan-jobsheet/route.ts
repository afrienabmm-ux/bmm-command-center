import { NextRequest, NextResponse } from "next/server";
import { scanJobsheet } from "@/lib/jobsheet-actions";
import { compressPhotoForStorage } from "@/lib/vision";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

const JOBSHEET_PHOTO_BUCKET = "jobsheet-photos";

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

  // Keep a copy of the photo the mechanic uploaded so a manager can look at
  // it directly in the dashboard later, whenever the automated reading
  // (item rows, signature check) needs a human double-check against the
  // real thing — shrunk down first (see compressPhotoForStorage) since the
  // original, full phone-camera photo is far bigger than needed for that.
  // The OCR scan below always reads `base64`, the untouched original, so
  // this compression can never affect scan accuracy. Best-effort — a
  // failed upload here shouldn't fail the scan itself, since the form has
  // already been filled in either way. PDFs are left as-is: already tiny,
  // and sharp can't recompress a PDF the way it can a photo.
  const isPdf = file.type === "application/pdf";
  const ext = isPdf ? "pdf" : (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const storedBuffer = isPdf ? buffer : await compressPhotoForStorage(buffer).catch(() => buffer);
  const [result, uploadResult] = await Promise.all([
    scanJobsheet(base64, file.type),
    supabaseAdmin.storage
      .from(JOBSHEET_PHOTO_BUCKET)
      .upload(path, storedBuffer, { contentType: isPdf ? "application/pdf" : "image/jpeg" }),
  ]);
  if ("error" in result) return NextResponse.json(result);

  return NextResponse.json({ data: result.data, photoPath: uploadResult.error ? null : path });
}
