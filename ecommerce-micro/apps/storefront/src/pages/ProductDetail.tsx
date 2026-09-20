import { Package, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getProduct } from "../api/products";
import { addToCart } from "../api/orders";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastProvider";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Skeleton, SkeletonText } from "../components/ui/Skeleton";
import { QuantityStepper } from "../components/ui/QuantityStepper";

export function ProductDetail() {
  const { productId = "" } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { success, error: errToast } = useToast();
  const [quantity, setQuantity] = useState(1);

  const { data: product, isLoading, error } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => getProduct(productId),
    staleTime: 1000 * 60,
  });

  const addMutation = useMutation({
    mutationFn: () => addToCart({ productId, quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      success(`${product?.name ?? "Item"} added to cart`);
      navigate("/cart");
    },
    onError: (e) => errToast((e as Error).message),
  });

  if (isLoading) {
    return (
      <div className="grid gap-8 lg:gap-12 xl:grid-cols-2">
        <Skeleton className="aspect-square w-full" />
        <div className="space-y-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-7 w-32" />
          <SkeletonText lines={4} />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="card py-12 text-center">
        <p className="mb-1 flex justify-center text-slate-300"><Package className="h-8 w-8" /></p>
        <h3 className="text-lg font-semibold text-slate-700">Product not found</h3>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          It may have been removed or the link is incorrect.
        </p>
        <div className="mt-6">
          <Button variant="secondary" onClick={() => navigate("/")}>Back to catalog</Button>
        </div>
      </div>
    );
  }

  const outOfStock = product.available <= 0;
  const isLow = product.available > 0 && product.available <= 5;

  return (
    <div className="grid gap-10 lg:gap-12 xl:grid-cols-2">
      {/* Image */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-200">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="aspect-square w-full object-cover object-center" />
        ) : (
          <div className="grid aspect-square w-full place-items-center text-slate-300">
            <Package className="h-16 w-16" />
          </div>
        )}
        <span className="absolute left-4 top-4">
          <Badge tone="neutral">{product.category}</Badge>
        </span>
        {outOfStock && (
          <div className="absolute inset-0 grid place-items-center bg-white/75">
            <Badge tone="danger">Out of stock</Badge>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-col">
        <header className="mb-6">
          <p className="text-sm font-medium text-amber-700 uppercase tracking-wider">{product.category}</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{product.name}</h1>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="text-3xl font-semibold text-slate-900">${(product.priceCents / 100).toFixed(2)}</p>
            <span className="text-sm font-medium text-slate-500">{product.currency}</span>
            <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${outOfStock ? "bg-rose-100 text-rose-800" : isLow ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
              {outOfStock ? "Out of stock" : isLow ? `Only ${product.available} left` : `${product.available} in stock`}
            </span>
          </div>
        </header>

        <p className="mb-8 leading-relaxed text-slate-600">{product.description}</p>

        {isAuthenticated ? (
          <div className="mt-auto">
            {outOfStock ? (
              <div className="rounded-lg bg-slate-100 px-4 py-3 text-center text-sm text-slate-500">
                This product is currently unavailable.
              </div>
            ) : (
              <div className="flex items-end gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">Quantity</label>
                  <QuantityStepper value={quantity} min={1} max={product.available} onChange={setQuantity} />
                </div>
                <Button
                  className="flex-1"
                  loading={addMutation.isPending}
                  onClick={() => addMutation.mutate()}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Add to cart
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-auto rounded-lg bg-amber-50 px-4 py-3 text-center text-sm">
            <a href="/login" className="font-medium text-amber-700 hover:underline">Log in</a> to add this to your cart.
          </div>
        )}
      </div>
    </div>
  );
}
