import { Router } from "express";
import { eq, and, ne } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth.js";
import { hashPassword } from "../lib/auth.js";

async function adminCount() {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"));
  return Number(row?.count ?? 0);
}

const router = Router();

// All user management routes require admin
router.use(requireAdmin);

function toPublicUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  };
}

// GET /api/users — list all users
router.get("/users", async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(users.map(toPublicUser));
});

// POST /api/users — create a new user
router.post("/users", async (req, res): Promise<void> => {
  const { username, password, role } = req.body as {
    username?: string;
    password?: string;
    role?: string;
  };

  if (!username?.trim() || !password?.trim()) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  if (username.trim().length < 3) {
    res.status(400).json({ error: "Username must be at least 3 characters" });
    return;
  }

  if (password.trim().length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const validRole = role === "admin" ? "admin" : "user";

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, username.toLowerCase().trim()));
  if (existing) {
    res.status(409).json({ error: "Username already exists" });
    return;
  }

  const passwordHash = await hashPassword(password.trim());
  const [user] = await db.insert(usersTable).values({
    username: username.toLowerCase().trim(),
    passwordHash,
    role: validRole,
  }).returning();

  res.status(201).json(toPublicUser(user));
});

// PATCH /api/users/:id — update user (role or password)
router.patch("/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const { password, role } = req.body as { password?: string; role?: string };
  const update: Record<string, unknown> = {};

  if (password?.trim()) {
    if (password.trim().length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }
    update.passwordHash = await hashPassword(password.trim());
  }

  if (role === "admin" || role === "user") {
    // Prevent self-demotion
    if (role === "user" && id === req.user?.userId) {
      res.status(400).json({ error: "You cannot demote your own account" });
      return;
    }
    // Prevent demoting the last admin
    if (role === "user") {
      const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
      if (target?.role === "admin" && (await adminCount()) <= 1) {
        res.status(400).json({ error: "Cannot demote the last admin account" });
        return;
      }
    }
    update.role = role;
  }

  if (Object.keys(update).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  const [user] = await db.update(usersTable).set(update).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(toPublicUser(user));
});

// DELETE /api/users/:id — delete a user (cannot delete yourself)
router.delete("/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  // Prevent self-deletion
  if (id === req.user?.userId) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  // Prevent deleting last admin
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (target.role === "admin" && (await adminCount()) <= 1) {
    res.status(400).json({ error: "Cannot delete the last admin account" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.sendStatus(204);
});

export default router;
