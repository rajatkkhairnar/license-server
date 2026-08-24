const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@libsql/client');
const { PrismaLibSQL } = require('@prisma/adapter-libsql');

let prisma;

if (!process.env.TURSO_DATABASE_URL) {
  console.warn('TURSO_DATABASE_URL not found. Prisma will connect locally or fail if not configured correctly.');
}

if (process.env.TURSO_DATABASE_URL) {
  const libsql = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const adapter = new PrismaLibSQL(libsql);
  prisma = new PrismaClient({ adapter });
} else {
  // Fallback to local sqlite file if Turso is not configured (e.g. local dev)
  prisma = new PrismaClient();
}

module.exports = prisma;
