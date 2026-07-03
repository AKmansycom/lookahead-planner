import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Supabase's session-mode pooler caps this project at 15 total connections,
// shared across every concurrent serverless instance plus local dev. Each
// instance would otherwise default to node-postgres's own max of 10 — easily
// exhausted by just two concurrent requests. Cap it low, and release idle
// connections quickly since serverless instances don't stay warm for long.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 10_000,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
