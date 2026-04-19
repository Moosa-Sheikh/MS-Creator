import { useState, useEffect } from "react";
import { useCreateProduct, useUpdateProduct, useListProducts } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListProductsQueryKey } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Product = {
  id: string;
  name: string;
  description: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editProduct?: Product | null;
  onCreated?: (product: Product) => void;
};

export function CreateProductModal({ open, onOpenChange, editProduct, onCreated }: Props) {
  const isEdit = !!editProduct;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setName(editProduct?.name ?? "");
      setDescription(editProduct?.description ?? "");
    }
  }, [open, editProduct]);

  const createMutation = useCreateProduct({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        toast({ title: "Product created", description: `"${data.name}" is ready.` });
        onCreated?.({ id: data.id, name: data.name, description: data.description ?? null });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: "Failed to create product", variant: "destructive" });
      },
    },
  });

  const updateMutation = useUpdateProduct({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        toast({ title: "Product updated" });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: "Failed to update product", variant: "destructive" });
      },
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (isEdit && editProduct) {
      updateMutation.mutate({
        id: editProduct.id,
        data: { name: name.trim(), description: description.trim() || null },
      });
    } else {
      createMutation.mutate({
        data: { name: name.trim(), description: description.trim() || null },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Product" : "Create New Product"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the name or description of this product."
              : "Add a product to start generating mockups for it."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="product-name">Product Name</Label>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 100))}
              placeholder="e.g., Crochet Cap, Linen Tote Bag"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="product-desc">Short Description</Label>
              <span className="text-xs text-muted-foreground">{description.length}/500</span>
            </div>
            <Textarea
              id="product-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="Describe what this product is — e.g., handmade crochet cap in earthy tones"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
