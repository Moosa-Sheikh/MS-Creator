import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowRight, ArrowLeft, AlertCircle } from "lucide-react";
import { DynamicParamForm, type PreviewParam } from "./DynamicParamForm";

export type ModelType = "fal" | "llm";

export type EditModelData = {
  id: string;
  name: string;
  curlCommand: string;
  paramsSchema: Record<string, unknown>;
  defaultValues: Record<string, unknown>;
  systemPrompt?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ModelType;
  editData?: EditModelData;
  onSave: (data: {
    name: string;
    curlCommand: string;
    systemPrompt?: string;
    defaultValues: Record<string, unknown>;
    params: PreviewParam[];
  }) => Promise<void>;
  isSaving: boolean;
};

type ParsedPreview = {
  endpoint: string;
  params: PreviewParam[];
  provider?: string;
  modelId?: string;
};

function schemaToParams(schema: Record<string, unknown>): PreviewParam[] {
  return Object.entries(schema).map(([key, def]) => {
    const d = def as { type?: string; defaultValue?: unknown; auto?: boolean };
    return {
      key,
      type: (d.type || "string") as PreviewParam["type"],
      defaultValue: (d.defaultValue ?? null) as PreviewParam["defaultValue"],
      auto: d.auto ?? (key === "prompt" || key === "image_url"),
    };
  });
}

export function AddModelModal({ open, onOpenChange, type, editData, onSave, isSaving }: Props) {
  const isEdit = !!editData;
  const [step, setStep] = useState<1 | 2>(isEdit ? 2 : 1);

  const [curlInput, setCurlInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [preview, setPreview] = useState<ParsedPreview | null>(null);

  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    if (isEdit && editData) {
      setStep(2);
      setName(editData.name);
      setSystemPrompt(editData.systemPrompt || "");
      const params = schemaToParams(editData.paramsSchema);
      const defaults: Record<string, unknown> = {};
      const enabled: Record<string, boolean> = {};
      params.forEach((p) => {
        if (!p.auto) {
          defaults[p.key] = editData.defaultValues[p.key] ?? p.defaultValue ?? "";
          enabled[p.key] = editData.defaultValues[p.key] !== undefined;
        }
      });
      setValues(defaults);
      setEnabledMap(enabled);
      setPreview({ endpoint: "", params });
    } else {
      setStep(1);
      setCurlInput("");
      setParseError(null);
      setName("");
      setSystemPrompt("");
      setValues({});
      setEnabledMap({});
      setPreview(null);
    }
  }, [open, isEdit, editData]);

  async function handleParse() {
    setParseError(null);
    setIsParsing(true);
    try {
      const res = await fetch("/api/parse-curl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curl: curlInput, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to parse");
      const parsed = data as ParsedPreview;
      setPreview(parsed);
      const defaults: Record<string, unknown> = {};
      const enabled: Record<string, boolean> = {};
      parsed.params.forEach((p) => {
        if (!p.auto) {
          defaults[p.key] = p.defaultValue ?? "";
          enabled[p.key] = true;
        }
      });
      setValues(defaults);
      setEnabledMap(enabled);
      if (type === "llm" && parsed.modelId) {
        setName(parsed.modelId);
      }
      setStep(2);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse curl command");
    } finally {
      setIsParsing(false);
    }
  }

  async function handleSave() {
    const enabledValues: Record<string, unknown> = {};
    Object.entries(values).forEach(([key, val]) => {
      if (enabledMap[key] !== false) {
        enabledValues[key] = val;
      }
    });
    await onSave({
      name,
      curlCommand: isEdit ? editData!.curlCommand : curlInput,
      systemPrompt: type === "llm" ? systemPrompt : undefined,
      defaultValues: enabledValues,
      params: preview?.params ?? [],
    });
  }

  const title = isEdit
    ? `Edit ${type === "fal" ? "fal.io Model" : "LLM Config"}`
    : `Add ${type === "fal" ? "fal.io Model" : "LLM Config"}`;

  const stepLabel = isEdit ? "" : ` — Step ${step} of 2`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}{stepLabel}</DialogTitle>
          <DialogDescription>
            {step === 1
              ? `Paste the ${type === "fal" ? "fal.io" : "OpenRouter / Claude"} API curl command. Endpoint, parameters, and defaults will be detected automatically.`
              : isEdit
              ? "Update the model name and parameter defaults."
              : "Review and configure the parsed parameters, then save."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>curl Command</Label>
              <Textarea
                value={curlInput}
                onChange={(e) => {
                  setCurlInput(e.target.value);
                  setParseError(null);
                }}
                placeholder={
                  type === "fal"
                    ? `curl -X POST "https://fal.run/fal-ai/flux/dev" \\\n  -H "Authorization: Key $FAL_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"prompt":"a photo of...", "num_images":1}'`
                    : `curl https://openrouter.ai/api/v1/chat/completions \\\n  -H "Authorization: Bearer $OPENROUTER_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"anthropic/claude-3.5-sonnet","temperature":0.7}'`
                }
                className="font-mono text-xs min-h-[160px] resize-y"
              />
            </div>

            {parseError && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={!curlInput.trim() || isParsing}
                onClick={handleParse}
              >
                {isParsing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                Parse & Continue
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 pt-1">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={type === "fal" ? "e.g. Flux Dev" : "e.g. Claude 3.5 via OpenRouter"}
              />
            </div>

            {preview?.endpoint && (
              <div className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2 font-mono break-all">
                {preview.endpoint}
              </div>
            )}

            {type === "llm" && (
              <div className="space-y-1.5">
                <Label>System Prompt <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Additional instructions prepended to every call with this model. Leave empty to use only the built-in prompt."
                  className="text-sm min-h-[90px] resize-y"
                  rows={5}
                />
              </div>
            )}

            {preview && preview.params.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parameters</p>
                <DynamicParamForm
                  params={preview.params}
                  values={values}
                  enabledMap={enabledMap}
                  onChange={(key, val) => setValues((prev) => ({ ...prev, [key]: val }))}
                  onToggleEnabled={(key, enabled) => setEnabledMap((prev) => ({ ...prev, [key]: enabled }))}
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              {!isEdit && (
                <Button variant="outline" size="icon" onClick={() => setStep(1)} className="shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={!name.trim() || isSaving}
                onClick={handleSave}
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {isEdit ? "Save Changes" : "Save Model"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
