import Decimal from "decimal.js";

// Shared by Purchases (and, later, Sales — see AGENTS.md) so both modules
// compute money the same way, including live, client-side recalculation as
// a form's inputs change (see Step 4's per-line modal and totals box) — so
// this file has to be safe to import from a "use client" component, not
// just from server code. That's why this imports the standalone "decimal.js"
// package rather than "@prisma/client/runtime/library": the latter bundles
// Prisma's entire Node-only runtime (color libraries, `node:os`, `node:tty`,
// etc.) and crashes Turbopack's client chunker the moment anything pulls it
// into a client bundle. "decimal.js" is the same library Prisma's Decimal
// is built on (pinned to the exact version @prisma/client itself uses), but
// pure JS with no Node built-ins — safe in both places. Server call sites
// that already hold a Prisma Decimal (e.g. `product.price`) must pass it in
// as `.toString()`, not the raw instance — it's a different class from a
// different package, so it won't structurally match this Decimal.
//
// All money in and out is Decimal, never float, per the project's core
// rule.

export type DiscountType = "FIXED" | "PERCENTAGE";
export type TaxType = "EXCLUSIVE" | "INCLUSIVE";

function round2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2);
}

export type LineTotalsInput = {
  unitCost: Decimal.Value;
  quantity: number;
  discountType: DiscountType;
  discount: Decimal.Value;
  taxType: TaxType;
  taxRate: Decimal.Value;
};

export type LineTotals = {
  /** Total discount taken off this line (unit discount x quantity). */
  discountAmount: Decimal;
  /** Total tax portion of this line (unit tax x quantity) — informational; already folded into `subtotal`. */
  taxAmount: Decimal;
  /** What this line contributes to the order — unit cost, minus discount, plus/inclusive of tax, x quantity. */
  subtotal: Decimal;
};

// A line's discount and tax are both computed per unit (against the entered
// Net Unit Cost) and then multiplied by quantity — matching the per-line
// edit modal on design/Create Purchase.html, which edits one unit's cost,
// discount, and tax at a time.
//
// Exclusive tax is added on top of the discounted unit cost. Inclusive tax
// means the entered unit cost already contains the tax, so the unit price
// doesn't change — only the tax portion is broken back out of it.
export function calculateLineTotals({
  unitCost,
  quantity,
  discountType,
  discount,
  taxType,
  taxRate,
}: LineTotalsInput): LineTotals {
  const cost = new Decimal(unitCost);
  const qty = new Decimal(quantity);
  const discountValue = new Decimal(discount);
  const rate = new Decimal(taxRate);

  const discountPerUnit = discountType === "PERCENTAGE" ? cost.times(discountValue).div(100) : discountValue;
  const priceAfterDiscount = Decimal.max(0, cost.minus(discountPerUnit));

  let unitPriceIncTax: Decimal;
  let taxPerUnit: Decimal;
  if (taxType === "EXCLUSIVE") {
    taxPerUnit = priceAfterDiscount.times(rate).div(100);
    unitPriceIncTax = priceAfterDiscount.plus(taxPerUnit);
  } else {
    unitPriceIncTax = priceAfterDiscount;
    taxPerUnit = priceAfterDiscount.minus(priceAfterDiscount.div(rate.div(100).plus(1)));
  }

  return {
    discountAmount: round2(discountPerUnit.times(qty)),
    taxAmount: round2(taxPerUnit.times(qty)),
    subtotal: round2(unitPriceIncTax.times(qty)),
  };
}

export type OrderTotalsInput = {
  lineSubtotals: Decimal.Value[];
  /** Order-level tax, as a percentage applied to the summed line subtotals. */
  orderTaxRate: Decimal.Value;
  /** Order-level discount, as a flat dollar amount. */
  discount: Decimal.Value;
  /** Order-level shipping, as a flat dollar amount. */
  shipping: Decimal.Value;
};

export type OrderTotals = {
  /** Sum of every line's subtotal, before order-level tax/discount/shipping. */
  itemsTotal: Decimal;
  orderTaxAmount: Decimal;
  grandTotal: Decimal;
};

// itemsTotal + orderTax% of itemsTotal - discount + shipping.
export function calculateOrderTotals({
  lineSubtotals,
  orderTaxRate,
  discount,
  shipping,
}: OrderTotalsInput): OrderTotals {
  const itemsTotal = round2(
    lineSubtotals.reduce((sum: Decimal, value) => sum.plus(new Decimal(value)), new Decimal(0)),
  );
  const orderTaxAmount = round2(itemsTotal.times(new Decimal(orderTaxRate)).div(100));
  const grandTotal = round2(itemsTotal.plus(orderTaxAmount).minus(new Decimal(discount)).plus(new Decimal(shipping)));

  return { itemsTotal, orderTaxAmount, grandTotal };
}
