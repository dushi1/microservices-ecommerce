import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { Navbar } from "./components/Navbar";
import { ToastProvider } from "./components/ToastProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Home } from "./pages/Home";
import { ProductDetail } from "./pages/ProductDetail";
import { Cart } from "./pages/Cart";
import { Checkout } from "./pages/Checkout";
import { OrderTracking } from "./pages/OrderTracking";
import { Orders } from "./pages/Orders";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Page({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [key, setKey] = useState(location.pathname);
  useEffect(() => {
    setKey(location.pathname + location.search);
  }, [location]);
  return <div className="animate-fade-in" key={key}>{children}</div>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ToastProvider>
            <AuthProvider>
              <div className="min-h-screen bg-slate-50 text-slate-900">
                <Navbar />
                <main className="mx-auto max-w-6xl px-4 py-8">
                  <Page>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/products/:productId" element={<ProductDetail />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/cart" element={<RequireAuth><Cart /></RequireAuth>} />
                      <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
                      <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
                      <Route path="/orders/:orderId" element={<RequireAuth><OrderTracking /></RequireAuth>} />
                    </Routes>
                  </Page>
                </main>
              </div>
            </AuthProvider>
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
