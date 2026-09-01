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

type GetExpensesParams = {
  q?: string;
  page: number;
  perPage: number;
};

export async function getExpenses({ q, page, perPage }: GetExpensesParams) {
  const where: Prisma.ExpenseWhereInput = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { reference: { contains: q } },
            { title: { contains: q } },
            { warehouse: { name: { contains: q } } },
            { category: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  // Interactive transaction so the count and the findMany run together
  // (consistent snapshot) while still letting the count clamp an
  // out-of-range page before it's used to compute "skip" — a stale
  // bookmark or hand-edited URL otherwise produces a "skip" past the end
  // of the result set and a nonsensical range display.
  const { expenses, total, page: safePage } = await dbPrisma.$transaction(async (tx) => {
    const total = await tx.expense.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const expenses = await tx.expense.findMany({
      where,
      include: {
        warehouse: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * perPage,
      take: perPage,
    });

    return { expenses, total, page: safePage };
  });

  return { expenses, total, page: safePage };
}

export async function getWarehouseOptions() {
  return dbPrisma.warehouse.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
}

export async function getExpenseCategoryOptions() {
  return dbPrisma.expenseCategory.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
}

export async function getExpenseById(id: string) {
  return dbPrisma.expense.findFirst({ where: { id, deletedAt: null } });
}
