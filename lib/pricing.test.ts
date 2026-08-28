import { test } from "node:test";
import assert from "node:assert/strict";
import Decimal from "decimal.js";
import { calculateLineTotals, calculateOrderTotals } from "./pricing";

function d(value: Decimal) {
  return value.toFixed(2);
}

test("calculateLineTotals: no discount, no tax", () => {
  const { subtotal, discountAmount, taxAmount } = calculateLineTotals({
    unitCost: "493.00",
    quantity: 10,
    discountType: "FIXED",
    discount: 0,
    taxType: "EXCLUSIVE",
    taxRate: 0,
  });

  assert.equal(d(subtotal), "4930.00");
  assert.equal(d(discountAmount), "0.00");
  assert.equal(d(taxAmount), "0.00");
});

test("calculateLineTotals: fixed discount per unit", () => {
  const { subtotal, discountAmount } = calculateLineTotals({
    unitCost: 100,
    quantity: 2,
    discountType: "FIXED",
    discount: 10,
    taxType: "EXCLUSIVE",
    taxRate: 0,
  });

  // (100 - 10) * 2
  assert.equal(d(subtotal), "180.00");
  assert.equal(d(discountAmount), "20.00");
});

test("calculateLineTotals: percentage discount per unit", () => {
  const { subtotal, discountAmount } = calculateLineTotals({
    unitCost: 100,
    quantity: 2,
    discountType: "PERCENTAGE",
    discount: 10,
    taxType: "EXCLUSIVE",
    taxRate: 0,
  });

  // (100 - 10%) * 2
  assert.equal(d(subtotal), "180.00");
  assert.equal(d(discountAmount), "20.00");
});

test("calculateLineTotals: exclusive tax is added on top of the discounted price", () => {
  const { subtotal, taxAmount, unitCostAfterAdjustments } = calculateLineTotals({
    unitCost: 100,
    quantity: 1,
    discountType: "FIXED",
    discount: 0,
    taxType: "EXCLUSIVE",
    taxRate: 10,
  });

  // 100 + 10% tax
  assert.equal(d(subtotal), "110.00");
  assert.equal(d(taxAmount), "10.00");
  assert.equal(d(unitCostAfterAdjustments), "110.00");
});

test("calculateLineTotals: unitCostAfterAdjustments reflects a multi-unit line's per-unit price", () => {
  // design/Purchase Details.html's "Unit Cost" column — distinct from
  // "Net Unit Cost" once a discount or tax actually changes the per-unit
  // price. subtotal / quantity should recover the same figure.
  const { unitCostAfterAdjustments, subtotal } = calculateLineTotals({
    unitCost: 100,
    quantity: 4,
    discountType: "PERCENTAGE",
    discount: 10,
    taxType: "EXCLUSIVE",
    taxRate: 10,
  });

  // (100 - 10%) = 90, + 10% tax = 99
  assert.equal(d(unitCostAfterAdjustments), "99.00");
  assert.equal(d(subtotal), "396.00");
});

test("calculateLineTotals: inclusive tax is already baked into unit cost", () => {
  const { subtotal, taxAmount } = calculateLineTotals({
    unitCost: 110,
    quantity: 1,
    discountType: "FIXED",
    discount: 0,
    taxType: "INCLUSIVE",
    taxRate: 10,
  });

  // unit cost already includes the 10% tax, so the line total doesn't change,
  // but the tax portion is still broken out: 110 - 110/1.10 = 10.00
  assert.equal(d(subtotal), "110.00");
  assert.equal(d(taxAmount), "10.00");
});

test("calculateLineTotals: inclusive tax combined with a percentage discount", () => {
  // Discount is applied to the (still tax-inclusive) unit cost first, then
  // the tax portion of what's left is broken out — matches how the Create
  // Purchase modal always discounts/taxes the same "Net Unit Cost" field
  // regardless of which tax type is chosen.
  const { subtotal, discountAmount, taxAmount } = calculateLineTotals({
    unitCost: 110,
    quantity: 2,
    discountType: "PERCENTAGE",
    discount: 10,
    taxType: "INCLUSIVE",
    taxRate: 10,
  });

  // priceAfterDiscount = 110 - 11 = 99; unitPriceIncTax stays 99 (inclusive)
  assert.equal(d(subtotal), "198.00");
  assert.equal(d(discountAmount), "22.00");
  // tax portion of 99 at 10%, per unit: 99 - 99/1.10 = 9.00, x2 units = 18.00
  assert.equal(d(taxAmount), "18.00");
});

test("calculateLineTotals: discount can't push the line below zero", () => {
  const { subtotal, discountAmount } = calculateLineTotals({
    unitCost: 50,
    quantity: 1,
    discountType: "FIXED",
    discount: 999,
    taxType: "EXCLUSIVE",
    taxRate: 0,
  });

  assert.equal(d(subtotal), "0.00");
  assert.equal(d(discountAmount), "999.00");
});

test("calculateLineTotals: rounds to 2 decimal places", () => {
  const { subtotal } = calculateLineTotals({
    unitCost: 10,
    quantity: 3,
    discountType: "PERCENTAGE",
    discount: 33.33,
    taxType: "EXCLUSIVE",
    taxRate: 0,
  });

  // unit price after discount: 10 - 3.333 = 6.667 (rounds to 6.667 internally)
  // 6.667 * 3 = 20.001 -> rounds to 20.00
  assert.equal(d(subtotal), "20.00");
});

test("calculateOrderTotals: matches design/Create Purchase.html's worked example", () => {
  // Two lines: $493.00 x1 and $1,110.00 x1, no order tax/discount/shipping.
  const { itemsTotal, grandTotal } = calculateOrderTotals({
    lineSubtotals: ["493.00", "1110.00"],
    orderTaxRate: 0,
    discount: 0,
    shipping: 0,
  });

  assert.equal(d(itemsTotal), "1603.00");
  assert.equal(d(grandTotal), "1603.00");
});

test("calculateOrderTotals: applies order tax, discount, and shipping", () => {
  const { itemsTotal, orderTaxAmount, grandTotal } = calculateOrderTotals({
    lineSubtotals: ["1000.00"],
    orderTaxRate: 10,
    discount: 50,
    shipping: 20,
  });

  assert.equal(d(itemsTotal), "1000.00");
  assert.equal(d(orderTaxAmount), "100.00");
  // 1000 + 100 (tax) - 50 (discount) + 20 (shipping)
  assert.equal(d(grandTotal), "1070.00");
});

test("calculateOrderTotals: sums an arbitrary number of lines", () => {
  const { itemsTotal } = calculateOrderTotals({
    lineSubtotals: ["10.10", "20.20", "30.30"],
    orderTaxRate: 0,
    discount: 0,
    shipping: 0,
  });

  assert.equal(d(itemsTotal), "60.60");
});
