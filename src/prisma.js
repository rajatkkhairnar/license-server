const { PrismaClient } = require('@prisma/client');
const { PrismaLibSQL } = require('@prisma/adapter-libsql');

let prisma;

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

console.log(`🔌 Prisma init — TURSO_DATABASE_URL is ${tursoUrl ? 'SET (' + tursoUrl.substring(0, 30) + '...)' : 'NOT SET'}`);
console.log(`🔌 Prisma init — TURSO_AUTH_TOKEN is ${tursoToken ? 'SET (length: ' + tursoToken.length + ')' : 'NOT SET'}`);

if (tursoUrl) {
  const adapter = new PrismaLibSQL({
    url: tursoUrl,
    authToken: tursoToken,
  });

  prisma = new PrismaClient({ adapter });
  console.log('✅ Prisma connected via Turso (LibSQL adapter)');
} else {
  // Fallback to local sqlite file if Turso is not configured (e.g. local dev)
  prisma = new PrismaClient();
  console.log('⚠️ Prisma connected locally (no Turso URL found)');
}

module.exports = prisma;
