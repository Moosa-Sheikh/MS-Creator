import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateSession } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Step1OptionSelect } from "./Step1OptionSelect";
import { Step2OutputSelect } from "./Step2OutputSelect";
import { Step3PhotoUpload } from "./Step3PhotoUpload";
import { Step4ReferenceStyle } from "./Step4ReferenceStyle";
import { Step5TemplateSelect } from "./Step5TemplateSelect";
import { useToast } from "@/hooks/use-toast";

type UploadedFile = {
  objectPath: string;
  previewUrl: string;
  name: string;
};

interface WizardState {
  option: "A" | "B" | null;
  output: "M1" | "M2" | null;
  imageCount: number;
  photoMode: "single" | "multiple";
  productImages: UploadedFile[];
  referenceImage: UploadedFile[];
  referenceStyle: "SAME" | "IDEA" | null;
  similarityLevel: number;
  templateInspirationId: string | null;
}

const INITIAL_STATE: WizardState = {
  option: null,
  output: null,
  imageCount: 4,
  photoMode: "single",
  productImages: [],
  referenceImage: [],
  referenceStyle: null,
  similarityLevel: 75,
  templateInspirationId: null,
};

type StepDef = {
  key: string;
  label: string;
};

function getSteps(option: "A" | "B" | null): StepDef[] {
  const base: StepDef[] = [
    { key: "option", label: "Option" },
    { key: "output", label: "Output" },
    { key: "upload", label: "Upload" },
  ];
  if (option === "B") {
    base.push({ key: "style", label: "Style" });
  }
  base.push({ key: "template", label: "Template" });
  return base;
}

function isStepComplete(stepKey: string, state: WizardState): boolean {
  switch (stepKey) {
    case "option":
      return state.option !== null;
    case "output":
      return state.output !== null;
    case "upload":
      if (state.productImages.length === 0) return false;
      if (state.option === "B" && state.referenceImage.length === 0) return false;
      return true;
    case "style":
      return state.referenceStyle !== null;
    case "template":
      return true; // always valid — null = start fresh
    default:
      return true;
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
};

export function WizardModal({ open, onOpenChange, productId }: Props) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [stepIndex, setStepIndex] = useState(0);
  const [confirmClose, setConfirmClose] = useState(false);

  const createSession = useCreateSession({
    mutation: {
      onSuccess: (session) => {
        onOpenChange(false);
        setState(INITIAL_STATE);
        setStepIndex(0);
        setLocation(`/session/${session.id}`);
      },
      onError: () => {
        toast({ title: "Failed to create session", variant: "destructive" });
      },
    },
  });

  const steps = getSteps(state.option);
  const currentStep = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const canAdvance = currentStep ? isStepComplete(currentStep.key, state) : false;

  const update = (patch: Partial<WizardState>) => setState((s) => ({ ...s, ...patch }));

  const handleNext = () => {
    if (isLast) {
      // Submit
      createSession.mutate({
        data: {
          productId,
          optionType: state.option!,
          outputType: state.output!,
          imageCount: state.output === "M2" ? state.imageCount : null,
          referenceStyle: state.option === "B" ? state.referenceStyle : null,
          similarityLevel:
            state.option === "B" && state.referenceStyle === "SAME"
              ? state.similarityLevel
              : null,
          productImageUrls: state.productImages.map((f) => f.objectPath),
          referenceImageUrl:
            state.option === "B" && state.referenceImage[0]
              ? state.referenceImage[0].objectPath
              : null,
          templateInspirationId: state.templateInspirationId ?? null,
        },
      });
    } else {
      // If option changes from B to A, remove style step offset
      const nextIndex = stepIndex + 1;
      setStepIndex(nextIndex);
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  const handleCloseRequest = () => {
    const hasData =
      state.option !== null ||
      state.productImages.length > 0 ||
      state.referenceImage.length > 0;
    if (hasData) {
      setConfirmClose(true);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setState(INITIAL_STATE);
    setStepIndex(0);
    onOpenChange(false);
  };

  // When option changes from B to A and we're past the style step, jump back
  const handleOptionChange = (opt: "A" | "B") => {
    update({ option: opt, referenceStyle: null, referenceImage: [] });
    // If we go from B to A and stepIndex points to the style step, stay at option step
    setStepIndex(0);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) handleCloseRequest();
        }}
      >
        <DialogContent
          className="max-w-2xl w-full p-0 gap-0 overflow-hidden"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">Create New Mockup</DialogTitle>

          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Create New Mockup
              </p>
              <button
                onClick={handleCloseRequest}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-1.5">
              {steps.map((step, i) => (
                <div key={step.key} className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                        i < stepIndex
                          ? "bg-primary text-primary-foreground"
                          : i === stepIndex
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {i + 1}
                    </div>
                    <span
                      className={cn(
                        "text-xs hidden sm:block",
                        i === stepIndex ? "font-medium text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={cn(
                        "h-px flex-1 mx-1 transition-colors",
                        i < stepIndex ? "bg-primary" : "bg-border"
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6 overflow-y-auto max-h-[60vh]">
            {currentStep?.key === "option" && (
              <Step1OptionSelect
                value={state.option}
                onChange={handleOptionChange}
              />
            )}
            {currentStep?.key === "output" && (
              <Step2OutputSelect
                value={state.output}
                imageCount={state.imageCount}
                onChange={(v) => update({ output: v })}
                onCountChange={(n) => update({ imageCount: n })}
              />
            )}
            {currentStep?.key === "upload" && (
              <Step3PhotoUpload
                option={state.option!}
                photoMode={state.photoMode}
                productImages={state.productImages}
                referenceImage={state.referenceImage}
                onPhotoModeChange={(mode) => update({ photoMode: mode })}
                onProductImagesChange={(files) => update({ productImages: files })}
                onReferenceImageChange={(files) => update({ referenceImage: files })}
              />
            )}
            {currentStep?.key === "style" && (
              <Step4ReferenceStyle
                value={state.referenceStyle}
                similarityLevel={state.similarityLevel}
                onChange={(v) => update({ referenceStyle: v })}
                onSimilarityChange={(n) => update({ similarityLevel: n })}
              />
            )}
            {currentStep?.key === "template" && (
              <Step5TemplateSelect
                productId={productId}
                outputType={state.output}
                templateInspirationId={state.templateInspirationId}
                onSelect={(id) => update({ templateInspirationId: id })}
              />
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              disabled={stepIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleCloseRequest}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleNext}
                disabled={!canAdvance || createSession.isPending}
              >
                {createSession.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isLast ? "Start Creating" : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this session?</AlertDialogTitle>
            <AlertDialogDescription>
              Your selections and uploaded files will be lost. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmClose(false)}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={handleClose}>
              Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
