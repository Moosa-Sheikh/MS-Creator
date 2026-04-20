import { useState } from "react";
import { AppLayout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useGetSettings,
  useUpdateSettings,
  useListFalModels,
  useCreateFalModel,
  useUpdateFalModel,
  useDeleteFalModel,
  useListLlmConfigs,
  useCreateLlmConfig,
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
import { Checkbox } from "@/components/ui/checkbox";
import { AddModelModal, type EditModelData } from "@/components/settings/AddModelModal";

// ── Provider definitions ──────────────────────────────────────────────────────

type ModelCaps = { supportsVision: boolean; supportsThinking: boolean; isFree: boolean };

const PROVIDERS = [
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "One API key, hundreds of models — free and paid. Browse models at openrouter.ai/models",
    keyLabel: "openrouterApiKey" as const,
    keySetField: "openrouterApiKeySet" as const,
    keyPlaceholder: "sk-or-v1-...",
    modelIdPlaceholder: "openai/gpt-4o",
    showFreeToggle: true,
    quickModels: [] as (ModelCaps & { id: string; name: string })[],
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    description: "Best for complex reasoning and creative writing. Extended thinking on claude-3-7-sonnet.",
    keyLabel: "claudeApiKey" as const,
    keySetField: "claudeApiKeySet" as const,
    keyPlaceholder: "sk-ant-...",
    modelIdPlaceholder: "claude-sonnet-4-6",
    showFreeToggle: false,
    quickModels: [
      { id: "claude-opus-4-5", name: "Claude Opus 4.5", supportsVision: true, supportsThinking: false, isFree: false },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", supportsVision: true, supportsThinking: false, isFree: false },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", supportsVision: true, supportsThinking: false, isFree: false },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "Industry-standard GPT and reasoning models. Reliable and widely compatible.",
    keyLabel: "openaiApiKey" as const,
    keySetField: "openaiApiKeySet" as const,
    keyPlaceholder: "sk-proj-...",
    modelIdPlaceholder: "gpt-4o",
    showFreeToggle: false,
    quickModels: [
      { id: "gpt-4o", name: "GPT-4o", supportsVision: true, supportsThinking: false, isFree: false },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", supportsVision: true, supportsThinking: false, isFree: false },
      { id: "o4-mini", name: "o4-mini", supportsVision: false, supportsThinking: true, isFree: false },
    ],
  },
  {
    id: "google",
    name: "Google Gemini",
    description: "Multimodal models from Google DeepMind. Get your key at aistudio.google.com",
    keyLabel: "googleApiKey" as const,
    keySetField: "googleApiKeySet" as const,
    keyPlaceholder: "AIza...",
    modelIdPlaceholder: "gemini-2.0-flash",
    showFreeToggle: false,
    quickModels: [
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", supportsVision: true, supportsThinking: false, isFree: false },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", supportsVision: true, supportsThinking: false, isFree: false },
      { id: "gemini-2.5-pro-preview-03-25", name: "Gemini 2.5 Pro", supportsVision: true, supportsThinking: true, isFree: false },
    ],
  },
];

// ── Shared components ─────────────────────────────────────────────────────────

