"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BillSplitterWizard } from "@/components/bill-wizard/BillSplitterWizard";
import { createBill } from "@/lib/actions/bills";
import type { useBillWizard } from "@/components/bill-wizard/useBillWizard";

interface Props {
  eventId: string;
  participants: Array<{ id: string; name: string; image?: string | null }>;
}

export function BillWizardClient({ eventId, participants }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleComplete = async (wizard: ReturnType<typeof useBillWizard>) => {
    setSubmitting(true);
    setError(null);
    const { state, toBillInput } = wizard;
    const { lineItems, payments } = toBillInput();

    try {
      await createBill({
        eventId,
        establishmentName: state.establishmentName || "Unknown",
        currency: "USD",
        subtotalCents: state.subtotalCents,
        taxCents: state.taxCents,
        tipCents: state.tipCents,
        gratuityCents: state.gratuityCents,
        totalCents: state.totalCents,
        receiptUrl: state.receiptBlobUrl || undefined,
        lineItems,
        payments,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save bill");
      setSubmitting(false);
    }
  };

  if (submitting) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <div className="flex flex-col items-center gap-3">
          <svg className="h-8 w-8 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-sm text-zinc-500">Saving bill…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-sm text-center px-4 py-2">
          {error}
        </div>
      )}
      <BillSplitterWizard
        participants={participants}
        onComplete={handleComplete}
        onCancel={() => router.push(`/events/${eventId}`)}
      />
    </>
  );
}
