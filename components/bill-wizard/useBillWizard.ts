"use client";

import { useState, useCallback } from "react";
import type { ParsedReceipt } from "@/app/api/ocr/route";
import { calculateBillBalances, type BillBalanceResult } from "@/lib/ledger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WizardParticipant {
  id: string;
  name: string;
  image?: string | null;
}

export interface ItemParticipant {
  userId: string;
  /** Integer parts — share = parts / sum(all parts). 0 = not included. */
  parts: number;
}

export interface WizardLineItem {
  id: string;
  name: string;
  quantity: number;
  unitCents: number;
  totalCents: number;
  /** One entry per wizard participant. parts=0 means excluded. */
  participants: ItemParticipant[];
}

export interface WizardPayment {
  userId: string;
  amountCents: number;
}

/** Steps: 1=Upload, 2=Items & Shares, 3=Log Payments */
export type WizardStep = 1 | 2 | 3;

interface WizardState {
  step: WizardStep;
  receiptBlobUrl: string | null;
  establishmentName: string;
  lineItems: WizardLineItem[];
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  payments: WizardPayment[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeId = () => crypto.randomUUID().slice(0, 8);

function equalParticipants(memberIds: string[]): ItemParticipant[] {
  return memberIds.map((id) => ({ userId: id, parts: 1 }));
}

function partsToFraction(parts: number, totalParts: number) {
  return { numerator: parts, denominator: totalParts };
}

function recalcTotals(state: WizardState): WizardState {
  const subtotalCents = state.lineItems.reduce((s, i) => s + i.totalCents, 0);
  return {
    ...state,
    subtotalCents,
    totalCents: subtotalCents + state.taxCents + state.tipCents,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBillWizard(participants: WizardParticipant[]) {
  const memberIds = participants.map((p) => p.id);

  const [state, setState] = useState<WizardState>({
    step: 1,
    receiptBlobUrl: null,
    establishmentName: "",
    lineItems: [],
    subtotalCents: 0,
    taxCents: 0,
    tipCents: 0,
    totalCents: 0,
    payments: participants.map((p) => ({ userId: p.id, amountCents: 0 })),
  });

  // ── Navigation ──────────────────────────────────────────────────────────
  const next = useCallback(
    () => setState((s) => ({ ...s, step: Math.min(3, s.step + 1) as WizardStep })),
    []
  );
  const back = useCallback(
    () => setState((s) => ({ ...s, step: Math.max(1, s.step - 1) as WizardStep })),
    []
  );

  // ── Step 1: OCR ──────────────────────────────────────────────────────────
  const applyOCRResult = useCallback(
    (receipt: ParsedReceipt, blobUrl: string) => {
      setState((s) => {
        const lineItems = receipt.line_items.map((item) => ({
          id: makeId(),
          name: item.name,
          quantity: item.quantity,
          unitCents: item.unit_price_cents,
          totalCents: item.total_price_cents,
          participants: equalParticipants(memberIds),
        }));
        const subtotalCents = lineItems.reduce((s, i) => s + i.totalCents, 0);
        return {
          ...s,
          receiptBlobUrl: blobUrl,
          establishmentName: receipt.establishment_name,
          lineItems,
          subtotalCents,
          taxCents: receipt.tax_cents,
          tipCents: receipt.tip_cents,
          totalCents: receipt.total_cents,
          step: 2,
        };
      });
    },
    [memberIds]
  );

  const skipToManual = useCallback(() => {
    setState((s) => ({
      ...s,
      lineItems: [
        {
          id: makeId(),
          name: "",
          quantity: 1,
          unitCents: 0,
          totalCents: 0,
          participants: equalParticipants(memberIds),
        },
      ],
      step: 2,
    }));
  }, [memberIds]);

  // ── Step 2: Establishment name ───────────────────────────────────────────
  const setEstablishmentName = useCallback((name: string) => {
    setState((s) => ({ ...s, establishmentName: name }));
  }, []);

  // ── Step 2: Item editing ─────────────────────────────────────────────────
  const updateItem = useCallback((id: string, patch: Partial<Omit<WizardLineItem, "id" | "participants">>) => {
    setState((s) => {
      const lineItems = s.lineItems.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...patch };
        // Recalc totalCents whenever qty or unitCents changes
        if (patch.quantity !== undefined || patch.unitCents !== undefined) {
          updated.totalCents = updated.quantity * updated.unitCents;
        }
        return updated;
      });
      return recalcTotals({ ...s, lineItems });
    });
  }, []);

  const addItem = useCallback(() => {
    setState((s) =>
      recalcTotals({
        ...s,
        lineItems: [
          ...s.lineItems,
          {
            id: makeId(),
            name: "",
            quantity: 1,
            unitCents: 0,
            totalCents: 0,
            participants: equalParticipants(memberIds),
          },
        ],
      })
    );
  }, [memberIds]);

  const removeItem = useCallback((id: string) => {
    setState((s) => recalcTotals({ ...s, lineItems: s.lineItems.filter((i) => i.id !== id) }));
  }, []);

  const updateTaxTip = useCallback(
    (patch: { taxCents?: number; tipCents?: number }) => {
      setState((s) => {
        const next = { ...s, ...patch };
        next.totalCents = next.subtotalCents + next.taxCents + next.tipCents;
        return next;
      });
    },
    []
  );

  // ── Step 2: Participant parts (shares) ──────────────────────────────────
  const setParticipantParts = useCallback((itemId: string, userId: string, parts: number) => {
    setState((s) => ({
      ...s,
      lineItems: s.lineItems.map((item) =>
        item.id !== itemId
          ? item
          : {
              ...item,
              participants: item.participants.map((p) =>
                p.userId === userId ? { ...p, parts: Math.max(0, parts) } : p
              ),
            }
      ),
    }));
  }, []);

  const equalSplitItem = useCallback((itemId: string) => {
    setState((s) => ({
      ...s,
      lineItems: s.lineItems.map((item) =>
        item.id !== itemId
          ? item
          : { ...item, participants: equalParticipants(memberIds) }
      ),
    }));
  }, [memberIds]);

  const equalSplitAll = useCallback(() => {
    setState((s) => ({
      ...s,
      lineItems: s.lineItems.map((item) => ({
        ...item,
        participants: equalParticipants(memberIds),
      })),
    }));
  }, [memberIds]);

  // ── Step 3: Payments ──────────────────────────────────────────────────────
  const setPayment = useCallback((userId: string, amountCents: number) => {
    setState((s) => ({
      ...s,
      payments: s.payments.map((p) => (p.userId === userId ? { ...p, amountCents } : p)),
    }));
  }, []);

  const setPayerFull = useCallback(
    (userId: string) => {
      setState((s) => {
        const alreadyPaid = s.payments.reduce((sum, p) => sum + p.amountCents, 0);
        const remaining = Math.max(0, s.totalCents - alreadyPaid + (s.payments.find((p) => p.userId === userId)?.amountCents ?? 0));
        return {
          ...s,
          payments: s.payments.map((p) =>
            p.userId === userId ? { ...p, amountCents: remaining } : p
          ),
        };
      });
    },
    []
  );

  // ── Live balance preview ─────────────────────────────────────────────────
  const getBalancePreview = useCallback((): BillBalanceResult | null => {
    try {
      return calculateBillBalances({
        totalCents: state.totalCents,
        subtotalCents: state.subtotalCents,
        taxCents: state.taxCents,
        tipCents: state.tipCents,
        lineItems: state.lineItems.map((item) => {
          const totalParts = item.participants.reduce((s, p) => s + p.parts, 0);
          return {
            id: item.id,
            name: item.name,
            totalCents: item.totalCents,
            fractions: item.participants
              .filter((p) => p.parts > 0 && totalParts > 0)
              .map((p) => ({
                userId: p.userId,
                fraction: partsToFraction(p.parts, totalParts),
              })),
          };
        }),
        payments: state.payments,
      });
    } catch {
      return null;
    }
  }, [state]);

  // ── Derived output (what createBill needs) ───────────────────────────────
  const toBillInput = useCallback(() => {
    return {
      lineItems: state.lineItems.map((item) => {
        const totalParts = item.participants.reduce((s, p) => s + p.parts, 0);
        return {
          name: item.name || "Item",
          quantity: item.quantity,
          unitCents: item.unitCents,
          totalCents: item.totalCents,
          fractions: item.participants
            .filter((p) => p.parts > 0 && totalParts > 0)
            .map((p) => ({
              userId: p.userId,
              numerator: p.parts,
              denominator: totalParts,
            })),
        };
      }),
      payments: state.payments.filter((p) => p.amountCents > 0),
    };
  }, [state]);

  const totalPaid = state.payments.reduce((s, p) => s + p.amountCents, 0);
  const remainingCents = state.totalCents - totalPaid;

  return {
    state,
    next,
    back,
    // Step 1
    applyOCRResult,
    skipToManual,
    // Step 2
    setEstablishmentName,
    updateItem,
    addItem,
    removeItem,
    updateTaxTip,
    setParticipantParts,
    equalSplitItem,
    equalSplitAll,
    // Step 3
    setPayment,
    setPayerFull,
    remainingCents,
    getBalancePreview,
    toBillInput,
    canSubmit: remainingCents === 0 && state.totalCents > 0,
  };
}
