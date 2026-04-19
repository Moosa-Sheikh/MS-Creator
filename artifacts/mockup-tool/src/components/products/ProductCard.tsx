import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
};

type Props = {
  product: Product;
  isActive: boolean;
  onOpen: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
};

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const days = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  if (months < 12) return `${months} months ago`;
  return `${Math.floor(months / 12)} years ago`;
}

export function ProductCard({ product, isActive, onOpen, onEdit, onDelete }: Props) {
  return (
    <Card
      className={cn(
        "flex flex-col transition-all border",
        isActive
          ? "ring-2 ring-primary border-primary/30 shadow-md"
          : "border-border/50 hover:border-primary/20 hover:shadow-sm"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">{product.name}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 -mt-1 -mr-1">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Product options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(product)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(product)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardDescription className="line-clamp-2 min-h-[2.5rem] text-sm">
          {product.description || <span className="italic opacity-60">No description</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto pt-0 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Created {timeAgo(product.createdAt)}
        </span>
        <Button
          size="sm"
          variant={isActive ? "default" : "outline"}
          onClick={() => onOpen(product)}
          className="shrink-0"
        >
          <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
          Open
        </Button>
      </CardContent>
    </Card>
  );
}
