import { ProductCard } from "./ProductCard";

type Product = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
};

type Props = {
  products: Product[];
  activeProductId: string | null;
  onOpen: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
};

export function ProductGrid({ products, activeProductId, onOpen, onEdit, onDelete }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          isActive={product.id === activeProductId}
          onOpen={onOpen}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
