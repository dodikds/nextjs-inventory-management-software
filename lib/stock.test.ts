import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStockDeltas, type StockDelta } from "./stock";

function sortDeltas(deltas: StockDelta[]) {
  return [...deltas].sort((a, b) => (a.warehouseId + a.productId).localeCompare(b.warehouseId + b.productId));
}

test("computeStockDeltas: quantity increased on an already-Received line", () => {
  const deltas = computeStockDeltas({
    oldWarehouseId: "wh1",
    oldQuantities: [{ productId: "p1", quantity: 5 }],
    newWarehouseId: "wh1",
    newQuantities: [{ productId: "p1", quantity: 8 }],
  });

  assert.deepEqual(deltas, [{ productId: "p1", warehouseId: "wh1", delta: 3 }]);
});

test("computeStockDeltas: quantity decreased on an already-Received line", () => {
  const deltas = computeStockDeltas({
    oldWarehouseId: "wh1",
    oldQuantities: [{ productId: "p1", quantity: 8 }],
    newWarehouseId: "wh1",
    newQuantities: [{ productId: "p1", quantity: 5 }],
  });

  assert.deepEqual(deltas, [{ productId: "p1", warehouseId: "wh1", delta: -3 }]);
});

test("computeStockDeltas: status Received -> Pending reverses the full old contribution", () => {
  const deltas = computeStockDeltas({
    oldWarehouseId: "wh1",
    oldQuantities: [{ productId: "p1", quantity: 5 }],
    newWarehouseId: "wh1",
    // Pending doesn't contribute stock, so the caller passes no new quantities.
    newQuantities: [],
  });

  assert.deepEqual(deltas, [{ productId: "p1", warehouseId: "wh1", delta: -5 }]);
});

test("computeStockDeltas: status Pending -> Received applies the full new contribution", () => {
  const deltas = computeStockDeltas({
    oldWarehouseId: "wh1",
    // Was Pending, so it never contributed stock.
    oldQuantities: [],
    newWarehouseId: "wh1",
    newQuantities: [{ productId: "p1", quantity: 5 }],
  });

  assert.deepEqual(deltas, [{ productId: "p1", warehouseId: "wh1", delta: 5 }]);
});

test("computeStockDeltas: staying Pending the whole time produces no deltas at all", () => {
  const deltas = computeStockDeltas({
    oldWarehouseId: "wh1",
    oldQuantities: [],
    newWarehouseId: "wh1",
    newQuantities: [],
  });

  assert.deepEqual(deltas, []);
});

test("computeStockDeltas: no-op edit (same warehouse, same quantities) produces no deltas", () => {
  const deltas = computeStockDeltas({
    oldWarehouseId: "wh1",
    oldQuantities: [{ productId: "p1", quantity: 5 }],
    newWarehouseId: "wh1",
    newQuantities: [{ productId: "p1", quantity: 5 }],
  });

  assert.deepEqual(deltas, []);
});

test("computeStockDeltas: a line removed entirely nets to a pure negative", () => {
  const deltas = computeStockDeltas({
    oldWarehouseId: "wh1",
    oldQuantities: [
      { productId: "p1", quantity: 5 },
      { productId: "p2", quantity: 4 },
    ],
    newWarehouseId: "wh1",
    newQuantities: [{ productId: "p1", quantity: 5 }],
  });

  assert.deepEqual(deltas, [{ productId: "p2", warehouseId: "wh1", delta: -4 }]);
});

test("computeStockDeltas: a line added entirely nets to a pure positive", () => {
  const deltas = computeStockDeltas({
    oldWarehouseId: "wh1",
    oldQuantities: [{ productId: "p1", quantity: 5 }],
    newWarehouseId: "wh1",
    newQuantities: [
      { productId: "p1", quantity: 5 },
      { productId: "p2", quantity: 2 },
    ],
  });

  assert.deepEqual(deltas, [{ productId: "p2", warehouseId: "wh1", delta: 2 }]);
});

test("computeStockDeltas: warehouse changed produces two separate deltas, not a net", () => {
  const deltas = sortDeltas(
    computeStockDeltas({
      oldWarehouseId: "wh1",
      oldQuantities: [{ productId: "p1", quantity: 5 }],
      newWarehouseId: "wh2",
      newQuantities: [{ productId: "p1", quantity: 5 }],
    }),
  );

  assert.deepEqual(deltas, [
    { productId: "p1", warehouseId: "wh1", delta: -5 },
    { productId: "p1", warehouseId: "wh2", delta: 5 },
  ]);
});

test("computeStockDeltas: warehouse changed together with a quantity change", () => {
  const deltas = sortDeltas(
    computeStockDeltas({
      oldWarehouseId: "wh1",
      oldQuantities: [{ productId: "p1", quantity: 5 }],
      newWarehouseId: "wh2",
      newQuantities: [{ productId: "p1", quantity: 9 }],
    }),
  );

  assert.deepEqual(deltas, [
    { productId: "p1", warehouseId: "wh1", delta: -5 },
    { productId: "p1", warehouseId: "wh2", delta: 9 },
  ]);
});

test("computeStockDeltas: multiple products, mixed increases and decreases", () => {
  const deltas = sortDeltas(
    computeStockDeltas({
      oldWarehouseId: "wh1",
      oldQuantities: [
        { productId: "p1", quantity: 10 },
        { productId: "p2", quantity: 3 },
      ],
      newWarehouseId: "wh1",
      newQuantities: [
        { productId: "p1", quantity: 4 },
        { productId: "p2", quantity: 3 },
        { productId: "p3", quantity: 7 },
      ],
    }),
  );

  assert.deepEqual(deltas, [
    { productId: "p1", warehouseId: "wh1", delta: -6 },
    { productId: "p3", warehouseId: "wh1", delta: 7 },
  ]);
});
