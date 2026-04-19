import { useParams, useLocation, Link } from "wouter";
import { useState, useRef } from "react";
import { AppLayout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGetSession,
  useUpdateSession,
  useAnalyzeReferenceImage,
  useGetNextQuestion,
  useSubmitAnswer,
  useEnhancePrompt,
  useRevisePrompt,
  useRewritePrompt,
  useGenerateImages,
  useListTemplates,
  useCreateTemplate,
  useListFalModels,
  useRequestUploadUrl,
  getGetSessionQueryKey,
  getListTemplatesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { QAQuestion, EnhanceSuggestion, FalModel, Template, Session } from "@workspace/api-client-react";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Upload,
  X,
  Check,
  Wand2,
  RefreshCw,
  Download,
  ImageIcon,
  Bookmark,
  ArrowRight,
  Pencil,
  RotateCcw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function UploadZone({
  label,
  multiple = false,
  onUploaded,
  existingUrls = [],
}: {
  label: string;
  multiple?: boolean;
  onUploaded: (paths: string[]) => void;
  existingUrls?: string[];
}) {
  const [uploading, setUploading] = useState(false);
  const [localUrls, setLocalUrls] = useState<string[]>(existingUrls);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestUpload = useRequestUploadUrl();
  const { toast } = useToast();

  const handleFiles = async (files: File[]) => {
    setUploading(true);
    const paths: string[] = [];
    try {
      for (const file of files) {
        const result = await requestUpload.mutateAsync({
          data: { name: file.name, size: file.size, contentType: file.type },
        });
        await fetch(result.uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        paths.push(result.objectPath);
      }
      const newUrls = multiple ? [...localUrls, ...paths] : paths;
      setLocalUrls(newUrls);
      onUploaded(newUrls);
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeUrl = (idx: number) => {
    const updated = localUrls.filter((_, i) => i !== idx);
    setLocalUrls(updated);
    onUploaded(updated);
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm">{label}</Label>
      {localUrls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {localUrls.map((url, idx) => (
            <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group">
              <img src={`/api/storage${url}`} alt="" className="w-full h-full object-cover" />
              <button
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                onClick={() => removeUrl(idx)}
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div
        className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const files = Array.from(e.dataTransfer.files);
          handleFiles(files);
        }}
      >
        {uploading ? (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
        ) : (
          <>
            <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {multiple ? "Click or drag photos here" : "Click or drag a photo here"}
            </p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(Array.from(e.target.files || []))}
      />
    </div>
  );
}

function WizardStep({
  session,
  step,
  setStep,
  productId,
}: {
  session: Session;
  step: number;
  setStep: (s: number) => void;
  productId: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const sessionId = session.id;

  const [optionType, setOptionType] = useState<"A" | "B">(session.optionType as "A" | "B");
  const [outputType, setOutputType] = useState<"M1" | "M2">(session.outputType as "M1" | "M2");
  const [imageCount, setImageCount] = useState(session.imageCount || 2);
  const [productImageUrls, setProductImageUrls] = useState<string[]>(session.productImageUrls || []);
  const [referenceImageUrl, setReferenceImageUrl] = useState(session.referenceImageUrl || "");
  const [referenceStyle, setReferenceStyle] = useState<"SAME" | "IDEA">(
    (session.referenceStyle as "SAME" | "IDEA") || "SAME"
  );
  const [similarityLevel, setSimilarityLevel] = useState(session.similarityLevel || 70);
  const [templateInspirationId, setTemplateInspirationId] = useState(session.templateInspirationId || "");

  const { data: templates } = useListTemplates({
    query: {
      params: { productId },
      queryKey: getListTemplatesQueryKey({ productId }),
    },
  });

  const analyzeRef = useAnalyzeReferenceImage();

  const updateSession = useUpdateSession({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionId) });
      },
    },
  });

  const totalSteps = optionType === "B" ? 5 : 4;

  const saveAndNext = async () => {
    const data: Parameters<typeof updateSession.mutate>[0]["data"] = {
      optionType,
      outputType,
      imageCount: outputType === "M2" ? imageCount : undefined,
      productImageUrls,
      referenceImageUrl: optionType === "B" ? referenceImageUrl : undefined,
      referenceStyle: optionType === "B" ? referenceStyle : undefined,
      similarityLevel: optionType === "B" && referenceStyle === "SAME" ? similarityLevel : undefined,
      templateInspirationId: templateInspirationId || undefined,
    };

    if (step === totalSteps) {
      if (productImageUrls.length === 0) {
        toast({ title: "Upload at least one product photo", variant: "destructive" });
        return;
      }
      if (optionType === "B" && !referenceImageUrl) {
        toast({ title: "Upload a reference image for Option B", variant: "destructive" });
        return;
      }

      if (optionType === "B") {
        await updateSession.mutateAsync({ id: sessionId, data: { ...data, status: "analyzing" } });
        await analyzeRef.mutateAsync({ id: sessionId });
      } else {
        await updateSession.mutateAsync({ id: sessionId, data: { ...data, status: "qa" } });
      }
      queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionId) });
    } else {
      updateSession.mutate({ id: sessionId, data });
      setStep(step + 1);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">
          Step {step} of {totalSteps}
        </p>
        <Progress value={(step / totalSteps) * 100} className="w-32 h-1.5" />
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Choose Session Type</h2>
          <p className="text-muted-foreground text-sm">How will you be providing visual input for this mockup?</p>
          <div className="grid grid-cols-2 gap-4">
            {(["A", "B"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setOptionType(opt)}
                className={`p-5 rounded-xl border-2 text-left transition-all ${
                  optionType === opt
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <div className="text-lg font-bold mb-1">Option {opt}</div>
                <p className="text-sm text-muted-foreground">
                  {opt === "A"
                    ? "Product photos only — AI generates the scene."
                    : "Product + reference mockup — AI adapts from your reference."}
                </p>
                {optionType === opt && <Check className="w-4 h-4 text-primary mt-2" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Output Format</h2>
          <p className="text-muted-foreground text-sm">How many images do you want to generate?</p>
          <div className="grid grid-cols-2 gap-4">
            {(["M1", "M2"] as const).map((out) => (
              <button
                key={out}
                onClick={() => setOutputType(out)}
                className={`p-5 rounded-xl border-2 text-left transition-all ${
                  outputType === out
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <div className="text-lg font-bold mb-1">{out}</div>
                <p className="text-sm text-muted-foreground">
                  {out === "M1" ? "Single image output" : "Multiple images (2–8)"}
                </p>
                {outputType === out && <Check className="w-4 h-4 text-primary mt-2" />}
              </button>
            ))}
          </div>
          {outputType === "M2" && (
            <div className="space-y-2 pt-2">
              <Label>Number of images: {imageCount}</Label>
              <Slider
                value={[imageCount]}
                onValueChange={([v]) => setImageCount(v)}
                min={2}
                max={8}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>2</span>
                <span>8</span>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Upload Photos</h2>
          <UploadZone
            label="Product Photos"
            multiple
            existingUrls={productImageUrls}
            onUploaded={setProductImageUrls}
          />
          {optionType === "B" && (
            <UploadZone
              label="Reference Mockup"
              existingUrls={referenceImageUrl ? [referenceImageUrl] : []}
              onUploaded={(paths) => setReferenceImageUrl(paths[0] || "")}
            />
          )}
        </div>
      )}

      {step === 4 && optionType === "B" && (
        <div className="space-y-5">
          <h2 className="text-2xl font-bold">Reference Style</h2>
          <p className="text-muted-foreground text-sm">How should the AI use your reference mockup?</p>
          <div className="grid grid-cols-2 gap-4">
            {(["SAME", "IDEA"] as const).map((style) => (
              <button
                key={style}
                onClick={() => setReferenceStyle(style)}
                className={`p-5 rounded-xl border-2 text-left transition-all ${
                  referenceStyle === style
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <div className="text-lg font-bold mb-1">{style}</div>
                <p className="text-sm text-muted-foreground">
                  {style === "SAME"
                    ? "Replicate it closely — same composition and style."
                    : "Use it as inspiration only — same vibe, different approach."}
                </p>
                {referenceStyle === style && <Check className="w-4 h-4 text-primary mt-2" />}
              </button>
            ))}
          </div>
          {referenceStyle === "SAME" && (
            <div className="space-y-2 pt-2">
              <Label>Similarity Level: {similarityLevel}%</Label>
              <Slider
                value={[similarityLevel]}
                onValueChange={([v]) => setSimilarityLevel(v)}
                min={1}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Loose</span>
                <span>Exact</span>
              </div>
            </div>
          )}
        </div>
      )}

      {step === (optionType === "B" ? 5 : 4) && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Template Inspiration</h2>
          <p className="text-muted-foreground text-sm">
            Optionally base this session on a saved template for consistency.
          </p>
          {templates && templates.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTemplateInspirationId("")}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  !templateInspirationId ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                }`}
              >
                <div className="font-semibold text-sm">No template</div>
                <div className="text-xs text-muted-foreground mt-0.5">Start fresh</div>
              </button>
              {templates.map((tpl: Template) => (
                <button
                  key={tpl.id}
                  onClick={() => setTemplateInspirationId(tpl.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    templateInspirationId === tpl.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="font-semibold text-sm truncate">{tpl.name}</div>
                  <div className="flex gap-1 mt-1">
                    <Badge variant="secondary" className="text-xs">{tpl.type}</Badge>
                    <Badge variant="secondary" className="text-xs">Option {tpl.optionType}</Badge>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
              No templates saved for this product yet.
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        {step > 1 ? (
          <Button variant="outline" onClick={() => setStep(step - 1)}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        ) : (
          <div />
        )}
        <Button onClick={saveAndNext} disabled={updateSession.isPending || analyzeRef.isPending}>
          {updateSession.isPending || analyzeRef.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : null}
          {step === (optionType === "B" ? 5 : 4) ? (optionType === "B" ? "Analyze Reference" : "Start Q&A") : "Next"}
          {step < (optionType === "B" ? 5 : 4) && <ChevronRight className="w-4 h-4 ml-1" />}
        </Button>
      </div>
    </div>
  );
}

function QAPhase({ session }: { session: Session }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const sessionId = session.id;
  const [currentQuestion, setCurrentQuestion] = useState<QAQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [otherText, setOtherText] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [loadingNext, setLoadingNext] = useState(false);
  const [done, setDone] = useState(false);

  const getNext = useGetNextQuestion();
  const submitAnswer = useSubmitAnswer();

  const fetchNextQuestion = async () => {
    setLoadingNext(true);
    try {
      const q = await getNext.mutateAsync({ id: sessionId });
      if (q.done) {
        setDone(true);
        queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionId) });
      } else {
        setCurrentQuestion(q);
        setSelectedAnswer("");
        setOtherText("");
      }
    } catch {
      toast({ title: "Failed to get next question", variant: "destructive" });
    } finally {
      setLoadingNext(false);
    }
  };

  const handleSubmit = async () => {
    const answer = selectedAnswer === "__other__" ? otherText : selectedAnswer;
    if (!answer || !currentQuestion) return;
    try {
      await submitAnswer.mutateAsync({
        id: sessionId,
        data: { question: currentQuestion.question, answer, questionIndex },
      });
      setQuestionIndex((i) => i + 1);
      await fetchNextQuestion();
    } catch {
      toast({ title: "Failed to submit answer", variant: "destructive" });
    }
  };

  if (loadingNext && !currentQuestion && !done) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Generating question...</p>
      </div>
    );
  }

  if (!currentQuestion && !done) {
    return (
      <div className="max-w-xl mx-auto text-center py-20 space-y-4">
        <h2 className="text-2xl font-bold">Q&A Session</h2>
        <p className="text-muted-foreground text-sm">
          Answer a few questions to build your ideal mockup prompt.
        </p>
        <Button onClick={fetchNextQuestion} disabled={loadingNext}>
          {loadingNext ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Start Q&A
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Check className="w-12 h-12 text-green-500" />
        <h2 className="text-2xl font-bold">All done!</h2>
        <p className="text-muted-foreground text-sm">Building your prompt...</p>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isOther = selectedAnswer === "__other__";

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Question {questionIndex + 1}</p>
        <Badge variant="secondary" className="text-xs">Q&A Phase</Badge>
      </div>

      <h2 className="text-xl font-semibold leading-snug">{currentQuestion!.question}</h2>

      <div className="space-y-2">
        {currentQuestion!.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelectedAnswer(opt.value)}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-3 ${
              selectedAnswer === opt.value
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/30"
            }`}
          >
            <div
              className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                selectedAnswer === opt.value ? "border-primary bg-primary" : "border-muted-foreground"
              }`}
            >
              {selectedAnswer === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
            </div>
            <div className="min-w-0">
              <span className="text-sm font-medium">{opt.label}</span>
              {opt.isSuggested && (
                <Badge variant="secondary" className="ml-2 text-xs">Suggested</Badge>
              )}
            </div>
          </button>
        ))}
        <button
          onClick={() => setSelectedAnswer("__other__")}
          className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
            isOther ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
          }`}
        >
          <span className="text-sm font-medium text-muted-foreground">Other...</span>
        </button>
        {isOther && (
          <Input
            autoFocus
            placeholder="Type your own answer..."
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSubmit}
          disabled={!selectedAnswer || (isOther && !otherText) || submitAnswer.isPending || loadingNext}
        >
          {submitAnswer.isPending || loadingNext ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Next <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function PromptEnhancer({ session }: { session: Session }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const sessionId = session.id;

  const [prompt, setPrompt] = useState(session.enhancedPrompt || session.finalPrompt || "");
  const [suggestions, setSuggestions] = useState<EnhanceSuggestion[]>([]);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [reviseInstruction, setReviseInstruction] = useState("");
  const [showRevise, setShowRevise] = useState(false);
  const [showGenPanel, setShowGenPanel] = useState(false);

  const enhance = useEnhancePrompt();
  const revise = useRevisePrompt();
  const rewrite = useRewritePrompt();
  const updateSession = useUpdateSession();

  const handleEnhance = async () => {
    try {
      const result = await enhance.mutateAsync({ id: sessionId });
      setSuggestions(result.suggestions || []);
      setAccepted(new Set());
    } catch {
      toast({ title: "Enhancement failed", variant: "destructive" });
    }
  };

  const handleRevise = async () => {
    if (!reviseInstruction) return;
    try {
      const result = await revise.mutateAsync({ id: sessionId, data: { instruction: reviseInstruction } });
      setPrompt(result.prompt);
      setReviseInstruction("");
      setShowRevise(false);
      setSuggestions([]);
    } catch {
      toast({ title: "Revision failed", variant: "destructive" });
    }
  };

  const handleRewrite = async () => {
    try {
      const result = await rewrite.mutateAsync({ id: sessionId });
      setPrompt(result.prompt);
      setSuggestions([]);
    } catch {
      toast({ title: "Rewrite failed", variant: "destructive" });
    }
  };

  const acceptSuggestion = (idx: number) => {
    const s = suggestions[idx];
    setPrompt((p) => p.replace(s.original, s.replacement));
    setAccepted((prev) => new Set([...prev, idx]));
  };

  const savePrompt = () => {
    updateSession.mutate(
      { id: sessionId, data: { enhancedPrompt: prompt } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionId) });
          toast({ title: "Prompt saved" });
        },
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Prompt Editor</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Refine your AI-generated prompt before generating images.</p>
        </div>
        <Badge variant="secondary">Prompt Ready</Badge>
      </div>

      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="min-h-[180px] font-mono text-sm leading-relaxed"
        placeholder="Your prompt will appear here..."
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleEnhance} disabled={enhance.isPending}>
          {enhance.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 mr-1" />}
          Enhance
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRevise(!showRevise)}
        >
          <Pencil className="w-3.5 h-3.5 mr-1" />
          Revise
        </Button>
        <Button variant="outline" size="sm" onClick={handleRewrite} disabled={rewrite.isPending}>
          {rewrite.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1" />}
          Rewrite
        </Button>
        <Button size="sm" variant="outline" onClick={savePrompt} disabled={updateSession.isPending}>
          Save
        </Button>
      </div>

      {showRevise && (
        <div className="flex gap-2 animate-in slide-in-from-top-2 duration-200">
          <Input
            autoFocus
            placeholder="e.g. Make the lighting warmer and more dramatic..."
            value={reviseInstruction}
            onChange={(e) => setReviseInstruction(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRevise()}
          />
          <Button onClick={handleRevise} disabled={!reviseInstruction || revise.isPending} size="sm">
            {revise.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          </Button>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-sm font-medium text-muted-foreground">Suggestions</p>
          {suggestions.map((s, idx) => (
            <div
              key={idx}
              className={`border rounded-xl p-4 space-y-2 transition-all ${
                accepted.has(idx) ? "opacity-50 bg-muted/30" : "bg-card border-border/50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono bg-destructive/10 text-destructive px-1.5 py-0.5 rounded line-through truncate max-w-[200px]">
                      {s.original}
                    </span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-xs font-mono bg-green-100 text-green-700 px-1.5 py-0.5 rounded truncate max-w-[200px]">
                      {s.replacement}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.reason}</p>
                </div>
                {!accepted.has(idx) && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => acceptSuggestion(idx)}>
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setAccepted((p) => new Set([...p, idx]))}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border/50 pt-4">
        <Button className="w-full" onClick={() => setShowGenPanel(true)}>
          <ImageIcon className="w-4 h-4 mr-2" />
          Generate Images
        </Button>
      </div>

      <GenerationPanel
        session={session}
        open={showGenPanel}
        onClose={() => setShowGenPanel(false)}
        currentPrompt={prompt}
      />
    </div>
  );
}

function GenerationPanel({
  session,
  open,
  onClose,
  currentPrompt,
}: {
  session: Session;
  open: boolean;
  onClose: () => void;
  currentPrompt: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: falModels } = useListFalModels();
  const [selectedModelId, setSelectedModelId] = useState(session.falModelId || "");
  const [falParams, setFalParams] = useState<Record<string, unknown>>(
    (session.falParams as Record<string, unknown>) || {}
  );
  const generateImages = useGenerateImages();

  const selectedModel = falModels?.find((m: FalModel) => m.id === selectedModelId);
  const schema = (selectedModel?.paramsSchema as Record<string, unknown>) || {};

  const handleGenerate = async () => {
    if (!selectedModelId) {
      toast({ title: "Select a fal.io model first", variant: "destructive" });
      return;
    }
    try {
      await generateImages.mutateAsync({
        id: session.id,
        data: {
          falModelId: selectedModelId,
          falParams: Object.keys(falParams).length ? falParams : undefined,
          imageCount: session.imageCount || undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(session.id) });
      onClose();
    } catch {
      toast({ title: "Generation failed", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Images</DialogTitle>
          <DialogDescription>Select a fal.io model and configure parameters.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>fal.io Model</Label>
            {falModels?.length === 0 ? (
              <div className="text-sm text-muted-foreground border border-border rounded-lg p-3">
                No models configured.{" "}
                <Link href="/settings" className="text-primary underline">
                  Add one in Settings.
                </Link>
              </div>
            ) : (
              <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model..." />
                </SelectTrigger>
                <SelectContent>
                  {falModels?.map((m: FalModel) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedModel && Object.keys(schema).length > 0 && (
            <div className="border border-border rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Parameters</p>
              <div className="space-y-3">
                {Object.entries(schema).map(([key, def]) => {
                  const d = def as { type?: string; description?: string; default?: unknown };
                  const value = falParams[key] ?? d.default ?? "";
                  if (d.type === "boolean") {
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <Label className="text-sm">{key}</Label>
                        <input
                          type="checkbox"
                          checked={!!value}
                          onChange={(e) => setFalParams((p) => ({ ...p, [key]: e.target.checked }))}
                        />
                      </div>
                    );
                  }
                  if (d.type === "number" || d.type === "integer") {
                    return (
                      <div key={key} className="space-y-1">
                        <Label className="text-sm">{key}</Label>
                        <Input
                          type="number"
                          value={String(value)}
                          onChange={(e) => setFalParams((p) => ({ ...p, [key]: Number(e.target.value) }))}
                          className="h-8 text-sm"
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={key} className="space-y-1">
                      <Label className="text-sm">{key}</Label>
                      <Input
                        value={String(value)}
                        onChange={(e) => setFalParams((p) => ({ ...p, [key]: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-1 space-y-1">
            <Label className="text-xs text-muted-foreground">Prompt Preview</Label>
            <p className="text-xs text-muted-foreground font-mono line-clamp-3 bg-muted/30 p-2 rounded-lg">
              {currentPrompt}
            </p>
          </div>

          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={!selectedModelId || generateImages.isPending}
          >
            {generateImages.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ImageIcon className="w-4 h-4 mr-2" />
            )}
            {generateImages.isPending ? "Generating..." : "Generate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResultsGallery({ session }: { session: Session }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saveOpen, setSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);

  const createTemplate = useCreateTemplate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey({ productId: session.productId }) });
        setSaveOpen(false);
        setTemplateName("");
        toast({ title: "Template saved!" });
      },
      onError: () => {
        toast({ title: "Failed to save template", variant: "destructive" });
      },
    },
  });

  const images: string[] = session.generatedImageUrls || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Generated Mockups</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{images.length} image{images.length !== 1 ? "s" : ""} generated</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)}>
            <Bookmark className="w-3.5 h-3.5 mr-1" />
            Save as Template
          </Button>
          <Link href={`/products/${session.productId}`}>
            <Button size="sm" variant="outline">
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Back to Product
            </Button>
          </Link>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Images are being generated...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((url, idx) => (
            <div key={idx} className="group relative aspect-square bg-muted rounded-xl overflow-hidden border border-border/50">
              <img
                src={`/api/storage${url}`}
                alt={`Generated mockup ${idx + 1}`}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setFullscreenImg(url)}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-end justify-end p-2 gap-2 opacity-0 group-hover:opacity-100">
                <a
                  href={`/api/storage${url}`}
                  download={`mockup-${idx + 1}.jpg`}
                  className="bg-white/90 rounded-lg p-2 hover:bg-white transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="w-4 h-4 text-gray-800" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {session.finalPrompt && (
        <div className="bg-card border border-border/50 rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Final Prompt Used</p>
          <p className="text-sm font-mono">{session.enhancedPrompt || session.finalPrompt}</p>
        </div>
      )}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>Give this session a name to reuse it as a starting point for future sessions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              autoFocus
              placeholder="e.g. Warm Studio Lifestyle Shot"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={!templateName || createTemplate.isPending}
              onClick={() => createTemplate.mutate({ data: { sessionId: session.id, name: templateName } })}
            >
              {createTemplate.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!fullscreenImg} onOpenChange={() => setFullscreenImg(null)}>
        <DialogContent className="max-w-3xl p-2">
          {fullscreenImg && (
            <img src={`/api/storage${fullscreenImg}`} alt="Full view" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [step, setStep] = useState(1);

  const { data: session, isLoading } = useGetSession(id!, {
    query: {
      enabled: !!id,
      queryKey: getGetSessionQueryKey(id!),
      refetchInterval: (query) => {
        const data = query.state.data as Session | undefined;
        if (data?.status === "generating" || data?.status === "analyzing") return 3000;
        return false;
      },
    },
  });

  if (isLoading || !session) {
    return (
      <AppLayout>
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const renderContent = () => {
    switch (session.status) {
      case "draft":
        return (
          <WizardStep
            session={session}
            step={step}
            setStep={setStep}
            productId={session.productId}
          />
        );
      case "analyzing":
        return (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
            <h2 className="text-xl font-semibold">Analyzing Reference Image</h2>
            <p className="text-muted-foreground text-sm">Extracting style, composition, and mood from your reference...</p>
          </div>
        );
      case "qa":
        return <QAPhase session={session} />;
      case "prompt_ready":
        return <PromptEnhancer session={session} />;
      case "generating":
        return (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
            <h2 className="text-xl font-semibold">Generating Images</h2>
            <p className="text-muted-foreground text-sm">Your mockups are being created by fal.io...</p>
          </div>
        );
      case "completed":
        return <ResultsGallery session={session} />;
      case "failed":
        return (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
              <X className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold">Generation Failed</h2>
            <p className="text-muted-foreground text-sm">Something went wrong. Check your API keys and model configuration.</p>
            <Link href={`/products/${session.productId}`}>
              <Button variant="outline">Back to Product</Button>
            </Link>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AppLayout>
      <div className="animate-in fade-in duration-300">
        <div className="flex items-center gap-3 mb-8">
          <Link href={`/products/${session.productId}`}>
            <Button variant="ghost" size="icon">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">Mockup Session</h1>
            <Badge variant="secondary" className="text-xs capitalize">
              {session.status.replace("_", " ")}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Option {session.optionType} / {session.outputType}
            </Badge>
          </div>
        </div>
        {renderContent()}
      </div>
    </AppLayout>
  );
}
