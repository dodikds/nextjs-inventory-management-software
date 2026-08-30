import type { Prisma } from "@prisma/client";
import { dbPrisma } from "@/lib/db";

export const PER_PAGE_OPTIONS = [10, 25, 50] as const;
export const DEFAULT_PER_PAGE: (typeof PER_PAGE_OPTIONS)[number] = 10;

export function parsePerPage(value: string | undefined): (typeof PER_PAGE_OPTIONS)[number] {
  const parsed = Number(value);
  return (PER_PAGE_OPTIONS as readonly number[]).includes(parsed)
    ? (parsed as (typeof PER_PAGE_OPTIONS)[number])
    : DEFAULT_PER_PAGE;
}

export function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

type GetTransfersParams = {
  q?: string;
  page: number;
  perPage: number;
};

// Unlike Purchases/Purchase Returns/Sales/Sale Returns, design/Transfers.html's
// toolbar has no "Select Date" field — just Search — so there's no
// parseDateFilter or `date` param here.
export async function getTransfers({ q, page, perPage }: GetTransfersParams) {
  const where: Prisma.TransferWhereInput = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { reference: { contains: q } },
            { fromWarehouse: { name: { contains: q } } },
            { toWarehouse: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  // Interactive transaction so the count and the page of rows see the same
  // consistent snapshot, and so the count can clamp an out-of-range page
  // before it's used to compute "skip" — same pattern as every other
  // module's queries.ts. design/Transfers.html has no <tfoot> "Total" row,
  // so there's no aggregate query here (same as Purchase Returns/Sale
  // Returns).
  const { transfers, total, page: safePage } = await dbPrisma.$transaction(async (tx) => {
    const total = await tx.transfer.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const transfers = await tx.transfer.findMany({
      where,
      include: {
        fromWarehouse: { select: { name: true } },
        toWarehouse: { select: { name: true } },
        // Backs the list's "Items" column — just a count, the line items
        // themselves aren't needed here.
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * perPage,
      take: perPage,
    });

    return { transfers, total, page: safePage };
  });

  return { transfers, total, page: safePage };
}

export async function getTransferById(id: string) {
  return dbPrisma.transfer.findFirst({
    where: { id, deletedAt: null },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      items: { include: { product: { select: { name: true, code: true } } } },
    },
  });
}
