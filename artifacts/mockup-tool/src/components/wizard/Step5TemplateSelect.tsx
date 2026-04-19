import { useState } from "react";
import { FolderOpen, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplatePicker } from "./TemplatePicker";
import { cn } from "@/lib/utils";

type Props = {
  productId: string;
  outputType: "M1" | "M2" | null;
  templateInspirationId: string | null;
  onSelect: (id: string | null) => void;
};

export function Step5TemplateSelect({ productId, outputType, templateInspirationId, onSelect }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSelected, setPickerSelected] = useState<string | null>(templateInspirationId);

  if (showPicker) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Choose a Template</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a saved template as inspiration for this session.
          </p>
        </div>
        <TemplatePicker
          productId={productId}
          outputType={outputType}
          selectedId={pickerSelected}
          onSelect={setPickerSelected}
          onConfirm={() => {
            onSelect(pickerSelected);
            setShowPicker(false);
          }}
          onCancel={() => setShowPicker(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Start from a saved template or from scratch?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Templates speed up the Q&A phase by giving AI a starting context.
        </p>
      </div>

      <div className="space-y-3">
        <div
          className={cn(
            "rounded-xl border-2 p-5 space-y-3 transition-all",
            templateInspirationId
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <FolderOpen className="h-5 w-5 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Use a Saved Template</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Start with a template you saved from a previous successful mockup. AI will use it as context.
              </p>
            </div>
            {templateInspirationId && (
              <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 text-primary-foreground" />
              </span>
            )}
          </div>
          <Button
            variant={templateInspirationId ? "default" : "outline"}
            size="sm"
            onClick={() => setShowPicker(true)}
          >
            {templateInspirationId ? "Change Template" : "Browse Templates"}
          </Button>
          {templateInspirationId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelect(null)}
              className="ml-2 text-muted-foreground"
            >
              Remove
            </Button>
          )}
        </div>

        <div
          className={cn(
            "rounded-xl border-2 p-5 space-y-3 transition-all",
            !templateInspirationId ? "border-primary bg-primary/5 shadow-sm" : "border-border"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Start from Scratch</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                AI will ask questions and build your prompt fresh, with no prior template context.
              </p>
            </div>
            {!templateInspirationId && (
              <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 text-primary-foreground" />
              </span>
            )}
          </div>
          <Button
            variant={!templateInspirationId ? "default" : "outline"}
            size="sm"
            onClick={() => onSelect(null)}
          >
            Start Fresh
          </Button>
        </div>
      </div>
    </div>
  );
}
