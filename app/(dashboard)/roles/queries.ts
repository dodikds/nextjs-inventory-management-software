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

type GetRolesParams = {
  q?: string;
  page: number;
  perPage: number;
};

export async function getRoles({ q, page, perPage }: GetRolesParams) {
  const where: Prisma.RoleWhereInput = {
    deletedAt: null,
    ...(q ? { name: { contains: q } } : {}),
  };

  // Interactive transaction so the count and the findMany run together
  // (consistent snapshot) while still letting the count clamp an
  // out-of-range page before it's used to compute "skip" — a stale
  // bookmark or hand-edited URL otherwise produces a "skip" past the end
  // of the result set and a nonsensical range display.
  const { roles, total, page: safePage } = await dbPrisma.$transaction(async (tx) => {
    const total = await tx.role.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const roles = await tx.role.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * perPage,
      take: perPage,
    });

    return { roles, total, page: safePage };
  });

  return { roles, total, page: safePage };
}

export async function getRoleById(id: string) {
  return dbPrisma.role.findFirst({ where: { id, deletedAt: null } });
}
