/**
 * POST /api/ocr
 *
 * Accepts a receipt image (multipart/form-data), converts it to base64
 * in-memory, then sends it to Claude for structured extraction.
 * Returns a streaming SSE response so the UI shows progress.
 *
 * Body: FormData { file: File }
 * Response: text/event-stream — final event is "result" with parsed JSON
 *
 * Required env var: ANTHROPIC_API_KEY
 */

import Anthropic from "@anthropic-ai/sdk";
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

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMediaType = (typeof ALLOWED_TYPES)[number];

export async function POST(req: NextRequest) {
  // ── Validate API key early so we surface a clear error ──────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured on the server." }),
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

  // Normalise HEIC → treat as jpeg for Claude (most HEIC is JPEG-encoded)
  const mediaType: AllowedMediaType = ALLOWED_TYPES.includes(file.type as AllowedMediaType)
    ? (file.type as AllowedMediaType)
    : "image/jpeg";

  // Convert file to base64 in-memory — no blob upload needed
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
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const message = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: mediaType, data: base64 },
                },
                { type: "text", text: EXTRACTION_PROMPT },
              ],
            },
          ],
        });

        send("status", { message: "Extracting line items…" });

        const rawText =
          message.content[0].type === "text" ? message.content[0].text : "";

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
        console.error("[OCR] error:", err);
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
