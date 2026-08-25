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

type GetCustomersParams = {
  q?: string;
  page: number;
  perPage: number;
};

export async function getCustomers({ q, page, perPage }: GetCustomersParams) {
  const where: Prisma.CustomerWhereInput = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { phoneNumber: { contains: q } },
          ],
        }
      : {}),
  };

  // Interactive transaction so the count and the findMany run together
  // (consistent snapshot) while still letting the count clamp an
  // out-of-range page before it's used to compute "skip" — a stale
  // bookmark or hand-edited URL otherwise produces a "skip" past the end
  // of the result set and a nonsensical range display.
  const { customers, total, page: safePage } = await dbPrisma.$transaction(async (tx) => {
    const total = await tx.customer.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const customers = await tx.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * perPage,
      take: perPage,
    });

    return { customers, total, page: safePage };
  });

  return { customers, total, page: safePage };
}

export async function getCustomerById(id: string) {
  return dbPrisma.customer.findFirst({ where: { id, deletedAt: null } });
}

// TODO: once Sale/Quotation models exist and reference Customer, check for
// related records here (e.g. dbPrisma.sale.count({ where: { customerId: id } }))
// and return true if any exist. Until those models are built there's nothing
// to check against, so every non-default customer is currently deletable —
// but the delete action already calls this seam, so wiring up the real check
// later only means editing this one function.
export async function isCustomerInUse(id: string): Promise<boolean> {
  void id;
  return false;
}
