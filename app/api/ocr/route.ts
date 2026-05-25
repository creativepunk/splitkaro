/**
 * POST /api/ocr
 *
 * Accepts a receipt image (multipart/form-data), converts it to base64
 * in-memory, then sends it to Gemini Flash for structured extraction.
 * Returns a streaming SSE response so the UI shows progress.
 *
 * Body: FormData { file: File }
 * Response: text/event-stream — final event is "result" with parsed JSON
 *
 * Required env var: GEMINI_API_KEY
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Structured output schema
// ---------------------------------------------------------------------------

const LineItemSchema = z.object({
  name: z.string(),
  quantity: z.number().int().positive(),
  unit_price_cents: z.number().int().nonnegative(),
  total_price_cents: z.number().int().nonnegative(),
});

const ParsedReceiptSchema = z.object({
  establishment_name: z.string(),
  date: z.string().nullable(),
  line_items: z.array(LineItemSchema),
  subtotal_cents: z.number().int().nonnegative(),
  tax_cents: z.number().int().nonnegative(),
  tip_cents: z.number().int().nonnegative(),
  total_cents: z.number().int().nonnegative(),
  currency: z.string().default("USD"),
});

export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const maxDuration = 60;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "GEMINI_API_KEY is not configured on the server." }),
      { status: 503 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");

  if (!file || !(file instanceof File)) {
    return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: "File too large (max 10 MB)" }), { status: 413 });
  }

  // Gemini supports HEIC natively; map unknown types to jpeg
  const mimeType = ALLOWED_TYPES.includes(file.type) ? file.type : "image/jpeg";

  // Convert to base64 in-memory
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  // ── Stream SSE back to client ────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );

      send("status", { message: "Analyzing receipt…" });

      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        send("status", { message: "Extracting line items…" });

        const result = await model.generateContent([
          {
            inlineData: { mimeType, data: base64 },
          },
          EXTRACTION_PROMPT,
        ]);

        const rawText = result.response.text();

        // Accept ```json ... ``` block or bare object
        const jsonMatch =
          rawText.match(/```json\s*([\s\S]*?)\s*```/) ??
          rawText.match(/(\{[\s\S]*\})/);

        if (!jsonMatch) {
          send("error", { message: "Could not parse receipt. Please enter items manually." });
          controller.close();
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonMatch[1]);
        } catch {
          send("error", { message: "Could not parse receipt. Please enter items manually." });
          controller.close();
          return;
        }

        const validated = ParsedReceiptSchema.safeParse(parsed);
        if (!validated.success) {
          send("error", { message: "Receipt format unrecognised. Please enter items manually." });
          controller.close();
          return;
        }

        send("result", { receipt: validated.data });
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "OCR processing failed. Please enter items manually.";
        console.error("[OCR] Gemini error:", err);
        send("error", { message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ---------------------------------------------------------------------------
// Extraction prompt
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT = `
You are a receipt parser. Extract the following from this receipt image and return ONLY a JSON code block.

Rules:
- Convert ALL prices to integer cents (e.g. $12.50 → 1250).
- If a price is ambiguous, use 0.
- If the establishment name is not visible, use "Unknown".
- Do not infer or hallucinate items not visible on the receipt.

Return exactly this JSON structure:
\`\`\`json
{
  "establishment_name": "string",
  "date": "YYYY-MM-DD or null",
  "line_items": [
    {
      "name": "string",
      "quantity": 1,
      "unit_price_cents": 1250,
      "total_price_cents": 1250
    }
  ],
  "subtotal_cents": 0,
  "tax_cents": 0,
  "tip_cents": 0,
  "total_cents": 0,
  "currency": "USD"
}
\`\`\`
`.trim();
