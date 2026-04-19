import { useState } from "react";
import { Check, Image, Images } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Output = "M1" | "M2";

type Props = {
  value: Output | null;
  imageCount: number;
  onChange: (v: Output) => void;
  onCountChange: (n: number) => void;
};

const OPTIONS = [
  {
    id: "M1" as Output,
    title: "M1 — Single Mockup",
    icon: Image,
    description:
      "One final mockup image. Perfect for testing or when you know exactly what you want.",
  },
  {
    id: "M2" as Output,
    title: "M2 — Multiple Mockups",
    icon: Images,
    description:
      "A set of mockup images (you choose how many). Great for listings with multiple angles or styles.",
  },
];

export function Step2OutputSelect({ value, imageCount, onChange, onCountChange }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">How many mockup images do you want?</h2>
        <p className="text-sm text-muted-foreground mt-1">Choose the output format for this session.</p>
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
            </button>
          );
        })}
      </div>
      {value === "M2" && (
        <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
          <Label htmlFor="image-count" className="text-sm">How many mockups?</Label>
          <div className="flex items-center gap-3">
            <Input
              id="image-count"
              type="number"
              min={2}
              max={8}
              value={imageCount}
              onChange={(e) => onCountChange(Math.min(8, Math.max(2, Number(e.target.value))))}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">images (2–8)</span>
          </div>
        </div>
      )}
    </div>
  );
}
