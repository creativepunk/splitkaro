import { Metadata } from "next";
import { getBillForEdit } from "@/lib/actions/bills";
import { getEvent } from "@/lib/actions/events";
import { EditBillClient } from "./EditBillClient";
import type { InitialBillData, WizardLineItem } from "@/components/bill-wizard/useBillWizard";

export const metadata: Metadata = { title: "Edit Bill" };

export default async function EditBillPage({
  params,
}: {
  params: { eventId: string; billId: string };
}) {
  const [bill, event] = await Promise.all([
    getBillForEdit(params.billId),
    getEvent(params.eventId),
  ]);

  const participants = event.participants.map((p) => ({
    id: p.userId,
    name: p.user.name ?? "Unknown",
    image: p.user.image,
  }));

  // Build initialData for the wizard — map DB fractions to WizardLineItem parts
  const lineItems: WizardLineItem[] = bill.lineItems.map((item) => {
    // Convert fractions to equal-parts representation
    // Use the denominator from first fraction, fall back to participant count
    const denom = item.fractions[0]?.denominator ?? participants.length;

    // Build a parts map from stored fractions
    const partsMap = new Map(item.fractions.map((f) => [f.userId, f.numerator]));

    return {
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitCents: item.unitCents,
      totalCents: item.totalCents,
      participants: participants.map((p) => ({
        userId: p.id,
        parts: partsMap.get(p.id) ?? 0,
      })),
    };
  });

  // Build payments — zero out anyone not in the DB record
  const paymentsMap = new Map(bill.payments.map((p) => [p.userId, p.amountCents]));
  const payments = participants.map((p) => ({
    userId: p.id,
    amountCents: paymentsMap.get(p.id) ?? 0,
  }));

  const initialData: InitialBillData = {
    establishmentName: bill.establishment.name,
    lineItems,
    subtotalCents: bill.subtotalCents,
    taxCents: bill.taxCents,
    tipCents: bill.tipCents,
    gratuityCents: bill.gratuityCents,
    totalCents: bill.totalCents,
    payments,
  };

  return (
    <EditBillClient
      billId={params.billId}
      participants={participants}
      initialData={initialData}
    />
  );
}
