import { useState } from "react";
import { AppLayout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  useGetSettings,
  useUpdateSettings,
  useListFalModels,
  useCreateFalModel,
  useUpdateFalModel,
  useDeleteFalModel,
  useListLlmConfigs,
  useCreateLlmConfig,
  useUpdateLlmConfig,
  useDeleteLlmConfig,
  useActivateLlmConfig,
  getGetSettingsQueryKey,
  getListFalModelsQueryKey,
  getListLlmConfigsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Check, Settings2, Cpu, Key } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FalModel, LlmConfig } from "@workspace/api-client-react";

function DynamicParamsForm({
  schema,
  values,
  onChange,
}: {
  schema: Record<string, unknown>;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  if (!schema || Object.keys(schema).length === 0) return null;
  return (
    <div className="space-y-3 pt-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Parameters</p>
      {Object.entries(schema).map(([key, def]) => {
        const d = def as { type?: string; description?: string; default?: unknown };
        const value = values[key] ?? d.default ?? "";
        if (d.type === "boolean") {
          return (
            <div key={key} className="flex items-center justify-between">
              <div>
                <Label className="text-sm">{key}</Label>
                {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
              </div>
              <Switch
                checked={!!value}
                onCheckedChange={(v) => onChange(key, v)}
              />
            </div>
          );
        }
        if (d.type === "number" || d.type === "integer") {
          return (
            <div key={key} className="space-y-1">
              <Label className="text-sm">{key}</Label>
              {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
              <Input
                type="number"
                value={String(value)}
                onChange={(e) => onChange(key, Number(e.target.value))}
                className="h-8 text-sm"
              />
            </div>
          );
        }
        return (
          <div key={key} className="space-y-1">
            <Label className="text-sm">{key}</Label>
            {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
            <Input
              value={String(value)}
              onChange={(e) => onChange(key, e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        );
      })}
    </div>
  );
}

function FalModelCard({ model }: { model: FalModel }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editValues, setEditValues] = useState<Record<string, unknown>>(
    (model.defaultValues as Record<string, unknown>) || {}
  );
  const [expanded, setExpanded] = useState(false);

  const updateMutation = useUpdateFalModel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFalModelsQueryKey() });
        toast({ title: "Model updated" });
      },
    },
  });

  const deleteMutation = useDeleteFalModel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFalModelsQueryKey() });
        toast({ title: "Model deleted" });
      },
    },
  });

  const schema = (model.paramsSchema as Record<string, unknown>) || {};
  const hasParams = Object.keys(schema).length > 0;

  return (
    <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => hasParams && setExpanded(!expanded)}
      >
        <div className="min-w-0">
          <div className="font-semibold text-sm">{model.name}</div>
          <div className="text-xs text-muted-foreground font-mono truncate mt-0.5">{model.endpoint}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasParams && (
            <Badge variant="secondary" className="text-xs">{Object.keys(schema).length} params</Badge>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{model.name}"?</AlertDialogTitle>
                <AlertDialogDescription>This model will be permanently removed.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteMutation.mutate({ id: model.id })}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {expanded && hasParams && (
        <div className="border-t border-border/50 px-4 pb-4">
          <DynamicParamsForm
            schema={schema}
            values={editValues}
            onChange={(k, v) => setEditValues((prev) => ({ ...prev, [k]: v }))}
          />
          <Button
            size="sm"
            className="mt-4 h-8"
            onClick={() =>
              updateMutation.mutate({ id: model.id, data: { defaultValues: editValues } })
            }
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
            Save Defaults
          </Button>
        </div>
      )}
    </div>
  );
}

