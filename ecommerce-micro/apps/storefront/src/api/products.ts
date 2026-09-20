import {
  ROUTES,
  type Product,
  type ProductListQuery,
  type ProductListResponse,
} from "@ecommerce/contracts/rest";
import { api } from "./client";

export function listProducts(query: Partial<ProductListQuery>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return api<ProductListResponse>(`${ROUTES.products.list}?${params}`);
}

export function getProduct(productId: string) {
  return api<Product>(ROUTES.products.detail(productId));
}
