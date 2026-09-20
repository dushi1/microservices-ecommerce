import { Package, CreditCard, CheckCircle, ChevronLeft, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getOrder, streamOrder, cancelOrder } from "../api/orders";
import type { Order } from "@ecommerce/contracts/rest";

const SAGA_STEPS = [
  { status: "PENDING", label: "Reserving stock and authorizing payment", Icon: Package },
  { status: "CONFIRMED", label: "Order confirmed", Icon: CheckCircle },
  { status: "CONFIRMED", label: "Payment captured", Icon: CreditCard },
] as const;

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800",
  PAYMENT_FAILED: "bg-rose-100 text-rose-800",
};

export function OrderTracking() {
  const { orderId = "" } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<(() => void) | null>(null);
  const queryClient = useQueryClient();

  // Cancellable statuses (the saga's compensating actions are valid here).
  const cancellable = order?.status === "PENDING" || order?.status === "CONFIRMED";

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(orderId),
    onSuccess: (updated) => {
      setOrder(updated);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  useEffect(() => {
    getOrder(orderId).then(setOrder).catch((e) => setError(e.message));
    closeRef.current = streamOrder(orderId, setOrder);
    return () => closeRef.current?.();
  }, [orderId]);

  if (error) return <p className="text-rose-600">{error}</p>;
  if (!order) return <p className="text-slate-500">Loading order…</p>;

  const terminal = order.status !== "PENDING";

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order {order.orderId.slice(0, 8)}</h1>
          <p className="mt-1 text-sm text-slate-500">{new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <span className={`rounded-full px-3.5 py-1 text-sm font-medium ${STATUS_STYLES[order.status]}`}>
          {order.status}
        </span>
      </header>

      <div className="card mb-6 p-6">
        {terminal ? (
          <p className="text-slate-600">
            {order.status === "CONFIRMED"
              ? "Payment authorized and stock reserved. Confirmation email is on its way."
              : order.status === "CANCELLED"
                ? "Order cancelled. Any reserved stock has been released and any authorized payment refunded."
                : "Something went wrong — the saga rolled back and reserved stock was released."}
          </p>
        ) : (
          <ol className="space-y-3 text-sm text-slate-600">
            {SAGA_STEPS.map((step, i) => {
              const reached =
                order.status === "CONFIRMED" && step.status === "CONFIRMED" ||
                (order.status === "PENDING" && step.status === "PENDING");
              return (
                <li key={step.status} className="flex items-center gap-3">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      reached
                        ? "bg-amber-500 text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    <step.Icon className="h-3 w-3" />
                  </span>
                  <span className={reached ? "text-slate-900 font-medium" : ""}>{step.label}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {cancellable && (
        <div className="mb-6">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50"
            disabled={cancelMutation.isPending}
            onClick={() => cancelMutation.mutate()}
          >
            <X className="h-4 w-4" />
            {cancelMutation.isPending ? "Cancelling…" : "Cancel order"}
          </button>
          {cancelMutation.isError && <p className="mt-1 text-sm text-rose-600">{(cancelMutation.error as Error).message}</p>}
        </div>
      )}

      <div className="card divide-y divide-slate-100 p-0 overflow-hidden">
        {order.items.map((item) => (
          <div key={item.productId} className="flex justify-between px-4 py-3 text-sm">
            <span className="text-slate-600">{item.name} × {item.quantity}</span>
            <span className="text-slate-900">${((item.unitPriceCents * item.quantity) / 100).toFixed(2)}</span>
          </div>
        ))}
        <div className="flex justify-between px-4 py-3 text-base font-semibold">
          <span>Total</span>
          <span>${(order.totalCents / 100).toFixed(2)} {order.currency}</span>
        </div>
      </div>

      <Link to="/orders" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:underline">
        <ChevronLeft className="h-4 w-4" />
        All orders
      </Link>
    </div>
  );
}