function LlmConfigCard({ config }: { config: LlmConfig }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt || "");

  const activateMutation = useActivateLlmConfig({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLlmConfigsQueryKey() });
        toast({ title: `"${config.name}" is now active` });
      },
    },
  });

  const updateMutation = useUpdateLlmConfig({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLlmConfigsQueryKey() });
        toast({ title: "Config saved" });
      },
    },
  });

  const deleteMutation = useDeleteLlmConfig({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLlmConfigsQueryKey() });
        toast({ title: "Config deleted" });
      },
    },
  });

  return (
    <div className={`bg-card border rounded-xl overflow-hidden ${config.isActive ? "border-primary/40" : "border-border/50"}`}>
      <div className="flex items-center justify-between p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{config.name}</span>
            {config.isActive && (
              <Badge className="text-xs bg-primary/10 text-primary border-primary/20">Active</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {config.provider} — {config.modelId}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!config.isActive && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => activateMutation.mutate({ id: config.id })}
              disabled={activateMutation.isPending}
            >
              {activateMutation.isPending ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Check className="w-3 h-3 mr-1" />
              )}
              Activate
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{config.name}"?</AlertDialogTitle>
                <AlertDialogDescription>This LLM config will be permanently removed.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteMutation.mutate({ id: config.id })}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <div className="border-t border-border/50 px-4 pb-4 space-y-3">
        <div className="space-y-1 pt-3">
          <Label className="text-xs">System Prompt</Label>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Optional system prompt for this LLM..."
            className="text-sm min-h-[80px]"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => updateMutation.mutate({ id: config.id, data: { systemPrompt } })}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useGetSettings();
  const { data: falModels } = useListFalModels();
  const { data: llmConfigs } = useListLlmConfigs();

  const [apiKeys, setApiKeys] = useState({
    falApiKey: "",
    openrouterApiKey: "",
    claudeApiKey: "",
  });
  const [claudeEnabled, setClaudeEnabled] = useState(false);

  const [addFalOpen, setAddFalOpen] = useState(false);
  const [addLlmOpen, setAddLlmOpen] = useState(false);
  const [falCurl, setFalCurl] = useState("");
  const [falName, setFalName] = useState("");
  const [llmCurl, setLlmCurl] = useState("");
  const [llmName, setLlmName] = useState("");
  const [llmSystemPrompt, setLlmSystemPrompt] = useState("");

  const updateSettings = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "Settings saved" });
        setApiKeys({ falApiKey: "", openrouterApiKey: "", claudeApiKey: "" });
      },
    },
  });

  const createFalModel = useCreateFalModel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFalModelsQueryKey() });
        toast({ title: "fal.io model added" });
        setAddFalOpen(false);
        setFalCurl("");
        setFalName("");
      },
      onError: (e) => {
        toast({ title: "Failed to parse curl command", description: (e as any).data?.error, variant: "destructive" });
      },
    },
  });

  const createLlmConfig = useCreateLlmConfig({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLlmConfigsQueryKey() });
        toast({ title: "LLM config added" });
        setAddLlmOpen(false);
        setLlmCurl("");
        setLlmName("");
        setLlmSystemPrompt("");
      },
      onError: (e) => {
        toast({ title: "Failed to parse curl command", description: (e as any).data?.error, variant: "destructive" });
      },
    },
  });

  const handleSaveApiKeys = () => {
    const payload: Record<string, unknown> = { claudeEnabled };
    if (apiKeys.falApiKey) payload.falApiKey = apiKeys.falApiKey;
    if (apiKeys.openrouterApiKey) payload.openrouterApiKey = apiKeys.openrouterApiKey;
    if (apiKeys.claudeApiKey) payload.claudeApiKey = apiKeys.claudeApiKey;
    updateSettings.mutate({ data: payload });
  };

  return (
    <AppLayout>
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Configure API keys, AI models, and LLM configurations.</p>
        </div>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">API Keys</h2>
          </div>
          <div className="bg-card border border-border/50 rounded-xl p-6 space-y-5">
            {settingsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>fal.io API Key</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      placeholder={settings?.falApiKeySet ? "••••••••••••••• (set)" : "Enter fal.io key"}
                      value={apiKeys.falApiKey}
                      onChange={(e) => setApiKeys((p) => ({ ...p, falApiKey: e.target.value }))}
                    />
                    {settings?.falApiKeySet && (
                      <Badge variant="secondary" className="shrink-0 text-xs">Set</Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label>Use Claude (Anthropic)</Label>
                    <Switch
                      checked={claudeEnabled}
                      onCheckedChange={setClaudeEnabled}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">When enabled, Claude is used for Q&A. OpenRouter is used otherwise.</p>
                </div>

                {claudeEnabled ? (
                  <div className="space-y-2">
                    <Label>Claude API Key</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="password"
                        placeholder={settings?.claudeApiKeySet ? "••••••••••••••• (set)" : "sk-ant-..."}
                        value={apiKeys.claudeApiKey}
                        onChange={(e) => setApiKeys((p) => ({ ...p, claudeApiKey: e.target.value }))}
                      />
                      {settings?.claudeApiKeySet && (
                        <Badge variant="secondary" className="shrink-0 text-xs">Set</Badge>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>OpenRouter API Key</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="password"
                        placeholder={settings?.openrouterApiKeySet ? "••••••••••••••• (set)" : "sk-or-..."}
                        value={apiKeys.openrouterApiKey}
                        onChange={(e) => setApiKeys((p) => ({ ...p, openrouterApiKey: e.target.value }))}
                      />
                      {settings?.openrouterApiKeySet && (
                        <Badge variant="secondary" className="shrink-0 text-xs">Set</Badge>
                      )}
                    </div>
                  </div>
                )}

                <Button onClick={handleSaveApiKeys} disabled={updateSettings.isPending}>
                  {updateSettings.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save API Keys
                </Button>
              </>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">fal.io Models</h2>
            </div>
            <Button size="sm" onClick={() => setAddFalOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Model
            </Button>
          </div>
          <div className="space-y-3">
            {falModels?.length === 0 && (
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                <Cpu className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No models yet. Add one by pasting a fal.io curl command.</p>
              </div>
            )}
            {falModels?.map((model) => (
              <FalModelCard key={model.id} model={model} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">LLM Configurations</h2>
            </div>
            <Button size="sm" onClick={() => setAddLlmOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Config
            </Button>
          </div>
          <div className="space-y-3">
            {llmConfigs?.length === 0 && (
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                <Settings2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No LLM configs yet. Add one using an OpenRouter or Claude curl command.</p>
              </div>
            )}
            {llmConfigs?.map((cfg) => (
              <LlmConfigCard key={cfg.id} config={cfg} />
            ))}
          </div>
        </section>
      </div>

      <Dialog open={addFalOpen} onOpenChange={setAddFalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add fal.io Model</DialogTitle>
            <DialogDescription>
              Paste your fal.io API curl command. The endpoint, parameters, and defaults will be extracted automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Model Name</Label>
              <Input value={falName} onChange={(e) => setFalName(e.target.value)} placeholder="e.g. Flux Dev" />
            </div>
            <div className="space-y-1">
              <Label>curl Command</Label>
              <Textarea
                value={falCurl}
                onChange={(e) => setFalCurl(e.target.value)}
                placeholder={`curl -X POST https://fal.run/fal-ai/flux/dev \\\n  -H "Content-Type: application/json" \\\n  -d '{"prompt":"..."}'`}
                className="font-mono text-xs min-h-[140px]"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddFalOpen(false)} className="flex-1">Cancel</Button>
              <Button
                className="flex-1"
                disabled={!falName || !falCurl || createFalModel.isPending}
                onClick={() => createFalModel.mutate({ data: { name: falName, curlCommand: falCurl } })}
              >
                {createFalModel.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Add Model
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addLlmOpen} onOpenChange={setAddLlmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add LLM Configuration</DialogTitle>
            <DialogDescription>
              Paste an OpenRouter or Claude curl command. The model, endpoint, and parameters will be detected automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Config Name</Label>
              <Input value={llmName} onChange={(e) => setLlmName(e.target.value)} placeholder="e.g. GPT-4o via OpenRouter" />
            </div>
            <div className="space-y-1">
              <Label>curl Command</Label>
              <Textarea
                value={llmCurl}
                onChange={(e) => setLlmCurl(e.target.value)}
                placeholder={`curl https://openrouter.ai/api/v1/chat/completions \\\n  -H "Authorization: Bearer sk-or-..." \\\n  -d '{"model":"openai/gpt-4o",...}'`}
                className="font-mono text-xs min-h-[140px]"
              />
            </div>
            <div className="space-y-1">
              <Label>System Prompt (optional)</Label>
              <Textarea
                value={llmSystemPrompt}
                onChange={(e) => setLlmSystemPrompt(e.target.value)}
                placeholder="You are an expert Etsy product photographer..."
                className="min-h-[80px] text-sm"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddLlmOpen(false)} className="flex-1">Cancel</Button>
              <Button
                className="flex-1"
                disabled={!llmName || !llmCurl || createLlmConfig.isPending}
                onClick={() =>
                  createLlmConfig.mutate({ data: { name: llmName, curlCommand: llmCurl, systemPrompt: llmSystemPrompt || undefined } })
                }
              >
                {createLlmConfig.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Add Config
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
