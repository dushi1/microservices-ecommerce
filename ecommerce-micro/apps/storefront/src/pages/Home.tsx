import { Package, AlertCircle, Search, ChevronLeft, ChevronRight, ShoppingCart, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { listProducts } from "../api/products";
import type { Product, ProductListQuery } from "@ecommerce/contracts/rest";
import { Skeleton, SkeletonCard } from "../components/ui/Skeleton";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";

type Sort = ProductListQuery["sort"];

const SORTS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Newest arrivals" },
  { value: "price_asc", label: "Price: low → high" },
  { value: "price_desc", label: "Price: high → low" },
];

function useCategories(products: Product[]) {
  return useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return Array.from(set).sort();
  }, [products]);
}

/* ── Active filter chips ─────────────────────────────────────────────────── */
interface FilterChipProps {
  label: string;
  onClear: () => void;
}
function FilterChip({ label, onClear }: FilterChipProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
      {label}
      <button onClick={onClear} aria-label="Remove filter" className="ring-focus inline-flex items-center justify-center rounded-full p-0.5 transition-colors hover:bg-amber-200">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingSearch, setPendingSearch] = useState("");

  useEffect(() => {
    setPendingSearch(searchParams.get("search") ?? "");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const category = searchParams.get("category") || "";
  const search = searchParams.get("search") || "";
  const minPrice = searchParams.get("minPriceCents") ? Number(searchParams.get("minPriceCents")) : undefined;
  const maxPrice = searchParams.get("maxPriceCents") ? Number(searchParams.get("maxPriceCents")) : undefined;
  const sort = (searchParams.get("sort") as Sort) || "newest";
  const page = Number(searchParams.get("page") || "1");
  const pageSize = 12;

  const query: ProductListQuery = {
    page,
    pageSize,
    sort,
    ...(category ? { category } : {}),
    ...(search ? { search } : {}),
    ...(minPrice !== undefined ? { minPriceCents: minPrice } : {}),
    ...(maxPrice !== undefined ? { maxPriceCents: maxPrice } : {}),
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["products", query],
    queryFn: () => listProducts(query),
    placeholderData: (prev) => prev,
  });

  const categories = useCategories(data?.items ?? []);

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, String(v));
    }
    if (!("page" in patch)) next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const clearAll = () => {
    setPendingSearch("");
    setSearchParams({}, { replace: true });
  };

  const hasFilters = category || search || minPrice !== undefined || maxPrice !== undefined;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const showingFrom = data ? (page - 1) * pageSize + 1 : 0;
  const showingTo = data ? Math.min(page * pageSize, data.total) : 0;

  /* Build active filter labels */
  const filters: string[] = [];
  if (category) filters.push(category);
  if (search) filters.push(`"${search}"`);
  if (minPrice !== undefined && maxPrice !== undefined) filters.push(`${minPrice}–${maxPrice}`);
  else if (minPrice !== undefined) filters.push(`+${minPrice}`);
  else if (maxPrice !== undefined) filters.push(`up to ${maxPrice}`);

  return (
    <div className="animate-fade-in">
      {/* Hero — gradient accent + stronger typographic scale */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 via-white to-slate-50 p-6 sm:p-8 lg:p-10 ring-1 ring-slate-200/60">
        {/* Subtle dot pattern overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(#94a3b8 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative">
          <div className="flex items-center gap-2 text-amber-600">
            <ShoppingCart className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Catalog</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Browse the shop
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500 sm:text-base">
            Curated tech and furniture, stocked and ready to ship. Try the checkout saga — pick an item, then use the
            declined-card demo to watch inventory roll back in real time.
          </p>
        </div>
      </div>

      {/* Filters — sticky panel */}
      <div className="card mb-6 overflow-visible p-4 sm:p-5">
        <div className="flex items-center gap-2 pb-3">
          <SlidersHorizontal className="h-4 w-4 text-amber-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Filters</span>
        </div>

        {/* Row 1: search + sort */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={pendingSearch}
              onChange={(e) => setPendingSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") update({ search: pendingSearch || undefined, page: undefined }); }}
              placeholder="Search products…"
              className="input-base pl-10"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => update({ sort: e.target.value as Sort, page: undefined })}
            className="input-base sm:w-56"
          >
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* Row 2: category pills */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => update({ category: undefined, page: undefined })}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-150 ${
              !category ? "bg-amber-100 text-amber-800 ring-2 ring-amber-300/40" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => update({ category: c === category ? undefined : c, page: undefined })}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-150 ${
                c === category ? "bg-amber-100 text-amber-800 ring-2 ring-amber-300/40" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Row 3: price range */}
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-500">Min $</label>
              <input type="number" min={0} value={minPrice ?? ""} placeholder="0"
                onChange={(e) => update({ minPriceCents: e.target.value || undefined, page: undefined })}
                className="input-base w-20" />
            </div>
            <span className="pb-1.5 text-slate-400">–</span>
            <div>
              <label className="block text-xs font-medium text-slate-500">Max $</label>
              <input type="number" min={0} value={maxPrice ?? ""} placeholder="∞"
                onChange={(e) => update({ maxPriceCents: e.target.value || undefined, page: undefined })}
                className="input-base w-20" />
            </div>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear all
            </Button>
          )}
        </div>

        {/* Active filter chips */}
        {filters.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Active:</span>
            {filters.map((f, i) => (
              <FilterChip
                key={i}
                label={f}
                onClear={() => {
                  const patch: Record<string, string | undefined> = {};
                  if (category && f.includes(category)) patch.category = undefined;
                  if (search && f.includes(search)) { patch.search = undefined; setPendingSearch(""); }
                  if (f.startsWith("+")) patch.minPriceCents = undefined;
                  else if (f.startsWith("up to ")) patch.maxPriceCents = undefined;
                  else if (f.includes("–")) { patch.minPriceCents = undefined; patch.maxPriceCents = undefined; }
                  update(patch);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-0 overflow-hidden"><SkeletonCard /></div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <EmptyState icon={<AlertCircle className="h-7 w-7 text-rose-500" />} title="Couldn't load products" message="Check that the services are running and try again." action={{ label: "Retry", onClick: () => window.location.reload() }} />
      )}

      {/* Empty */}
      {data && !isLoading && data.items.length === 0 && (
        <EmptyState
          icon="🔍"
          title="No products found"
          message="Try clearing some filters or searching for something else."
          action={{ label: "Clear filters", onClick: clearAll }}
        />
      )}

      {/* Results */}
      {data && !isLoading && data.items.length > 0 && (
        <>
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{data.total}</span> product{data.total === 1 ? "" : "s"}
              {hasFilters && <span> — {showingFrom}–{showingTo} shown</span>}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {data.items.map((product) => (
              <ProductCard key={product.productId} product={product} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-1.5">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              {Array.from({ length: totalPages }).map((_, i) => {
                const p = i + 1;
                // Show first page, last page, current ± 1, ellipsis for gaps
                const show = p === 1 || p === totalPages || (Math.abs(p - page) <= 1);
                if (!show) return null;
                // Ellipsis before current when there's a gap
                if (p === page - 2 && i > 0) {
                  return <span key="before-ellipsis" className="px-2 text-slate-400">…</span>;
                }
                if (p === page + 2 && i < totalPages - 1) {
                  return <span key="after-ellipsis" className="px-2 text-slate-400">…</span>;
                }
                return (
                  <button
                    key={p}
                    onClick={() => update({ page: String(p) })}
                    className={`h-9 w-9 rounded-lg text-sm font-medium transition-all duration-150 ${
                      p === page
                        ? "bg-amber-600 text-white shadow-md shadow-amber-200/60 ring-2 ring-amber-300/50"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => update({ page: String(page + 1) })}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const displayPrice = `$${(product.priceCents / 100).toFixed(2)}`;
  const isOutOfStock = product.available <= 0;
  const isLowStock = product.available > 0 && product.available <= 5;

  return (
    <Link
      to={`/products/${product.productId}`}
      className="group/card block h-full"
    >
      <div className="card h-full flex flex-col overflow-hidden p-0 transition-shadow duration-200 group-hover/card:shadow-lg group-hover/card:-translate-y-0.5">
        {/* Image area */}
        <div className="relative aspect-square overflow-hidden bg-slate-100">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover object-center transition-transform duration-500 group-hover/card:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-slate-300">
              <Package className="h-10 w-10" />
            </div>
          )}

          {/* Badges */}
          <span className="absolute left-3 top-3">
            <Badge tone="neutral">{product.category}</Badge>
          </span>
          {isOutOfStock && (
            <div className="absolute inset-0 grid place-items-center bg-white/70 backdrop-blur-[2px]">
              <Badge tone="danger">Out of stock</Badge>
            </div>
          )}
          {isLowStock && (
            <div className="absolute bottom-3 left-3">
              <Badge tone="warning">Only {product.available} left</Badge>
            </div>
          )}

          {/* Hover overlay + quick-view hint */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition-opacity duration-200 group-hover/card:opacity-100" />
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-4">
          <h3 className="line-clamp-2 text-sm font-medium text-slate-900 group-hover/card:text-amber-700">
            {product.name}
          </h3>
          <div className="mt-auto flex items-end justify-between pt-2">
            <span className="text-lg font-bold tracking-tight text-slate-900">{displayPrice}</span>
            <span className="ml-2 hidden items-center gap-0.5 text-xs font-medium text-amber-600 transition-colors group-hover/card:flex">
              View
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
