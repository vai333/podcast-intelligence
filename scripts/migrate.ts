// Applies the SQL migrations in ./drizzle to the Neon database in DATABASE_URL.
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { closeDb, db } from "@/lib/db/client";

async function main() {
  await migrate(db(), { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
  await closeDb();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
