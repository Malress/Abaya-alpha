import "server-only";
import { ordableFetch } from "./server";
import { unwrapList, unwrapObject, unwrapOrder } from "./unwrap";
import type {
  Area,
  Branch,
  Category,
  Country,
  PaymentMethod,
  ProductDetail,
  ProductShort,
  Promotion,
  Review,
  SmartCategory,
  StoreConfig,
  StorePage,
} from "./types";

const MIN = 60 * 1000;

export async function getConfig(): Promise<StoreConfig> {
  const res = await ordableFetch("/config/", { ttlMs: 60 * MIN });
  return unwrapObject<StoreConfig>(res);
}

export async function getBranches(): Promise<Branch[]> {
  const res = await ordableFetch("/branches/", { ttlMs: 60 * MIN });
  return unwrapList<Branch>(res);
}

export async function getPages(): Promise<StorePage[]> {
  const res = await ordableFetch("/pages/", { ttlMs: 60 * MIN });
  return unwrapList<StorePage>(res);
}

export async function getCountries(): Promise<Country[]> {
  const res = await ordableFetch("/countries/", { ttlMs: 60 * MIN });
  return unwrapList<Country>(res);
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const res = await ordableFetch("/payment_methods/", { ttlMs: 30 * MIN });
  return unwrapList<PaymentMethod>(res);
}

export async function getCategories(
  branchId: number,
  withProducts = 8,
): Promise<Category[]> {
  const res = await ordableFetch(
    `/categories/?branch_id=${branchId}&with_products=${withProducts}&channel=web`,
    { ttlMs: 5 * MIN },
  );
  return unwrapList<Category>(res);
}

export async function getSmartCategories(branchId: number): Promise<SmartCategory[]> {
  try {
    const res = await ordableFetch(
      `/categories/smart/?branch_id=${branchId}&channel=web`,
      { ttlMs: 5 * MIN },
    );
    return unwrapList<SmartCategory>(res);
  } catch {
    return [];
  }
}

export interface ProductQuery {
  branchId: number;
  page?: number;
  limit?: number;
  categoryId?: number;
  search?: string;
}

export interface ProductPage {
  products: ProductShort[];
  hasNext: boolean;
}

export async function getProducts(q: ProductQuery): Promise<ProductPage> {
  const params = new URLSearchParams({
    page: String(q.page ?? 1),
    limit: String(q.limit ?? 12),
    branch_id: String(q.branchId),
    channel: "web",
  });
  if (q.categoryId) params.set("category_id", String(q.categoryId));
  if (q.search) params.set("search", q.search);

  const res = await ordableFetch(`/products/?${params.toString()}`, { ttlMs: 2 * MIN });
  const products = unwrapList<ProductShort>(res);
  const container = res as { data?: { meta?: { has_next_page?: boolean } } } & {
    meta?: { has_next_page?: boolean };
    has_next_page?: boolean;
  };
  const hasNext = Boolean(
    container?.data?.meta?.has_next_page ??
      container?.meta?.has_next_page ??
      container?.has_next_page,
  );
  return { products, hasNext };
}

export interface FilterDef {
  id: number;
  name: string;
  ar_name?: string;
  type?: number;
  options?: { id: number; name: string; ar_name?: string; sort_order?: number }[];
}
export interface FiltersResponse {
  filter_list: FilterDef[];
  price_range?: { min: number; max: number };
}

export async function getFilters(
  branchId: number,
  categoryId?: number,
): Promise<FiltersResponse> {
  try {
    const params = new URLSearchParams({ branch_id: String(branchId) });
    if (categoryId) params.set("category_id", String(categoryId));
    const res = await ordableFetch(`/filters/?${params.toString()}`, { ttlMs: 5 * MIN });
    const data = unwrapObject<FiltersResponse>(res);
    return {
      filter_list: Array.isArray(data?.filter_list) ? data.filter_list : [],
      price_range: data?.price_range,
    };
  } catch {
    return { filter_list: [] };
  }
}

export async function getProduct(
  productId: number,
  branchId: number,
): Promise<ProductDetail> {
  const res = await ordableFetch(
    `/product/?product_id=${productId}&branch_id=${branchId}`,
    { ttlMs: 2 * MIN, cacheKey: `product:${branchId}:${productId}` },
  );
  return unwrapObject<ProductDetail>(res);
}

export async function getAreas(branchIds: number[]): Promise<Area[]> {
  const res = await ordableFetch("/branches/areas/", {
    method: "POST",
    body: { branch_ids: branchIds },
    ttlMs: 30 * MIN,
    cacheKey: `areas:${branchIds.join(",")}`,
  });
  return unwrapList<Area>(res);
}

export async function getPromotions(branchId: number): Promise<Promotion[]> {
  try {
    const res = await ordableFetch(`/promotions/?branch_id=${branchId}`, {
      ttlMs: 1 * MIN,
    });
    return unwrapList<Promotion>(res).filter((p) => !p.hide_promotion);
  } catch {
    return [];
  }
}

export async function getReviews(productId?: number): Promise<Review[]> {
  try {
    const path = productId ? `/feedback/?product_id=${productId}` : "/feedback/";
    const res = await ordableFetch(path, { ttlMs: 5 * MIN });
    return unwrapList<Review>(res);
  } catch {
    return [];
  }
}

export async function getCrossSelling(
  productId: number,
  branchId: number,
): Promise<ProductShort[]> {
  try {
    const res = await ordableFetch(
      `/products/cross_selling/?product_id=${productId}&branch_id=${branchId}`,
      { ttlMs: 5 * MIN },
    );
    return unwrapList<ProductShort>(res);
  } catch {
    return [];
  }
}

export async function trackOrder(trackingId: string): Promise<unknown> {
  const res = await ordableFetch(
    `/order/?tracking_id=${encodeURIComponent(trackingId)}`,
    { noStore: true },
  );
  return unwrapOrder(res);
}
