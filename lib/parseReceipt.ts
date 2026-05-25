/**
 * Receipt parsing utilities.
 *
 * ParsedReceipt is the canonical type used by the bill wizard.
 * parseReceiptText() turns raw Tesseract OCR text into a structured receipt.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared type — imported by the wizard and useOCR
// ---------------------------------------------------------------------------

export const ParsedReceiptSchema = z.object({
  establishment_name: z.string(),
  date: z.string().nullable(),
  line_items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().int().positive(),
      unit_price_cents: z.number().int().nonnegative(),
      total_price_cents: z.number().int().nonnegative(),
    })
  ),
  subtotal_cents: z.number().int().nonnegative(),
  tax_cents: z.number().int().nonnegative(),
  tip_cents: z.number().int().nonnegative(),
  total_cents: z.number().int().nonnegative(),
  currency: z.string().default("USD"),
});

export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>;

// ---------------------------------------------------------------------------
// Heuristic parser — turns raw OCR text into a ParsedReceipt
// ---------------------------------------------------------------------------

// Lines that are definitely not items
const SKIP_RE =
  /^(date|time|server|cashier|table\s*#?|order\s*#?|receipt|invoice|thank|welcome|call|tel|phone|fax|www\.|http|[*=#\-]{3,}|\d{5}(?:-\d{4})?)/i;

// Keywords identifying summary rows
const SUBTOTAL_RE = /\bsub[\s\-]?total\b/i;
const TAX_RE = /\btax\b|\bvat\b|\bgst\b|\bhst\b|\bpst\b|\bqst\b|\bservice\s+tax\b/i;
const TIP_RE = /\btip\b|\bgratuity\b|\bservice\s+(?:charge|fee)\b/i;
const TOTAL_RE = /\btotal\b|\bamount\s+due\b|\bbal(?:ance)?\b|\bgrand\b/i;

// Price at the end of a line: optional $, digits, optional thousand commas, mandatory decimal
const PRICE_AT_END = /(?:\$\s*)?(\d{1,3}(?:,\d{3})*\.\d{2})\s*$/;

export function parseReceiptText(rawText: string): ParsedReceipt {
  const lines = rawText
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1);

  // ── Find establishment name ────────────────────────────────────────────────
  // First line that has 4+ letters, no price, and isn't a skip pattern
  let establishment = "Unknown";
  for (const line of lines.slice(0, 8)) {
    if (
      /[A-Za-z]{4,}/.test(line) &&
      !PRICE_AT_END.test(line) &&
      !SKIP_RE.test(line)
    ) {
      establishment = line;
      break;
    }
  }

  // ── Parse each line ────────────────────────────────────────────────────────
  const lineItems: ParsedReceipt["line_items"] = [];
  let subtotalCents = 0;
  let taxCents = 0;
  let tipCents = 0;
  let totalCents = 0;

  for (const line of lines) {
    const priceMatch = line.match(PRICE_AT_END);
    if (!priceMatch) continue;

    const amount = parseFloat(priceMatch[1].replace(/,/g, ""));
    if (isNaN(amount) || amount <= 0) continue;

    const cents = Math.round(amount * 100);

    // Name = everything before the price
    const namePart = line.slice(0, line.lastIndexOf(priceMatch[0])).trim();
    if (!namePart || SKIP_RE.test(namePart)) continue;

    if (SUBTOTAL_RE.test(namePart)) {
      subtotalCents = cents;
    } else if (TAX_RE.test(namePart)) {
      taxCents = cents;
    } else if (TIP_RE.test(namePart)) {
      tipCents = cents;
    } else if (TOTAL_RE.test(namePart) && !SUBTOTAL_RE.test(namePart)) {
      // Keep the largest "total" found (in case there are multiple total lines)
      if (cents >= totalCents) totalCents = cents;
    } else {
      // Strip leading quantity notation: "2x", "2 x", "2 @", "2 -"
      const cleanName = namePart.replace(/^\d+\s*[x×@\-]\s*/i, "").trim();
      if (cleanName.length > 0 && cents < 100_000_00) {
        lineItems.push({
          name: cleanName,
          quantity: 1,
          unit_price_cents: cents,
          total_price_cents: cents,
        });
      }
    }
  }

  // ── Fill in any missing totals ─────────────────────────────────────────────
  if (!subtotalCents && lineItems.length > 0) {
    subtotalCents = lineItems.reduce((s, i) => s + i.total_price_cents, 0);
  }
  if (!totalCents) {
    totalCents = subtotalCents + taxCents + tipCents;
  }

  return {
    establishment_name: establishment,
    date: null,
    line_items: lineItems,
    subtotal_cents: subtotalCents,
    tax_cents: taxCents,
    tip_cents: tipCents,
    total_cents: totalCents,
    currency: "USD",
  };
}
