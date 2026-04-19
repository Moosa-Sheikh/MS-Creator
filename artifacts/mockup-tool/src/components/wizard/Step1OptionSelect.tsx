import { Check, Camera, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = "A" | "B";

type Props = {
  value: Option | null;
  onChange: (v: Option) => void;
};

const OPTIONS = [
  {
    id: "A" as Option,
    title: "Option A",
    subtitle: "Your Product Only",
    icon: Camera,
    description:
      "Upload your product photo(s) and let AI create a professional mockup from scratch in your style.",
    best: "Starting fresh with no reference in mind.",
  },
  {
    id: "B" as Option,
    title: "Option B",
    subtitle: "With Reference",
    icon: ImagePlus,
    description:
      "Upload your product photo(s) AND a reference mockup image (e.g., a competitor's listing or an expert sample). AI will use the reference as inspiration or replicate its setup for your product.",
    best: "When you have a mockup style you admire.",
  },
];

export function Step1OptionSelect({ value, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">How would you like to create your mockup?</h2>
        <p className="text-sm text-muted-foreground mt-1">Choose the input method for this session.</p>
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
              <div>
                <p className="font-semibold text-sm">{opt.title}</p>
                <p className="text-sm text-primary font-medium">{opt.subtitle}</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{opt.description}</p>
              <p className="text-xs text-muted-foreground border-t border-border pt-2">
                <span className="font-medium">Best for:</span> {opt.best}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
