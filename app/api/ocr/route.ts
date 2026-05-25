/**
 * POST /api/ocr
 *
 * Accepts a receipt image (multipart/form-data), uploads it to Vercel Blob
 * for temporary storage, then sends it to an LLM with a strict JSON schema
 * for structured extraction. Returns a streaming JSON response so the
 * client sees progress and Vercel's function timeout is not an issue.
 *
 * Body: FormData { file: File, billId?: string }
 * Response: text/event-stream (SSE) — final event is "result" with parsed JSON
 */

import { put } from "@vercel/blob";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Structured output schema (validated with Zod after LLM response)
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

export const maxDuration = 60; // Vercel Pro allows up to 60s; raise to 300 on Enterprise

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");

  if (!file || !(file instanceof File)) {
    return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: "File too large (max 10 MB)" }), { status: 413 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  if (!allowedTypes.includes(file.type)) {
    return new Response(JSON.stringify({ error: "Unsupported file type" }), { status: 415 });
  }

  // --- Phase 1: Upload to Vercel Blob (fast, <1s) ---
  let blobUrl: string;
  try {
    const blob = await put(`receipts/${crypto.randomUUID()}-${file.name}`, file, {
      access: "public",
      // Files expire after 1 hour — they're only needed for OCR processing
      // (set a lifecycle rule in your Blob store settings for auto-cleanup)
    });
    blobUrl = blob.url;
  } catch (err) {
    console.error("[OCR] Blob upload failed:", err);
    return new Response(JSON.stringify({ error: "Failed to upload receipt" }), { status: 502 });
  }

  // --- Phase 2: Stream LLM response back to client via SSE ---
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      send("status", { message: "Receipt uploaded, analyzing…", blobUrl });

      try {
        const client = new Anthropic();

        // Fetch the uploaded image as base64 for the Claude vision call
        const imageResp = await fetch(blobUrl);
        const imageBuffer = await imageResp.arrayBuffer();
        const base64 = Buffer.from(imageBuffer).toString("base64");
        const mediaType = file.type as "image/jpeg" | "image/png" | "image/webp";

        send("status", { message: "Extracting line items…" });

        const message = await client.messages.create({
          model: "claude-haiku-4-5-20251001", // fast & cheap for OCR; swap to sonnet for accuracy
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: mediaType, data: base64 },
                },
                {
                  type: "text",
                  text: EXTRACTION_PROMPT,
                },
              ],
            },
          ],
        });

        const rawText =
          message.content[0].type === "text" ? message.content[0].text : "";

        // Extract JSON block from the response
        const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) ??
                          rawText.match(/(\{[\s\S]*\})/);

        if (!jsonMatch) {
          send("error", { message: "LLM returned unparseable output", raw: rawText });
          controller.close();
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonMatch[1]);
        } catch {
          send("error", { message: "JSON parse failed", raw: jsonMatch[1] });
          controller.close();
          return;
        }

        const validated = ParsedReceiptSchema.safeParse(parsed);
        if (!validated.success) {
          send("error", { message: "Schema validation failed", issues: validated.error.issues });
          controller.close();
          return;
        }

        send("result", { receipt: validated.data, blobUrl });
      } catch (err) {
        console.error("[OCR] LLM call failed:", err);
        send("error", { message: "OCR processing failed. Please enter items manually." });
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
      "X-Accel-Buffering": "no", // disable Nginx buffering if behind a proxy
    },
  });
}

// ---------------------------------------------------------------------------
// Extraction prompt — instructs the model to return strict JSON
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
