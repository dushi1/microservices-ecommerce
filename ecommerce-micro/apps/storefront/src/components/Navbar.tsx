import { ShoppingCart, Menu, Search, LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { fetchCart } from "../api/orders";

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: cart } = useQuery({ queryKey: ["cart"], queryFn: fetchCart, enabled: isAuthenticated });
  const cartCount = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (search.trim()) params.set("search", search.trim());
      else params.delete("search");
      navigate(`/?${params.toString()}`, { replace: true });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const onLogout = () => { logout(); navigate("/"); };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-15 items-center gap-3 max-w-6xl px-4">
        <Link to="/" className="flex-shrink-0 text-xl font-black tracking-tight text-slate-900">
          <span className="text-amber-600">Shop</span>Micro
        </Link>

        {/* Search */}
        <div className="relative hidden sm:block sm:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="input-base pl-10"
          />
        </div>

        {/* Desktop nav */}
        <nav className="ml-auto flex items-center gap-2 text-sm md:gap-3">
          <Link to="/" className="text-slate-600 hover:text-amber-700">Catalog</Link>
          {isAuthenticated ? (
            <>
              <Link to="/orders" className="text-slate-600 hover:text-amber-700 hidden sm:inline-block">Orders</Link>
              <Link to="/cart" className="relative rounded-lg p-2 text-slate-600 hover:text-amber-700 hover:bg-slate-100 ring-focus">
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-600 px-1.5 text-[10px] font-bold text-white">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
                <span className="sr-only">Cart ({cartCount})</span>
              </Link>
              <span className="hidden items-center gap-1 text-slate-500 sm:flex">
                <User className="h-4 w-4" />
                <span className="font-medium">{user?.displayName}</span>
              </span>
              <button className="rounded-lg p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 ring-focus"
                onClick={onLogout} aria-label="Log out">
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-slate-600 hover:text-amber-700">Log in</Link>
              <Link to="/register" className="btn-ghost">Sign up</Link>
            </>
          )}
        </nav>

        {/* Mobile toggle */}
        <button
          className="ml-auto rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden ring-focus"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="animate-fade-in border-t border-slate-200/60 bg-white px-4 py-3 space-y-3 md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" className="input-base pl-10" />
          </div>
          <Link to="/" className="block py-1 text-slate-600" onClick={() => setMobileOpen(false)}>Catalog</Link>
          {isAuthenticated ? (
            <>
              <Link to="/cart" className="block py-1 text-slate-600" onClick={() => setMobileOpen(false)}>Cart {cartCount > 0 && <span className="ml-1 text-xs text-amber-600">({cartCount})</span>}</Link>
              <Link to="/orders" className="block py-1 text-slate-600" onClick={() => setMobileOpen(false)}>Orders</Link>
              <button className="block w-full text-left py-1 text-rose-600" onClick={() => { onLogout(); setMobileOpen(false); }}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="block py-1 text-slate-600" onClick={() => setMobileOpen(false)}>Log in</Link>
              <Link to="/register" className="block py-1 text-amber-700 font-medium" onClick={() => setMobileOpen(false)}>Sign up</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