function ApiKeyField({
  label,
  description,
  isSet,
  onSave,
  isSaving,
  placeholder,
}: {
  label: string;
  description?: string;
  isSet: boolean;
  onSave: (value: string) => void;
  isSaving: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs font-medium">{label}</Label>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {isSet && <Badge variant="secondary" className="text-xs shrink-0">Saved</Badge>}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={isSet ? "••••••••••••••••" : (placeholder ?? "Paste API key here")}
            className="h-8 text-xs pr-8"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <Button size="sm" className="h-8 text-xs" onClick={() => { onSave(value); setValue(""); }} disabled={!value.trim() || isSaving}>
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ── Add LLM Model dialog ──────────────────────────────────────────────────────

function AddLlmModelDialog({
  open,
  onOpenChange,
  provider,
  modelIdPlaceholder,
  showFreeToggle,
  onCreate,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  provider: string;
  modelIdPlaceholder: string;
  showFreeToggle: boolean;
  onCreate: (name: string, modelId: string, caps: ModelCaps) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState("");
  const [modelId, setModelId] = useState("");
  const [supportsVision, setSupportsVision] = useState(false);
  const [supportsThinking, setSupportsThinking] = useState(false);
  const [isFree, setIsFree] = useState(false);

  function handleSubmit() {
    if (!modelId.trim()) return;
    onCreate(name.trim() || modelId.trim(), modelId.trim(), { supportsVision, supportsThinking, isFree });
    setName(""); setModelId(""); setSupportsVision(false); setSupportsThinking(false); setIsFree(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Add {provider} Model</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label className="text-xs">Model ID</Label>
            <Input
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder={modelIdPlaceholder}
              className="h-8 text-xs font-mono"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Find model IDs on the provider's website.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Display Name <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={modelId || "My model name"}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-2 pt-1 border-t border-border/50">
            <p className="text-xs text-muted-foreground font-medium">Model capabilities</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  id="vision"
                  checked={supportsVision}
                  onCheckedChange={(v) => setSupportsVision(!!v)}
                  className="h-3.5 w-3.5"
                />
                <div>
                  <span className="text-xs font-medium">Supports vision</span>
                  <p className="text-xs text-muted-foreground">Can analyze images (required for reference image analysis)</p>
                </div>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  id="thinking"
                  checked={supportsThinking}
                  onCheckedChange={(v) => setSupportsThinking(!!v)}
                  className="h-3.5 w-3.5"
                />
                <div>
                  <span className="text-xs font-medium">Thinking / extended reasoning</span>
                  <p className="text-xs text-muted-foreground">Model reasons step-by-step before answering (e.g. :thinking suffix)</p>
                </div>
              </label>
              {showFreeToggle && (
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox
                    id="free"
                    checked={isFree}
                    onCheckedChange={(v) => setIsFree(!!v)}
                    className="h-3.5 w-3.5"
                  />
                  <div>
                    <span className="text-xs font-medium">Free model</span>
                    <p className="text-xs text-muted-foreground">This model has no cost (e.g. models with :free suffix)</p>
                  </div>
                </label>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!modelId.trim() || isSaving}>
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : null}
            Add Model
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Provider section ──────────────────────────────────────────────────────────

function ProviderSection({
  provider,
  settings,
  llmConfigs,
  onSaveKey,
  isSavingKey,
  onCreate,
  isCreating,
  onActivate,
  isActivating,
  onDelete,
}: {
  provider: (typeof PROVIDERS)[number];
  settings: { [K in typeof provider.keySetField]: boolean } | undefined;
  llmConfigs: LlmConfig[];
  onSaveKey: (value: string) => void;
  isSavingKey: boolean;
  onCreate: (name: string, modelId: string, caps: ModelCaps) => void;
  isCreating: boolean;
  onActivate: (id: string) => void;
  isActivating: boolean;
  onDelete: (id: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const providerConfigs = llmConfigs.filter((c) => c.provider === provider.id);
  const isKeySet = settings?.[provider.keySetField] ?? false;

  function quickAdd(m: (typeof provider.quickModels)[number]) {
    const caps: ModelCaps = {
      supportsVision: "supportsVision" in m ? (m.supportsVision as boolean) : false,
      supportsThinking: "supportsThinking" in m ? (m.supportsThinking as boolean) : false,
      isFree: "isFree" in m ? (m.isFree as boolean) : false,
    };
    onCreate(m.name, m.id, caps);
  }

  return (
    <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 bg-muted/30">
        <p className="text-sm font-semibold">{provider.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{provider.description}</p>
      </div>

      <div className="p-4 space-y-4">
        {/* API Key */}
        <ApiKeyField
          label="API Key"
          isSet={isKeySet}
          onSave={onSaveKey}
          isSaving={isSavingKey}
          placeholder={provider.keyPlaceholder}
        />

        {/* Quick-add chips */}
        {provider.quickModels.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Quick add</p>
            <div className="flex flex-wrap gap-1.5">
              {provider.quickModels.map((m) => {
                const exists = providerConfigs.some((c) => c.modelId === m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => !exists && quickAdd(m)}
                    disabled={exists || isCreating}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                      exists
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400 cursor-default"
                        : "border-border hover:border-primary/50 hover:bg-accent cursor-pointer"
                    }`}
                  >
                    {exists && <Check className="w-3 h-3 inline mr-1" />}
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Added models list */}
        {providerConfigs.length > 0 && (
          <div className="space-y-2">
            {providerConfigs.map((config) => (
              <div
                key={config.id}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                  config.isActive
                    ? "border-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-950/15"
                    : "border-border/50 bg-background"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-sm truncate">{config.name}</span>
                    {config.supportsVision && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 font-medium shrink-0">vision</span>
                    )}
                    {config.supportsThinking && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 font-medium shrink-0">thinking</span>
                    )}
                    {config.isFree && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-medium shrink-0">free</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground font-mono truncate block">{config.modelId}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {config.isActive ? (
                    <Badge className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:border-emerald-800 dark:text-emerald-400">
                      <Check className="w-2.5 h-2.5 mr-1" />Active
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onActivate(config.id)}
                      disabled={isActivating}
                    >
                      {isActivating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      Use
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
                        <AlertDialogTitle>Remove "{config.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>This model config will be deleted.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => onDelete(config.id)}
                        >Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add model button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs border-dashed"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Model
        </Button>
      </div>

      <AddLlmModelDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        provider={provider.name}
        modelIdPlaceholder={provider.modelIdPlaceholder}
        showFreeToggle={provider.showFreeToggle}
        onCreate={(name, modelId, caps) => {
          onCreate(name, modelId, caps);
          setAddOpen(false);
        }}
        isSaving={isCreating}
      />
    </div>
  );
}

// ── LLM Configs Tab ───────────────────────────────────────────────────────────

function LlmConfigsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: llmConfigs = [] } = useListLlmConfigs();
  const { data: settings } = useGetSettings();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const updateSettings = useUpdateSettings({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() }); },
    },
  });

  const createLlmConfig = useCreateLlmConfig({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListLlmConfigsQueryKey() }); },
    },
  });

  const deleteLlmConfig = useDeleteLlmConfig({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLlmConfigsQueryKey() });
        toast({ title: "Model removed" });
      },
    },
  });

  const activateLlmConfig = useActivateLlmConfig({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListLlmConfigsQueryKey() });
        toast({ title: `"${data.name}" is now active` });
      },
    },
  });

  async function handleSaveKey(providerKeyField: string, value: string) {
    setSavingKey(providerKeyField);
    try {
      await updateSettings.mutateAsync({ data: { [providerKeyField]: value } as any });
      toast({ title: "API key saved" });
    } finally {
      setSavingKey(null);
    }
  }

  async function handleCreate(provider: string, name: string, modelId: string, caps: ModelCaps) {
    const existing = llmConfigs.find((c) => c.provider === provider && c.modelId === modelId);
    if (existing) { toast({ title: "Model already added" }); return; }
    await createLlmConfig.mutateAsync({ data: { name, provider, modelId, ...caps } });
    toast({ title: `"${name}" added` });
  }

  return (
    <div className="space-y-4 max-w-xl">
      <p className="text-sm text-muted-foreground">
        Add your API key for any provider, then add the models you want to use. Click <strong>Use</strong> to make a model active.
      </p>

      {PROVIDERS.map((provider) => (
        <ProviderSection
          key={provider.id}
          provider={provider as any}
          settings={settings as any}
          llmConfigs={llmConfigs}
          onSaveKey={(val) => void handleSaveKey(provider.keyLabel, val)}
          isSavingKey={savingKey === provider.keyLabel}
          onCreate={(name, modelId, caps) => void handleCreate(provider.id, name, modelId, caps)}
          isCreating={createLlmConfig.isPending}
          onActivate={(id) => activateLlmConfig.mutate({ id })}
          isActivating={activateLlmConfig.isPending}
          onDelete={(id) => deleteLlmConfig.mutate({ id })}
        />
      ))}
    </div>
  );
}

// ── Image Models (fal.io) Tab ─────────────────────────────────────────────────

function FalModelsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: falModels } = useListFalModels();
  const [addOpen, setAddOpen] = useState(false);
  const [editData, setEditData] = useState<EditModelData | undefined>(undefined);

  const createFalModel = useCreateFalModel({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFalModelsQueryKey() }); },
    },
  });
  const updateFalModel = useUpdateFalModel({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFalModelsQueryKey() }); },
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
      systemPrompt: "",
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
      await updateFalModel.mutateAsync({
        id: editData.id,
        data: { name: data.name, curlCommand: data.curlCommand, defaultValues: data.defaultValues },
      });
      toast({ title: "Model updated" });
    } else {
      await createFalModel.mutateAsync({ data: { name: data.name, curlCommand: data.curlCommand } });
      toast({ title: "Model added" });
    }
    setAddOpen(false);
    setEditData(undefined);
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Add fal.io models by pasting their API curl command.</p>
        <Button size="sm" onClick={() => { setEditData(undefined); setAddOpen(true); }}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />Add Model
        </Button>
      </div>

      {!falModels?.length ? (
        <div className="border-2 border-dashed border-border rounded-xl p-10 text-center">
          <Settings2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No image models yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add one by pasting a fal.io API curl command.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {falModels.map((model) => (
            <div key={model.id} className="bg-card border border-border/50 rounded-xl p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="font-semibold text-sm">{model.name}</span>
                <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{model.endpoint}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handleEdit(model)}>Edit</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete "{model.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>This fal.io model config will be permanently removed.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => deleteFalModel.mutate({ id: model.id })}
                      >Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddModelModal
        open={addOpen}
        onOpenChange={(v) => { setAddOpen(v); if (!v) setEditData(undefined); }}
        type="fal"
        editData={editData}
        onSave={handleSave}
        isSaving={createFalModel.isPending || updateFalModel.isPending}
      />
    </div>
  );
}

// ── API Keys Tab (fal.io key) ─────────────────────────────────────────────────

function ApiKeysTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings } = useGetSettings();
  const [saving, setSaving] = useState(false);

  const updateSettings = useUpdateSettings({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() }); },
    },
  });

  async function saveFalKey(value: string) {
    setSaving(true);
    try {
      await updateSettings.mutateAsync({ data: { falApiKey: value } });
      toast({ title: "fal.io API key saved" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="bg-card border border-border/60 rounded-xl p-4">
        <p className="text-sm font-semibold mb-1">fal.io</p>
        <p className="text-xs text-muted-foreground mb-4">Required for image generation. Get your key at fal.ai/dashboard.</p>
        <ApiKeyField
          label="API Key"
          isSet={!!settings?.falApiKeySet}
          onSave={(v) => void saveFalKey(v)}
          isSaving={saving}
          placeholder="fal-..."
        />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Configure API keys and AI model configurations.</p>
        </div>

        <Tabs defaultValue="llm">
          <TabsList className="mb-6">
            <TabsTrigger value="llm" className="gap-2">
              <Cpu className="w-3.5 h-3.5" />
              Language Models
            </TabsTrigger>
            <TabsTrigger value="images" className="gap-2">
              <Settings2 className="w-3.5 h-3.5" />
              Image Models
            </TabsTrigger>
            <TabsTrigger value="keys" className="gap-2">
              <Key className="w-3.5 h-3.5" />
              API Keys
            </TabsTrigger>
          </TabsList>

          <TabsContent value="llm">
            <LlmConfigsTab />
          </TabsContent>

          <TabsContent value="images">
            <FalModelsTab />
          </TabsContent>

          <TabsContent value="keys">
            <ApiKeysTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
