import { Router, type IRouter } from "express";
import { getIronSession } from "iron-session";
import type { SessionData } from "../lib/session";
import { sessionOptions } from "../lib/session";
import { LoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/auth/me", async (req, res): Promise<void> => {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  res.json({ authenticated: session.authenticated === true });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    res.status(500).json({ error: "Server misconfigured: no APP_PASSWORD set" });
    return;
  }

  if (parsed.data.password !== appPassword) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.authenticated = true;
  await session.save();
  res.json({ authenticated: true });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.destroy();
  res.json({ authenticated: false });
});

export default router;
