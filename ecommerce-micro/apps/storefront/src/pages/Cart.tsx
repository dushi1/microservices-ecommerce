import { ShoppingCart, Package, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCart, removeCartItem, addToCart } from "../api/orders";
import { useToast } from "../components/ToastProvider";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { QuantityStepper } from "../components/ui/QuantityStepper";

export function Cart() {
  const queryClient = useQueryClient();
  const { success } = useToast();
  const { data: cart, isLoading } = useQuery({ queryKey: ["cart"], queryFn: fetchCart });

  const updateMutation = useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      quantity === 0 ? removeCartItem(productId) : addToCart({ productId, quantity }),
    onMutate: async ({ productId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: ["cart"] });
      const prev = queryClient.getQueryData<{ items: any[]; totalCents: number; currency: string }>(["cart"]);
      if (!prev) return { prev };
      const items = prev.items
        .map((i) => (i.productId === productId ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0);
      const totalCents = items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
      queryClient.setQueryData(["cart"], { ...prev, items, totalCents });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(["cart"], ctx.prev); },
    onSuccess: (_data, vars) => {
      if (vars.quantity === 0) success("Item removed");
    },
  });

  const reAdd = (productId: string) => updateMutation.mutate({ productId, quantity: 1 });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Your cart</h1>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <Skeleton className="h-16 w-16" />
              <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div>
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-7 w-7 text-amber-600" />}
        title="Your cart is empty"
        message="Browse the catalog and add something you love."
        action={{ label: "Start shopping", onClick: () => (window.location.href = "/") }}
      />
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Your cart</h1>
      <p className="mb-6 text-sm text-slate-500">{cart.items.length} item{cart.items.length === 1 ? "" : "s"}</p>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Lines */}
        <div className="lg:col-span-2 space-y-3">
          {cart.items.map((item) => (
            <div
              key={item.productId}
              className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
            >
              <Link to={`/products/${item.productId}`} className="flex-shrink-0">
                <div className="h-16 w-16 overflow-hidden rounded-lg bg-slate-100">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-slate-300">
                      <Package className="h-8 w-8" />
                    </div>
                  )}
                </div>
              </Link>
              <div className="min-w-0 flex-1">
                <Link to={`/products/${item.productId}`} className="font-medium text-slate-900 hover:text-amber-700 line-clamp-1">
                  {item.name}
                </Link>
                <p className="text-sm text-slate-500">${(item.unitPriceCents / 100).toFixed(2)} each</p>
              </div>
              <QuantityStepper
                value={item.quantity}
                min={0}
                max={item.quantity + 50}
                onChange={(q) => updateMutation.mutate({ productId: item.productId, quantity: q })}
              />
              <p className="w-20 text-right font-semibold tabular-nums">
                ${(item.unitPriceCents * item.quantity / 100).toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Order summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Items ({cart.items.reduce((s, i) => s + i.quantity, 0)})</span>
                <span>${(cart.totalCents / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Shipping</span>
                <span className="text-emerald-600">Free</span>
              </div>
              <div className="border-t border-slate-200 pt-3 flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>${(cart.totalCents / 100).toFixed(2)} {cart.currency}</span>
              </div>
            </div>
            <Link to="/checkout" className="btn-primary w-full justify-center">Proceed to checkout</Link>
            <Link to="/" className="block text-center text-sm text-amber-700 hover:underline">Continue shopping</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
