import app from "./app.js";
import { logger } from "./lib/logger.js";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./lib/auth.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "WolfX@2024!";

async function seedAdminUser() {
  try {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, ADMIN_USERNAME));
    if (!existing) {
      const passwordHash = await hashPassword(ADMIN_PASSWORD);
      await db.insert(usersTable).values({
        username: ADMIN_USERNAME,
        passwordHash,
        role: "admin",
      });
      logger.info({ username: ADMIN_USERNAME }, "Admin user created");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed admin user");
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await seedAdminUser();
});
