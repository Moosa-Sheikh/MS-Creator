import { Router, type IRouter } from "express";
import { eq, count, max } from "drizzle-orm";
import { db, productsTable, sessionsTable, templatesTable } from "@workspace/db";
import {
  CreateProductBody,
  UpdateProductBody,
  GetProductParams,
  UpdateProductParams,
  DeleteProductParams,
  GetProductStatsParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/products", async (req, res): Promise<void> => {
  const products = await db.select().from(productsTable).orderBy(productsTable.createdAt);
  res.json(products);
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [product] = await db.insert(productsTable).values(parsed.data).returning();
  res.status(201).json(product);
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(product);
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [product] = await db
    .update(productsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(productsTable.id, params.data.id))
    .returning();
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(product);
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(productsTable).where(eq(productsTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/products/:id/stats", async (req, res): Promise<void> => {
  const params = GetProductStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const productId = params.data.id;

  const [sessionStats] = await db
    .select({ count: count(), maxDate: max(sessionsTable.createdAt) })
    .from(sessionsTable)
    .where(eq(sessionsTable.productId, productId));

  const [completedStats] = await db
    .select({ count: count() })
    .from(sessionsTable)
    .where(eq(sessionsTable.productId, productId));

  const [templateStats] = await db
    .select({ count: count() })
    .from(templatesTable)
    .where(eq(templatesTable.productId, productId));

  res.json({
    sessionCount: sessionStats?.count ?? 0,
    templateCount: templateStats?.count ?? 0,
    completedSessionCount: completedStats?.count ?? 0,
    lastSessionAt: sessionStats?.maxDate?.toISOString() ?? null,
  });
});

export default router;
