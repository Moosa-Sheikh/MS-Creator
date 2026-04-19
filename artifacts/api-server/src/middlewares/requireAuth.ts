import type { Request, Response, NextFunction } from "express";
import { getIronSession } from "iron-session";
import type { SessionData } from "../lib/session";
import { sessionOptions } from "../lib/session";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.authenticated) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
