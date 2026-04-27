import pg from "pg";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("CREATE EXTENSION IF NOT EXISTS vector;");
  const { rows } = await client.query<{ extversion: string }>(
    "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
  );
  const version = rows[0]?.extversion ?? "unknown";
  console.log(`[setup-extensions] pgvector extension ready (v${version})`);
} finally {
  await client.end();
}
