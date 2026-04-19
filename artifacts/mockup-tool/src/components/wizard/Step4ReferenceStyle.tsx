import { Check, RefreshCw, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";

type Style = "SAME" | "IDEA";

type Props = {
  value: Style | null;
  similarityLevel: number;
  onChange: (v: Style) => void;
  onSimilarityChange: (n: number) => void;
};

const OPTIONS = [
  {
    id: "SAME" as Style,
    title: "SAME — Replicate the Setup",
    icon: RefreshCw,
    description:
      "AI will replace the product in the reference image with YOUR product. The lighting, angle, background, and setup will stay the same.",
    best: "When you want the exact same look as the reference, adapted for you.",
  },
  {
    id: "IDEA" as Style,
    title: "IDEA — Use as Inspiration",
    icon: Lightbulb,
    description:
      "AI takes the style, mood, and composition IDEA from the reference, then creates a fresh mockup tailored to your product.",
    best: "When you love a competitor's aesthetic but want something original.",
  },
];

export function Step4ReferenceStyle({ value, similarityLevel, onChange, onSimilarityChange }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">How should AI use the reference image?</h2>
        <p className="text-sm text-muted-foreground mt-1">Choose how closely the AI should follow your reference.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className={cn(
                "relative text-left rounded-xl border-2 p-5 transition-all space-y-3",
                selected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/30 hover:bg-muted/20"
              )}
            >
              {selected && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </span>
              )}
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Icon className="h-5 w-5 text-foreground" />
              </div>
              <p className="font-semibold text-sm">{opt.title}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{opt.description}</p>
              <p className="text-xs text-muted-foreground border-t border-border pt-2">
                <span className="font-medium">Best for:</span> {opt.best}
              </p>
            </button>
          );
        })}
      </div>

      {value === "SAME" && (
        <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-4">
          <div>
            <p className="text-sm font-medium">Similarity Level</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              How closely should AI match the reference setup?
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground text-xs">Low (loosely inspired)</span>
              <span className="font-semibold text-primary">{similarityLevel}%</span>
              <span className="text-muted-foreground text-xs">High (near-identical)</span>
            </div>
            <Slider
              min={1}
              max={100}
              step={1}
              value={[similarityLevel]}
              onValueChange={([v]) => onSimilarityChange(v)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
