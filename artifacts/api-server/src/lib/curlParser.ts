export type ParamSchema = {
  [key: string]: {
    type: "string" | "number" | "boolean" | "integer";
    defaultValue: string | number | boolean | null;
    required: boolean;
    auto?: boolean;
  };
};

export type ParsedCurl = {
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  paramsSchema: ParamSchema;
  defaultValues: Record<string, unknown>;
};

export type PreviewParam = {
  key: string;
  type: "string" | "number" | "boolean" | "integer";
  defaultValue: string | number | boolean | null;
  auto: boolean;
};

export type ParseCurlPreview = {
  endpoint: string;
  method: string;
  params: PreviewParam[];
  provider?: string;
  modelId?: string;
};

const AUTO_FILLED_KEYS = new Set(["prompt", "image_url"]);

function inferType(value: unknown): "string" | "number" | "boolean" | "integer" {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }
  return "string";
}

function extractBody(lines: string): Record<string, unknown> {
  const dataMatch =
    lines.match(/-d\s+'(\{[\s\S]*?\})'\s*$/) ||
    lines.match(/-d\s+"(\{[\s\S]*?\})"\s*$/) ||
    lines.match(/--data(?:-raw)?\s+'(\{[\s\S]*?\})'\s*$/) ||
    lines.match(/--data(?:-raw)?\s+"(\{[\s\S]*?\})"\s*$/) ||
    lines.match(/-d\s+'(\{[\s\S]*?\})'/) ||
    lines.match(/-d\s+"(\{[\s\S]*?\})"/) ||
    lines.match(/--data(?:-raw)?\s+'(\{[\s\S]*?\})'/) ||
    lines.match(/--data(?:-raw)?\s+"(\{[\s\S]*?\})"/);

  if (dataMatch) {
    try {
      return JSON.parse(dataMatch[1]);
    } catch {
      return {};
    }
  }
  return {};
}

export function parseCurlCommand(curl: string): ParsedCurl {
  const lines = curl.replace(/\\\n/g, " ").trim();

  const urlMatch = lines.match(/(?:curl\s+(?:-[A-Z]+\s+)?)?["']?(https?:\/\/[^\s"']+)["']?/);
  if (!urlMatch) throw new Error("No URL found in curl command");
  const endpoint = urlMatch[1];

  const methodMatch = lines.match(/-X\s+([A-Z]+)/);
  const method = methodMatch ? methodMatch[1] : "POST";

  const headers: Record<string, string> = {};
  const headerMatches = lines.matchAll(/-H\s+["']([^"']+)["']/g);
  for (const match of headerMatches) {
    const [key, ...rest] = match[1].split(": ");
    headers[key] = rest.join(": ");
  }

  const body = extractBody(lines);

  const paramsSchema: ParamSchema = {};
  const defaultValues: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    const type = inferType(value);
    const auto = AUTO_FILLED_KEYS.has(key);
    paramsSchema[key] = {
      type,
      defaultValue: value as string | number | boolean | null,
      required: auto,
      auto,
    };
    if (!auto) {
      defaultValues[key] = value;
    }
  }

  return { endpoint, method, headers, body, paramsSchema, defaultValues };
}

export function parseLlmCurlCommand(curl: string): ParsedCurl & { provider: string; modelId: string } {
  const parsed = parseCurlCommand(curl);

  let provider = "openrouter";
  let modelId = "openai/gpt-4o";

  if (parsed.endpoint.includes("anthropic") || parsed.endpoint.includes("claude")) {
    provider = "claude";
    modelId = (parsed.body.model as string) || "claude-3-5-sonnet-20241022";
  } else if (parsed.endpoint.includes("openrouter")) {
    provider = "openrouter";
    modelId = (parsed.body.model as string) || "openai/gpt-4o";
  } else {
    modelId = (parsed.body.model as string) || "openai/gpt-4o";
  }

  return { ...parsed, provider, modelId };
}

export function parseCurlForPreview(curl: string, type: "fal" | "llm"): ParseCurlPreview {
  if (type === "llm") {
    const { endpoint, method, paramsSchema, provider, modelId } = parseLlmCurlCommand(curl);
    const params: PreviewParam[] = Object.entries(paramsSchema).map(([key, def]) => ({
      key,
      type: def.type,
      defaultValue: def.defaultValue,
      auto: def.auto ?? AUTO_FILLED_KEYS.has(key),
    }));
    return { endpoint, method, params, provider, modelId };
  } else {
    const { endpoint, method, paramsSchema } = parseCurlCommand(curl);
    const params: PreviewParam[] = Object.entries(paramsSchema).map(([key, def]) => ({
      key,
      type: def.type,
      defaultValue: def.defaultValue,
      auto: def.auto ?? AUTO_FILLED_KEYS.has(key),
    }));
    return { endpoint, method, params };
  }
}
