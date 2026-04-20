import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import productsRouter from "./products";
import sessionsRouter from "./sessions";
import aiRouter from "./ai";
import generationRouter from "./generation";
import templatesRouter from "./templates";
import settingsRouter from "./settings";
import storageRouter from "./storage";

const router: IRouter = Router();

// Storage must be mounted BEFORE any authenticated routers.
// The authenticated routers apply requireAuth as a blanket middleware that
// intercepts all requests — including storage requests — if mounted first.
// GET /storage/objects/* and GET /storage/public-objects/* are intentionally
// public so that fal.io can download product images.
router.use(storageRouter);

router.use(healthRouter);
router.use(authRouter);
router.use(productsRouter);
router.use(sessionsRouter);
router.use(aiRouter);
router.use(generationRouter);
router.use(templatesRouter);
router.use(settingsRouter);

export default router;
