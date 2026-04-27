import pg from "pg";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("CREATE EXTENSION IF NOT EXISTS vector;");
  console.log("[setup-extensions] pgvector extension ready");
} finally {
  await client.end();
}
