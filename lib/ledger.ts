/**
 * Ledger Engine — Bill balance calculations for Splitkaro.
 *
 * All monetary values are in integer CENTS throughout.
 * Fractions are exact rationals (numerator / denominator).
 * Penny allocation uses the Largest Remainder Method so that
 * SUM of all user shares always equals the bill total exactly.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface Fraction {
  numerator: number;
  denominator: number;
}

export interface LineItemInput {
  id: string;
  name: string;
  totalCents: number; // price of this item (all units combined), in cents
  fractions: Array<{
    userId: string;
    fraction: Fraction; // what share of this item the user consumed
  }>;
}

export interface PaymentInput {
  userId: string;
  amountCents: number; // physical payment made to the vendor
}

export interface BillInput {
  totalCents: number;     // grand total of the bill (subtotal + tax + serviceTax + tip)
  subtotalCents: number;  // items-only subtotal (used to pro-rate overhead)
  taxCents: number;
  tipCents: number;        // service tax
  gratuityCents?: number;  // tip / gratuity (optional for backward compat)
  lineItems: LineItemInput[];
  payments: PaymentInput[];
}

export interface UserBalance {
  userId: string;
  owedCents: number;  // total the user SHOULD pay (their consumption share)
  paidCents: number;  // total the user DID pay (physical payment)
  /** netCents > 0 → others owe this user; netCents < 0 → this user owes others */
  netCents: number;
}

export interface BillBalanceResult {
  userBalances: UserBalance[];
  /** Minimal set of transfers to settle all debts */
  settlements: Settlement[];
  /** True when SUM(payments) matches bill.totalCents */
  paymentsBalanced: boolean;
  /** True when all line-item fractions sum to 1 */
  fractionsBalanced: boolean;
}

export interface Settlement {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
}

// ---------------------------------------------------------------------------
// Core calculation
// ---------------------------------------------------------------------------

export function calculateBillBalances(bill: BillInput): BillBalanceResult {
  const { totalCents, subtotalCents, taxCents, tipCents, gratuityCents = 0, lineItems, payments } = bill;

  const overheadCents = taxCents + tipCents + gratuityCents; // distributed proportionally

  // 1. Accumulate each user's raw consumption share of line-item subtotals.
  //    We use exact rational arithmetic until the final rounding step.
  const rawSubtotalByUser = new Map<string, number>(); // userId → exact cents (may be fractional)

  for (const item of lineItems) {
    // Validate fractions sum to 1 (numerators/denominator-normalized)
    const fractionSum = item.fractions.reduce(
      (acc, f) => acc + f.fraction.numerator / f.fraction.denominator,
      0
    );
    // Allow 0.001 tolerance for floating accumulation
    if (Math.abs(fractionSum - 1) > 0.001) {
      throw new Error(
        `Line item "${item.name}" fractions sum to ${fractionSum.toFixed(4)}, expected 1.0`
      );
    }

    for (const { userId, fraction } of item.fractions) {
      // item share in exact rational form → float cents (not yet rounded)
      const shareCents = (item.totalCents * fraction.numerator) / fraction.denominator;
      rawSubtotalByUser.set(userId, (rawSubtotalByUser.get(userId) ?? 0) + shareCents);
    }
  }

  // 2. Round subtotal shares using Largest Remainder Method so they sum to subtotalCents exactly.
  const subtotalByUser = largestRemainderRound(rawSubtotalByUser, subtotalCents);

  // 3. Distribute overhead (tax + tip) proportionally to each user's subtotal share.
  //    The proportion is user_subtotal / total_subtotal.
  //    Again use Largest Remainder so rounded overhead sums to overheadCents exactly.
  const rawOverheadByUser = new Map<string, number>();
  if (overheadCents > 0 && subtotalCents > 0) {
    for (const [userId, userSubtotal] of subtotalByUser) {
      rawOverheadByUser.set(userId, (userSubtotal / subtotalCents) * overheadCents);
    }
  }
  const overheadByUser =
    overheadCents > 0
      ? largestRemainderRound(rawOverheadByUser, overheadCents)
      : new Map<string, number>();

  // 4. Total owed per user = subtotal share + overhead share.
  const owedByUser = new Map<string, number>();
  for (const userId of subtotalByUser.keys()) {
    owedByUser.set(
      userId,
      (subtotalByUser.get(userId) ?? 0) + (overheadByUser.get(userId) ?? 0)
    );
  }

  // 5. Aggregate physical payments per user.
  const paidByUser = new Map<string, number>();
  for (const { userId, amountCents } of payments) {
    paidByUser.set(userId, (paidByUser.get(userId) ?? 0) + amountCents);
  }

  // 6. Collect all user IDs (some may only appear in payments, not fractions).
  const allUserIds = new Set([...owedByUser.keys(), ...paidByUser.keys()]);

  const userBalances: UserBalance[] = [];
  for (const userId of allUserIds) {
    const owedCents = owedByUser.get(userId) ?? 0;
    const paidCents = paidByUser.get(userId) ?? 0;
    userBalances.push({ userId, owedCents, paidCents, netCents: paidCents - owedCents });
  }

  // 7. Validation flags.
  const totalPaid = payments.reduce((s, p) => s + p.amountCents, 0);
  const paymentsBalanced = totalPaid === totalCents;

  const fractionsBalanced = lineItems.every((item) => {
    const sum = item.fractions.reduce(
      (acc, f) => acc + f.fraction.numerator / f.fraction.denominator,
      0
    );
    return Math.abs(sum - 1) <= 0.001;
  });

  // 8. Compute minimal settlements.
  const settlements = minimalSettlements(userBalances);

  return { userBalances, settlements, paymentsBalanced, fractionsBalanced };
}

// ---------------------------------------------------------------------------
// Largest Remainder Method
// Rounds a map of {userId → float cents} to integers while preserving the target sum.
// ---------------------------------------------------------------------------

function largestRemainderRound(
  rawMap: Map<string, number>,
  targetSum: number
): Map<string, number> {
  const entries = Array.from(rawMap.entries());

  // Floor each value and record the fractional remainder.
  let allocated = 0;
  const floored = entries.map(([userId, value]) => {
    const floor = Math.floor(value);
    allocated += floor;
    return { userId, floor, remainder: value - floor };
  });

  // Sort descending by remainder — top entries absorb leftover pennies.
  const leftover = targetSum - allocated;
  floored.sort((a, b) => b.remainder - a.remainder);

  const result = new Map<string, number>();
  for (let i = 0; i < floored.length; i++) {
    const { userId, floor } = floored[i];
    result.set(userId, floor + (i < leftover ? 1 : 0));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Minimal Settlements (greedy creditor-debtor matching)
// Produces the smallest number of transfers that settle all net balances.
// ---------------------------------------------------------------------------

function minimalSettlements(balances: UserBalance[]): Settlement[] {
  // Work in mutable copies
  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ userId: b.userId, amount: -b.netCents })) // positive amount owed
    .sort((a, b) => b.amount - a.amount);

  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ userId: b.userId, amount: b.netCents }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const transfer = Math.min(debtors[d].amount, creditors[c].amount);
    if (transfer > 0) {
      settlements.push({
        fromUserId: debtors[d].userId,
        toUserId: creditors[c].userId,
        amountCents: transfer,
      });
    }
    debtors[d].amount -= transfer;
    creditors[c].amount -= transfer;
    if (debtors[d].amount === 0) d++;
    if (creditors[c].amount === 0) c++;
  }

  return settlements;
}

// ---------------------------------------------------------------------------
// Helper: format cents as a display string (e.g. 4167 → "$41.67")
// ---------------------------------------------------------------------------

export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
