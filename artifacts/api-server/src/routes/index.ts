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

router.use(healthRouter);
router.use(authRouter);
router.use(productsRouter);
router.use(sessionsRouter);
router.use(aiRouter);
router.use(generationRouter);
router.use(templatesRouter);
router.use(settingsRouter);
router.use(storageRouter);

export default router;
