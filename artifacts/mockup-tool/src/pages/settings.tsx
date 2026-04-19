import { useState, useEffect } from "react";
import { AppLayout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Loader2,
  Plus,
  Trash2,
  Check,
  Settings2,
  Cpu,
  Key,
  Eye,
  EyeOff,
  Pencil,
} from "lucide-react";
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
import type { FalModel, LlmConfig } from "@workspace/api-client-react";
import { AddModelModal, type EditModelData } from "@/components/settings/AddModelModal";

function ApiKeyField({
  label,
  description,
  isSet,
  onSave,
  isSaving,
}: {
  label: string;
  description?: string;
  isSet: boolean;
  onSave: (value: string) => void;
  isSaving: boolean;
}) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-2 py-4 border-b border-border/40 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {isSet && (
          <Badge variant="secondary" className="text-xs shrink-0">Saved</Badge>
        )}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={show ? "text" : "password"}
            placeholder={isSet ? "••••••••••••••• (already set)" : "Paste key here"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="pr-9 font-mono text-sm"
          />
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShow((s) => !s)}
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <Button
          size="sm"
          disabled={!value.trim() || isSaving}
          onClick={() => {
            onSave(value.trim());
            setValue("");
          }}
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}

function GlobalKeysTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const [claudeEnabled, setClaudeEnabled] = useState(false);
  const [togglingClaude, setTogglingClaude] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (settings) setClaudeEnabled(settings.claudeEnabled ?? false);
  }, [settings]);

  const updateSettings = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      },
    },
  });

  async function handleSaveKey(field: string, value: string) {
    setSavingKey(field);
    try {
      await updateSettings.mutateAsync({ data: { [field]: value } as never });
      toast({ title: "API key saved" });
    } finally {
      setSavingKey(null);
    }
  }

  async function handleToggleClaude(enabled: boolean) {
    setTogglingClaude(true);
    setClaudeEnabled(enabled);
    try {
      await updateSettings.mutateAsync({ data: { claudeEnabled: enabled } as never });
      toast({ title: `Claude ${enabled ? "enabled" : "disabled"}` });
    } finally {
      setTogglingClaude(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="bg-card border border-border/50 rounded-xl px-6 pt-2 pb-6">
        <ApiKeyField
          label="fal.io API Key"
          description="Used for all image generation calls."
          isSet={!!settings?.falApiKeySet}
          onSave={(v) => handleSaveKey("falApiKey", v)}
          isSaving={savingKey === "falApiKey"}
        />
        <ApiKeyField
          label="OpenRouter API Key"
          description="Used for AI Q&A and prompt building when Claude mode is off."
          isSet={!!settings?.openrouterApiKeySet}
          onSave={(v) => handleSaveKey("openrouterApiKey", v)}
          isSaving={savingKey === "openrouterApiKey"}
        />
        <ApiKeyField
          label="Claude API Key"
          description="Used when Claude mode is enabled below."
          isSet={!!settings?.claudeApiKeySet}
          onSave={(v) => handleSaveKey("claudeApiKey", v)}
          isSaving={savingKey === "claudeApiKey"}
        />
        <div className="pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Use Claude directly</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When on, Claude is used for Q&amp;A instead of OpenRouter. OpenRouter configs remain inactive.
              </p>
            </div>
            <Switch
              checked={claudeEnabled}
              onCheckedChange={handleToggleClaude}
              disabled={togglingClaude}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FalModelsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: falModels } = useListFalModels();
  const [addOpen, setAddOpen] = useState(false);
  const [editData, setEditData] = useState<EditModelData | undefined>(undefined);

  const createFalModel = useCreateFalModel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFalModelsQueryKey() });
      },
    },
  });

  const updateFalModel = useUpdateFalModel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFalModelsQueryKey() });
      },
    },
  });

  const deleteFalModel = useDeleteFalModel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFalModelsQueryKey() });
        toast({ title: "Model deleted" });
      },
    },
  });

  function handleEdit(model: FalModel) {
    setEditData({
      id: model.id,
      name: model.name,
      curlCommand: model.curlCommand ?? "",
      paramsSchema: (model.paramsSchema as Record<string, unknown>) ?? {},
      defaultValues: (model.defaultValues as Record<string, unknown>) ?? {},
    });
    setAddOpen(true);
  }

  async function handleSave(data: {
    name: string;
    curlCommand: string;
    defaultValues: Record<string, unknown>;
  }) {
    if (editData) {
      await updateFalModel.mutateAsync({
        id: editData.id,
        data: { name: data.name, defaultValues: data.defaultValues },
      });
      toast({ title: "Model updated" });
    } else {
      await createFalModel.mutateAsync({
        data: { name: data.name, curlCommand: data.curlCommand, defaultValues: data.defaultValues } as any,
      });
      toast({ title: "fal.io model added" });
    }
    setAddOpen(false);
    setEditData(undefined);
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Add fal.io models by pasting their API curl command.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditData(undefined);
            setAddOpen(true);
          }}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Model
        </Button>
      </div>

      {!falModels?.length ? (
        <div className="border-2 border-dashed border-border rounded-xl p-10 text-center">
          <Cpu className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No models yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add one by pasting a fal.io API curl command.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {falModels.map((model) => {
            const schema = (model.paramsSchema as Record<string, unknown>) ?? {};
            const paramCount = Object.keys(schema).length;
            return (
              <div key={model.id} className="bg-card border border-border/50 rounded-xl p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{model.name}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{model.endpoint}</p>
                  {paramCount > 0 && (
                    <Badge variant="secondary" className="mt-2 text-xs">{paramCount} params</Badge>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => handleEdit(model)}
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
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
                          onClick={() => deleteFalModel.mutate({ id: model.id })}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddModelModal
        open={addOpen}
        onOpenChange={(v) => {
          setAddOpen(v);
          if (!v) setEditData(undefined);
        }}
        type="fal"
        editData={editData}
        onSave={handleSave}
        isSaving={createFalModel.isPending || updateFalModel.isPending}
      />
    </div>
  );
}

const BUILTIN_MODELS = [
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", description: "Balanced — recommended for most tasks" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", description: "Fastest — best for quick responses" },
] as const;

function LlmConfigsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: llmConfigs } = useListLlmConfigs();
  const { data: settings } = useGetSettings();
  const [addOpen, setAddOpen] = useState(false);
  const [editData, setEditData] = useState<EditModelData | undefined>(undefined);
  const [activatingBuiltin, setActivatingBuiltin] = useState<string | null>(null);

  const createLlmConfig = useCreateLlmConfig({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListLlmConfigsQueryKey() }); },
    },
  });
  const updateLlmConfig = useUpdateLlmConfig({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListLlmConfigsQueryKey() }); },
    },
  });
  const deleteLlmConfig = useDeleteLlmConfig({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLlmConfigsQueryKey() });
        toast({ title: "Config deleted" });
      },
    },
  });
  const activateLlmConfig = useActivateLlmConfig({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListLlmConfigsQueryKey() }); },
    },
  });

  async function handleSetupBuiltin(modelId: string) {
    setActivatingBuiltin(modelId);
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}api/llm-configs/setup-builtin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ modelId }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      queryClient.invalidateQueries({ queryKey: getListLlmConfigsQueryKey() });
      const model = BUILTIN_MODELS.find((m) => m.id === modelId);
      toast({ title: `${model?.name ?? modelId} is now active` });
    } catch {
      toast({ title: "Failed to activate built-in model", variant: "destructive" });
    } finally {
      setActivatingBuiltin(null);
    }
  }

  function handleEdit(config: LlmConfig) {
    setEditData({
      id: config.id,
      name: config.name,
      curlCommand: config.curlCommand ?? "",
      paramsSchema: (config.paramsSchema as Record<string, unknown>) ?? {},
      defaultValues: (config.defaultValues as Record<string, unknown>) ?? {},
      systemPrompt: config.systemPrompt ?? "",
    });
    setAddOpen(true);
  }

  async function handleSave(data: {
    name: string;
    curlCommand: string;
    systemPrompt?: string;
    defaultValues: Record<string, unknown>;
  }) {
    if (editData) {
      await updateLlmConfig.mutateAsync({
        id: editData.id,
        data: { name: data.name, systemPrompt: data.systemPrompt ?? null, defaultValues: data.defaultValues },
      });
      toast({ title: "Config updated" });
    } else {
      await createLlmConfig.mutateAsync({
        data: {
          name: data.name,
          curlCommand: data.curlCommand,
          systemPrompt: data.systemPrompt || null,
          defaultValues: data.defaultValues,
        } as any,
      });
      toast({ title: "LLM config added" });
    }
    setAddOpen(false);
    setEditData(undefined);
  }

  const claudeOn = settings?.claudeEnabled;
  const activeBuiltinId = llmConfigs?.find((c) => c.provider === "replit-anthropic" && c.isActive)?.modelId ?? null;
  const customConfigs = (llmConfigs ?? []).filter((c) => c.provider !== "replit-anthropic");

  return (
    <div className="space-y-6 max-w-xl">

      {/* ── Built-in Models ── */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold">Built-in Models</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Powered by Claude via Replit AI — no API key required, usage billed to your Replit credits.
          </p>
        </div>

        {BUILTIN_MODELS.map((model) => {
          const isActive = activeBuiltinId === model.id;
          const isLoading = activatingBuiltin === model.id;
          return (
            <div
              key={model.id}
              className={`bg-card border rounded-xl p-4 flex items-center justify-between gap-3 transition-all ${
                isActive ? "border-emerald-400/60 bg-emerald-50/30 dark:bg-emerald-950/10" : "border-border/50"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{model.name}</span>
                  {isActive && (
                    <Badge className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:border-emerald-800 dark:text-emerald-400">
                      <Check className="w-2.5 h-2.5 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{model.description}</p>
              </div>
              {!isActive && (
                <Button
                  size="sm"
                  className="shrink-0 h-8 text-xs"
                  onClick={() => void handleSetupBuiltin(model.id)}
                  disabled={!!activatingBuiltin}
                >
                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  {isLoading ? "Activating…" : "Use This"}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Custom (curl-based) configs ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Custom Models</p>
            <p className="text-xs text-muted-foreground mt-0.5">Add via OpenRouter or Claude API curl command.</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setEditData(undefined); setAddOpen(true); }}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Config
          </Button>
        </div>

        {claudeOn && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
            Claude mode is on. OpenRouter configs are inactive while Claude is being used directly.
          </div>
        )}

        {!customConfigs.length ? (
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
            <Settings2 className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">No custom configs</p>
            <p className="text-xs text-muted-foreground mt-1">Add one using an API curl command above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {customConfigs.map((config) => {
              const showInactive = claudeOn && !config.isActive;
              return (
                <div
                  key={config.id}
                  className={`bg-card border rounded-xl p-4 flex items-start justify-between gap-3 ${
                    config.isActive ? "border-primary/40" : "border-border/50"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{config.name}</span>
                      {config.isActive && !claudeOn && (
                        <Badge className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900">
                          <Check className="w-2.5 h-2.5 mr-1" />
                          Active
                        </Badge>
                      )}
                      {showInactive && (
                        <Badge variant="secondary" className="text-xs text-muted-foreground">
                          Inactive (Claude mode on)
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {config.provider} — {config.modelId}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!config.isActive && !claudeOn && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          activateLlmConfig.mutate({ id: config.id });
                          toast({ title: `"${config.name}" is now active` });
                        }}
                        disabled={activateLlmConfig.isPending}
                      >
                        {activateLlmConfig.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <Check className="w-3 h-3 mr-1" />
                        )}
                        Activate
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={() => handleEdit(config)}>
                      <Pencil className="w-3 h-3" />
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
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
                            onClick={() => deleteLlmConfig.mutate({ id: config.id })}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddModelModal
        open={addOpen}
        onOpenChange={(v) => { setAddOpen(v); if (!v) setEditData(undefined); }}
        type="llm"
        editData={editData}
        onSave={handleSave}
        isSaving={createLlmConfig.isPending || updateLlmConfig.isPending}
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Configure API keys and AI model configurations.</p>
        </div>

        <Tabs defaultValue="keys">
          <TabsList className="mb-6">
            <TabsTrigger value="keys" className="gap-2">
              <Key className="w-3.5 h-3.5" />
              Global Keys
            </TabsTrigger>
            <TabsTrigger value="fal" className="gap-2">
              <Cpu className="w-3.5 h-3.5" />
              Image Models
            </TabsTrigger>
            <TabsTrigger value="llm" className="gap-2">
              <Settings2 className="w-3.5 h-3.5" />
              Language Models
            </TabsTrigger>
          </TabsList>

          <TabsContent value="keys">
            <GlobalKeysTab />
          </TabsContent>

          <TabsContent value="fal">
            <FalModelsTab />
          </TabsContent>

          <TabsContent value="llm">
            <LlmConfigsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
