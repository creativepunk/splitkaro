"use server";

import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { calculateBillBalances } from "@/lib/ledger";
import { requireUser } from "@/lib/server-auth";

// ---------------------------------------------------------------------------
// Create establishment + bill in a single transaction
// ---------------------------------------------------------------------------

const FractionSchema = z.object({
  userId: z.string(),
  numerator: z.number().int().nonnegative(),
  denominator: z.number().int().positive(),
});

const LineItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unitCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  fractions: z.array(FractionSchema),
});

const PaymentSchema = z.object({
  userId: z.string(),
  amountCents: z.number().int().nonnegative(),
  method: z.string().optional(),
});

const CreateBillSchema = z.object({
  eventId: z.string().cuid(),
  establishmentName: z.string().min(1).max(120),
  establishmentCategory: z.string().optional(),
  subtotalCents: z.number().int().nonnegative(),
  taxCents: z.number().int().nonnegative(),
  tipCents: z.number().int().nonnegative(),
  totalCents: z.number().int().positive(),
  currency: z.string().default("USD"),
  receiptUrl: z.string().url().optional(),
  notes: z.string().max(500).optional(),
  lineItems: z.array(LineItemSchema).min(1),
  payments: z.array(PaymentSchema).min(1),
});

export type CreateBillInput = z.infer<typeof CreateBillSchema>;

export async function createBill(input: CreateBillInput) {
  const user = await requireUser();
  const data = CreateBillSchema.parse(input);

  // Verify the user is a participant of this event
  const event = await prisma.event.findFirst({
    where: {
      id: data.eventId,
      participants: { some: { userId: user.id } },
    },
    select: { id: true },
  });
  if (!event) throw new Error("Event not found or access denied");

  // Run a dry-run of the ledger to catch fraction errors before writing
  calculateBillBalances({
    totalCents: data.totalCents,
    subtotalCents: data.subtotalCents,
    taxCents: data.taxCents,
    tipCents: data.tipCents,
    lineItems: data.lineItems.map((item) => ({
      id: "dry",
      name: item.name,
      totalCents: item.totalCents,
      fractions: item.fractions.map((f) => ({
        userId: f.userId,
        fraction: { numerator: f.numerator, denominator: f.denominator },
      })),
    })),
    payments: data.payments,
  });

  // Write everything atomically
  await prisma.$transaction(async (tx) => {
    const establishment = await tx.establishment.create({
      data: {
        eventId: data.eventId,
        name: data.establishmentName,
        category: data.establishmentCategory,
      },
    });

    const bill = await tx.bill.create({
      data: {
        establishmentId: establishment.id,
        subtotalCents: data.subtotalCents,
        taxCents: data.taxCents,
        tipCents: data.tipCents,
        totalCents: data.totalCents,
        currency: data.currency,
        receiptUrl: data.receiptUrl,
        notes: data.notes,
        lineItems: {
          create: data.lineItems.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitCents: item.unitCents,
            totalCents: item.totalCents,
            fractions: {
              create: item.fractions
                .filter((f) => f.numerator > 0)
                .map((f) => ({
                  userId: f.userId,
                  numerator: f.numerator,
                  denominator: f.denominator,
                })),
            },
          })),
        },
        payments: {
          create: data.payments
            .filter((p) => p.amountCents > 0)
            .map((p) => ({
              userId: p.userId,
              amountCents: p.amountCents,
              method: p.method,
            })),
        },
      },
    });

    return bill;
  });

  revalidatePath(`/events/${data.eventId}`);
  redirect(`/events/${data.eventId}`);
}

// ---------------------------------------------------------------------------
// Create direct expense
// ---------------------------------------------------------------------------

const CreateDirectExpenseSchema = z.object({
  groupId: z.string().cuid().optional(),
  eventId: z.string().cuid().optional(),
  description: z.string().min(1).max(200),
  totalCents: z.number().int().positive(),
  currency: z.string().default("USD"),
  splits: z.array(FractionSchema).min(1),
});

export async function createDirectExpense(input: z.infer<typeof CreateDirectExpenseSchema>) {
  const user = await requireUser();
  const data = CreateDirectExpenseSchema.parse(input);

  await prisma.directExpense.create({
    data: {
      groupId: data.groupId,
      eventId: data.eventId,
      paidById: user.id,
      description: data.description,
      totalCents: data.totalCents,
      currency: data.currency,
      splits: {
        create: data.splits.map((s) => ({
          userId: s.userId,
          numerator: s.numerator,
          denominator: s.denominator,
        })),
      },
    },
  });

  if (data.groupId) {
    revalidatePath(`/groups/${data.groupId}`);
    redirect(`/groups/${data.groupId}`);
  } else if (data.eventId) {
    revalidatePath(`/events/${data.eventId}`);
    redirect(`/events/${data.eventId}`);
  } else {
    revalidatePath("/dashboard");
    redirect("/dashboard");
  }
}
