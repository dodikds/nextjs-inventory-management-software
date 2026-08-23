import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  dbPrisma: PrismaClient | undefined;
};

export const dbPrisma = globalForPrisma.dbPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.dbPrisma = dbPrisma;
}
