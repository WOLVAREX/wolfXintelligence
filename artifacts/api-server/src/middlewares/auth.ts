import { type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { verifyToken, type JWTPayload } from "../lib/auth.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: JWTPayload;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.user = payload;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // Re-verify role from DB so revocations and role changes take effect immediately
  db.select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.userId))
    .then(([row]) => {
      if (!row || row.role !== "admin") {
        res.status(403).json({ error: "Forbidden: admin access required" });
        return;
      }
      next();
    })
    .catch(() => {
      res.status(500).json({ error: "Internal server error" });
    });
}
