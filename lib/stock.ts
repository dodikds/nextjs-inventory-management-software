import type { Prisma } from "@prisma/client";

// Every ProductStock mutation in this app goes through here, always inside
// the caller's own prisma.$transaction — this function never opens one of
// its own, so it composes atomically with whatever else that transaction is
// doing (creating a Purchase + its items, reconciling an edit, reversing a
// delete, ...). It only ever touches `quantity`: `status` is set once at
// product-create time (see the ProductStock model's schema comment) and
// deliberately left alone here, the same way Adjustments' own stock writes
// already do.
export async function adjustProductStock(
  tx: Prisma.TransactionClient,
  params: { productId: string; warehouseId: string; delta: number },
): Promise<void> {
  const { productId, warehouseId, delta } = params;
  if (delta === 0) return;

  const existing = await tx.productStock.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });
  const nextQuantity = (existing?.quantity ?? 0) + delta;

  await tx.productStock.upsert({
    where: { productId_warehouseId: { productId, warehouseId } },
    update: { quantity: nextQuantity },
    create: { productId, warehouseId, quantity: nextQuantity },
  });
}
