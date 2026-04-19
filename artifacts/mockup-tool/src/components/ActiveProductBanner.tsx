import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Palette, FolderOpen } from "lucide-react";
import { useListTemplates, getListTemplatesQueryKey } from "@workspace/api-client-react";

type Props = {
  product: {
    id: string;
    name: string;
    description: string | null;
  };
  onCreateMockup: () => void;
};

export function ActiveProductBanner({ product, onCreateMockup }: Props) {
  const [, navigate] = useLocation();

  const { data: templates } = useListTemplates(
    { productId: product.id },
    {
      query: {
        queryKey: getListTemplatesQueryKey({ productId: product.id }),
        staleTime: 30_000,
      },
    }
  );

  const templateCount = (templates as unknown[])?.length ?? 0;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold text-sm">
            Active Product: <span className="text-primary">{product.name}</span>
          </p>
          {product.description && (
            <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
              {product.description}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 pl-8">
        <Button size="sm" onClick={onCreateMockup}>
          <Palette className="h-4 w-4 mr-2" />
          Create New Mockup
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/templates/${product.id}`)}
        >
          <FolderOpen className="h-4 w-4 mr-2" />
          View Templates{templateCount > 0 ? ` (${templateCount})` : ""}
        </Button>
      </div>
    </div>
  );
}
