"use server";

import { GoogleAuth } from "google-auth-library";

let cachedAuth: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (cachedAuth) return cachedAuth;
  const raw = process.env.GOOGLE_VISION_CREDENTIALS_JSON;
  if (!raw) throw new Error("Jobsheet scanning isn't set up yet — missing Google Vision credentials.");
  const credentials = JSON.parse(raw);
  cachedAuth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-vision"],
  });
  return cachedAuth;
}

// Sends a photo (base64, no data: prefix) to Google Cloud Vision's
// document text detection, which is tuned for printed forms/tables rather
// than scattered scene text — best fit for a jobsheet photo.
export async function extractTextFromImage(base64Image: string): Promise<string> {
  const auth = getAuth();
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Could not authenticate with Google Vision.");

  const res = await fetch("https://vision.googleapis.com/v1/images:annotate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64Image },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Vision request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const result = data.responses?.[0];
  if (result?.error) throw new Error(result.error.message ?? "Google Vision returned an error.");
  return result?.fullTextAnnotation?.text ?? "";
}

// PDFs go through the separate files:annotate endpoint — only the first
// page is read, since a jobsheet is a single page.
export async function extractTextFromPdf(base64Pdf: string): Promise<string> {
  const auth = getAuth();
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Could not authenticate with Google Vision.");

  const res = await fetch("https://vision.googleapis.com/v1/files:annotate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      requests: [
        {
          inputConfig: { mimeType: "application/pdf", content: base64Pdf },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          pages: [1],
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Vision request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const result = data.responses?.[0];
  if (result?.error) throw new Error(result.error.message ?? "Google Vision returned an error.");
  return result?.responses?.[0]?.fullTextAnnotation?.text ?? "";
}
