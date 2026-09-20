import { Package } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listOrders } from "../api/orders";
import { EmptyState } from "../components/ui/EmptyState";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800",
  PAYMENT_FAILED: "bg-rose-100 text-rose-800",
};

export function Orders() {
  const { data, isLoading, error } = useQuery({ queryKey: ["orders"], queryFn: listOrders });

  if (isLoading) return <p className="text-slate-500">Loading orders…</p>;
  if (error) return <p className="text-rose-600">{(error as Error).message}</p>;
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={<Package className="h-7 w-7 text-amber-600" />}
        title="No orders yet"
        message="Your order history is empty. Browse the catalog to get started."
        action={{ label: "Start shopping", onClick: () => (window.location.href = "/") }}
      />
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Your orders</h1>
      <p className="mb-5 text-sm text-slate-500">{data.items.length} order{data.items.length === 1 ? "" : "s"}</p>

      <div className="space-y-3">
        {data.items.map((order) => (
          <Link
            key={order.orderId}
            to={`/orders/${order.orderId}`}
            className="group block rounded-xl border border-slate-200 bg-white p-4 transition-all hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Order {order.orderId.slice(0, 8)}</p>
                <p className="text-xs text-slate-500">
                  {new Date(order.createdAt).toLocaleString()} · {order.items.length} item{order.items.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-900">${(order.totalCents / 100).toFixed(2)}</p>
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[order.status]}`}>
                  {order.status}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
