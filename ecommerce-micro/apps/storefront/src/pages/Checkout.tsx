import { CreditCard, Smartphone } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCart, checkout } from "../api/orders";
import { Button } from "../components/ui/Button";

const PAYMENT_METHODS = [
  { value: "pm_card_visa", label: "Visa ending 4242", hint: "Charges immediately", Icon: CreditCard },
  { value: "pm_card_mastercard", label: "Mastercard ending 4444", hint: "Charges immediately", Icon: CreditCard },
  { value: "pm_card_declined", label: "Card that will be declined", hint: "Watches the saga roll back live", Icon: Smartphone },
];

export function Checkout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [paymentMethodId, setPaymentMethodId] = useState("pm_card_visa");

  const { data: cart } = useQuery({ queryKey: ["cart"], queryFn: fetchCart });

  const checkoutMutation = useMutation({
    mutationFn: () => checkout(paymentMethodId),
    onSuccess: (order) => {
      queryClient.setQueryData(["cart"], { items: [], totalCents: 0, currency: "USD" });
      navigate(`/orders/${order.orderId}`);
    },
  });

  if (!cart || cart.items.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">Your cart is empty. <a href="/" className="text-amber-700 hover:underline">Continue shopping</a></p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Checkout</h1>
      <p className="mb-6 text-sm text-slate-500">Complete your purchase below.</p>

      <div className="card mb-6 p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Order summary</h2>
        <div className="space-y-2">
          {cart.items.map((item) => (
            <div key={item.productId} className="flex justify-between text-sm">
              <span className="text-slate-600">{item.name} × {item.quantity}</span>
              <span className="text-slate-900">${((item.unitPriceCents * item.quantity) / 100).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-slate-200 pt-3 flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>${(cart.totalCents / 100).toFixed(2)} {cart.currency}</span>
          </div>
        </div>
      </div>

      <div className="card mb-6 p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Payment method</h2>
        <p className="text-xs text-slate-500 mb-4">The declined card lets you watch the saga compensate.</p>
        <div className="space-y-2">
          {PAYMENT_METHODS.map((m) => {
            const selected = paymentMethodId === m.value;
            return (
              <label
                key={m.value}
                className={`flex cursor-pointer items-center justify-between rounded-xl border-2 bg-white p-4 transition-all
                  ${selected ? "border-amber-600 ring-1 ring-amber-500/30" : "border-slate-200 hover:border-slate-300"}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    selected ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-400"
                  }`}>
                    <m.Icon className="h-3 w-3" />
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-slate-900">{m.label}</span>
                    <span className="text-xs text-slate-500">{m.hint}</span>
                  </div>
                </div>
                <input
                  type="radio"
                  name="paymentMethod"
                  value={m.value}
                  checked={selected}
                  onChange={() => setPaymentMethodId(m.value)}
                  className="sr-only"
                />
              </label>
            );
          })}
        </div>
      </div>

      {checkoutMutation.isError && (
        <p className="mb-3 text-sm text-rose-600">{(checkoutMutation.error as Error).message}</p>
      )}

      <Button
        className="w-full justify-center"
        loading={checkoutMutation.isPending}
        onClick={() => checkoutMutation.mutate()}
      >
        {checkoutMutation.isPending ? "Placing order…" : "Place order"}
      </Button>

      <p className="mt-4 text-center text-xs text-slate-400">
        By placing this order you acknowledge the mock PSP terms.
      </p>
    </div>
  );
}
