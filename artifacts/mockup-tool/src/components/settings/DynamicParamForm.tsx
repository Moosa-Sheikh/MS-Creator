import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

export type PreviewParam = {
  key: string;
  type: "string" | "number" | "boolean" | "integer";
  defaultValue: string | number | boolean | null;
  auto: boolean;
};

type Props = {
  params: PreviewParam[];
  values: Record<string, unknown>;
  enabledMap: Record<string, boolean>;
  onChange: (key: string, value: unknown) => void;
  onToggleEnabled: (key: string, enabled: boolean) => void;
  readonly?: boolean;
};

const AUTO_NOTES: Record<string, string> = {
  prompt: "Auto-filled from the generated prompt at run time.",
  image_url: "Auto-filled from the uploaded reference image at run time.",
};

export function DynamicParamForm({ params, values, enabledMap, onChange, onToggleEnabled, readonly }: Props) {
  if (!params.length) return null;

  return (
    <div className="space-y-4">
      {params.map((param) => {
        const isEnabled = param.auto ? true : (enabledMap[param.key] ?? true);
        const value = values[param.key] ?? param.defaultValue ?? "";
        const autoNote = AUTO_NOTES[param.key];

        return (
          <div
            key={param.key}
            className={`space-y-1.5 ${!isEnabled && !param.auto ? "opacity-50" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">{param.key}</Label>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                  {param.type}
                </Badge>
                {param.auto && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground border-dashed">
                    auto
                  </Badge>
                )}
              </div>
              {!param.auto && (
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(v) => onToggleEnabled(param.key, v)}
                  disabled={readonly}
                />
              )}
            </div>

            {autoNote && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-md px-2 py-1.5">
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{autoNote}</span>
              </div>
            )}

            {!param.auto && (
              <>
                {param.type === "boolean" ? (
                  <Switch
                    checked={!!value}
                    onCheckedChange={(v) => onChange(param.key, v)}
                    disabled={!isEnabled || readonly}
                  />
                ) : param.type === "number" || param.type === "integer" ? (
                  <Input
                    type="number"
                    value={String(value)}
                    onChange={(e) => onChange(param.key, param.type === "integer" ? parseInt(e.target.value) : parseFloat(e.target.value))}
                    disabled={!isEnabled || readonly}
                    className="h-8 text-sm font-mono"
                  />
                ) : (
                  <Input
                    value={String(value)}
                    onChange={(e) => onChange(param.key, e.target.value)}
                    disabled={!isEnabled || readonly}
                    className="h-8 text-sm"
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
