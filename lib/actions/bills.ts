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
  tipCents: z.number().int().nonnegative(),       // service tax
  gratuityCents: z.number().int().nonnegative().default(0), // tip
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
    gratuityCents: data.gratuityCents,
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
        gratuityCents: data.gratuityCents,
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
// Fetch a bill for editing
// ---------------------------------------------------------------------------

export async function getBillForEdit(billId: string) {
  const user = await requireUser();

  const bill = await prisma.bill.findFirst({
    where: {
      id: billId,
      establishment: { event: { participants: { some: { userId: user.id } } } },
    },
    include: {
      establishment: { select: { id: true, name: true, eventId: true } },
      lineItems: {
        include: { fractions: { select: { userId: true, numerator: true, denominator: true } } },
      },
      payments: { select: { userId: true, amountCents: true } },
    },
  });

  if (!bill) redirect("/dashboard");
  return bill;
}

// ---------------------------------------------------------------------------
// Update an existing bill (replace line items + payments atomically)
// ---------------------------------------------------------------------------

const UpdateBillSchema = z.object({
  billId: z.string(),
  establishmentName: z.string().min(1).max(120),
  subtotalCents: z.number().int().nonnegative(),
  taxCents: z.number().int().nonnegative(),
  tipCents: z.number().int().nonnegative(),
  gratuityCents: z.number().int().nonnegative().default(0),
  totalCents: z.number().int().positive(),
  lineItems: z.array(LineItemSchema).min(1),
  payments: z.array(PaymentSchema).min(1),
});

export type UpdateBillInput = z.infer<typeof UpdateBillSchema>;

export async function updateBill(input: UpdateBillInput) {
  const user = await requireUser();
  const data = UpdateBillSchema.parse(input);

  const bill = await prisma.bill.findFirst({
    where: {
      id: data.billId,
      establishment: { event: { participants: { some: { userId: user.id } } } },
    },
    include: { establishment: { select: { eventId: true } } },
  });
  if (!bill) throw new Error("Bill not found or access denied");

  const eventId = bill.establishment.eventId;

  await prisma.$transaction(async (tx) => {
    // Update establishment name
    await tx.establishment.update({
      where: { id: bill.establishmentId },
      data: { name: data.establishmentName },
    });

    // Delete & recreate line items (fractions cascade-delete automatically)
    await tx.lineItem.deleteMany({ where: { billId: data.billId } });
    await tx.payment.deleteMany({ where: { billId: data.billId } });

    await tx.bill.update({
      where: { id: data.billId },
      data: {
        subtotalCents: data.subtotalCents,
        taxCents: data.taxCents,
        tipCents: data.tipCents,
        gratuityCents: data.gratuityCents,
        totalCents: data.totalCents,
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
            .map((p) => ({ userId: p.userId, amountCents: p.amountCents })),
        },
      },
    });
  });

  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
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
  paidById: z.string().cuid().optional(),
  splits: z.array(FractionSchema).min(1),
});

export async function createDirectExpense(input: z.infer<typeof CreateDirectExpenseSchema>) {
  const user = await requireUser();
  const data = CreateDirectExpenseSchema.parse(input);

  await prisma.directExpense.create({
    data: {
      groupId: data.groupId,
      eventId: data.eventId,
      paidById: data.paidById ?? user.id,
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

// ---------------------------------------------------------------------------
// Update direct expense (description + amount only; splits unchanged)
// ---------------------------------------------------------------------------

export async function updateDirectExpense(
  expenseId: string,
  data: { description: string; totalCents: number }
) {
  const user = await requireUser();

  const expense = await prisma.directExpense.findFirst({
    where: { id: expenseId, paidById: user.id },
    select: { id: true },
  });
  if (!expense) throw new Error("Expense not found or access denied");

  const desc = data.description.trim();
  if (!desc) throw new Error("Description is required");
  if (data.totalCents <= 0) throw new Error("Amount must be positive");

  await prisma.directExpense.update({
    where: { id: expenseId },
    data: { description: desc, totalCents: data.totalCents },
  });

  revalidatePath("/dashboard");
  revalidatePath("/people");
}

// ---------------------------------------------------------------------------
// Delete direct expense
// ---------------------------------------------------------------------------

export async function deleteDirectExpense(expenseId: string) {
  const user = await requireUser();

  // Allow deletion if the current user is the payer OR a split participant
  const expense = await prisma.directExpense.findFirst({
    where: {
      id: expenseId,
      OR: [
        { paidById: user.id },
        { splits: { some: { userId: user.id } } },
      ],
    },
    select: { id: true },
  });
  if (!expense) throw new Error("Expense not found or access denied");

  await prisma.directExpense.delete({ where: { id: expenseId } });

  revalidatePath("/dashboard");
  revalidatePath("/people");
}
