import { Request, Response, NextFunction } from "express";
import * as crypto from "crypto";

/**
 * Bearer token auth middleware. Checks Authorization header against API_SECRET env var.
 * If API_SECRET is not set, all requests are allowed (development mode).
 * Uses timing-safe comparison to prevent timing attacks on the secret.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.API_SECRET;
  if (!secret) {
    // No API_SECRET configured — skip auth (development mode)
    next();
    return;
  }
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized — missing Bearer token" });
    return;
  }
  const token = header.slice(7);
  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(secret);
  if (tokenBuf.length !== secretBuf.length || !crypto.timingSafeEqual(tokenBuf, secretBuf)) {
    res.status(401).json({ error: "Unauthorized — invalid token" });
    return;
  }
  next();
}
