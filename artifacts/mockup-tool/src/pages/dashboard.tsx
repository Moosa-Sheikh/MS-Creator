import { useState } from "react";
import { AppLayout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Plus, Package, Loader2 } from "lucide-react";
import { useListProducts } from "@workspace/api-client-react";
import { ProductGrid } from "@/components/products/ProductGrid";
import { CreateProductModal } from "@/components/products/CreateProductModal";
import { DeleteProductDialog } from "@/components/products/DeleteProductDialog";
import { ActiveProductBanner } from "@/components/ActiveProductBanner";
import { useActiveProduct } from "@/contexts/ActiveProductContext";

type Product = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
};

export default function Dashboard() {
  const { data: products, isLoading } = useListProducts();
  const { activeProduct, setActiveProductId, clearActiveProduct } = useActiveProduct();

  const [createOpen, setCreateOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

  const handleOpen = (product: Product) => {
    if (activeProduct?.id === product.id) {
      clearActiveProduct();
    } else {
      setActiveProductId(product.id);
    }
  };

  const handleEdit = (product: Product) => {
    setEditProduct(product);
  };

  const handleDelete = (product: Product) => {
    setDeleteProduct(product);
  };

  const handleDeleted = (id: string) => {
    if (activeProduct?.id === id) {
      clearActiveProduct();
    }
  };

  const productList: Product[] = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    createdAt: p.createdAt,
  }));

  return (
    <AppLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Picture Analysis</h1>
            <p className="text-muted-foreground mt-1">
              Create AI-powered mockups for your Etsy products.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            New Product
          </Button>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : productList.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-xl p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No products yet</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Create your first product to start generating mockups for it.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Product
            </Button>
          </div>
        ) : (
          <ProductGrid
            products={productList}
            activeProductId={activeProduct?.id ?? null}
            onOpen={handleOpen}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}

        {activeProduct && (
          <ActiveProductBanner product={activeProduct} />
        )}
      </div>

      <CreateProductModal
        open={createOpen || !!editProduct}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditProduct(null);
          }
        }}
        editProduct={editProduct}
        onCreated={(p) => setActiveProductId(p.id)}
      />

      <DeleteProductDialog
        open={!!deleteProduct}
        onOpenChange={(open) => !open && setDeleteProduct(null)}
        product={deleteProduct}
        onDeleted={handleDeleted}
      />
    </AppLayout>
  );
}
