import { useDeleteProduct, getListProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: { id: string; name: string } | null;
  onDeleted?: (id: string) => void;
};

export function DeleteProductDialog({ open, onOpenChange, product, onDeleted }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useDeleteProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        toast({ title: "Product deleted" });
        if (product) onDeleted?.(product.id);
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: "Failed to delete product", variant: "destructive" });
      },
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {product?.name ?? "Product"}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete this product and all its templates and sessions. This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => product && deleteMutation.mutate({ id: product.id })}
          >
            {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
