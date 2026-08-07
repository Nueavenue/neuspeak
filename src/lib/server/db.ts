import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { env } from '$env/dynamic/private';
import { PrismaClient } from './generated/prisma/client';

// Avoid creating a new PrismaClient (and a new SQLite connection) on every
// Vite HMR reload in dev by caching it on the global object.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prisma 7 requires an explicit driver adapter for every database, including
// SQLite. Swap this adapter (and the schema's datasource provider) to switch
// to Postgres for production.
const adapter = new PrismaBetterSqlite3({ url: env.DATABASE_URL || 'file:./dev.db' });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}
