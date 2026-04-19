import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, templatesTable, sessionsTable } from "@workspace/db";
import {
  CreateTemplateBody,
  ListTemplatesQueryParams,
  GetTemplateParams,
  DeleteTemplateParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/templates", async (req, res): Promise<void> => {
  const query = ListTemplatesQueryParams.safeParse(req.query);
  const templates = await db
    .select()
    .from(templatesTable)
    .where(
      query.success && query.data.productId
        ? eq(templatesTable.productId, query.data.productId)
        : undefined
    )
    .orderBy(templatesTable.createdAt);
  res.json(templates);
});

router.post("/templates", async (req, res): Promise<void> => {
  const parsed = CreateTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, parsed.data.sessionId));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const prompt = session.enhancedPrompt || session.finalPrompt;
  if (!prompt) {
    res.status(400).json({ error: "Session has no prompt to save as template" });
    return;
  }

  const [template] = await db.insert(templatesTable).values({
    productId: session.productId,
    name: parsed.data.name,
    type: session.outputType ?? "M1",
    optionType: session.optionType ?? "A",
    prompt,
    imageUrls: session.generatedImageUrls ?? [],
    sessionConfig: {
      optionType: session.optionType,
      outputType: session.outputType,
      imageCount: session.imageCount,
      referenceStyle: session.referenceStyle,
      qaAnswers: session.qaAnswers,
    },
  }).returning();
  res.status(201).json(template);
});

router.get("/templates/:id", async (req, res): Promise<void> => {
  const params = GetTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, params.data.id));
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json(template);
});

router.delete("/templates/:id", async (req, res): Promise<void> => {
  const params = DeleteTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(templatesTable).where(eq(templatesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
