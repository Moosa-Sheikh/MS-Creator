import { useListTemplates, getListTemplatesQueryKey } from "@workspace/api-client-react";
import { Check, FolderOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = {
  productId: string;
  outputType: "M1" | "M2" | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

function objectPathToUrl(objectPath: string): string {
  const filename = objectPath.replace("/objects/", "");
  return `/api/storage/objects/${filename}`;
}

export function TemplatePicker({ productId, outputType, selectedId, onSelect, onConfirm, onCancel }: Props) {
  const { data: templates, isLoading } = useListTemplates(
    { productId },
    { query: { queryKey: getListTemplatesQueryKey({ productId }) } }
  );

  const filtered = (templates ?? []).filter(
    (t) => !outputType || t.type === outputType
  );

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-10 space-y-2">
        <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium">No templates yet</p>
        <p className="text-xs text-muted-foreground">
          No {outputType ?? ""} templates saved for this product. Start fresh to create your first one.
        </p>
        <Button variant="outline" size="sm" onClick={onCancel} className="mt-2">
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[340px] overflow-y-auto pr-1">
        {filtered.map((tpl) => {
          const thumb = tpl.imageUrls?.[0] ? objectPathToUrl(tpl.imageUrls[0]) : null;
          const isSelected = tpl.id === selectedId;
          return (
            <button
              key={tpl.id}
              onClick={() => onSelect(tpl.id)}
              className={cn(
                "relative text-left rounded-xl border-2 overflow-hidden transition-all",
                isSelected ? "border-primary shadow-sm" : "border-border hover:border-primary/30"
              )}
            >
              {isSelected && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-10">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </span>
              )}
              <div className="aspect-square bg-muted">
                {thumb ? (
                  <img src={thumb} alt={tpl.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FolderOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="text-xs font-medium truncate">{tpl.name}</p>
                <p className="text-[10px] text-muted-foreground">{tpl.type}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" disabled={!selectedId} onClick={onConfirm}>
          Use This Template
        </Button>
      </div>
    </div>
  );
}
