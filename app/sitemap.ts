import type { MetadataRoute } from "next";
import { loadBoot } from "@/lib/ordable/boot";
import { getProducts } from "@/lib/ordable/endpoints";
import { categorySlug, productSlug } from "@/lib/slug";

export const revalidate = 86400; // 24h

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const boot = await loadBoot();
  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/track`, changeFrequency: "monthly", priority: 0.3 },
  ];
  if (!boot) return entries;

  for (const c of boot.categories.filter((x) => !x.is_child)) {
    entries.push({
      url: `${base}/category/${categorySlug(c)}`,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  try {
    const { products } = await getProducts({ branchId: boot.branchId, page: 1, limit: 100 });
    for (const p of products.filter((x) => !x.is_variant)) {
      const cat = categorySlug({ id: p.category_id ?? 0, name: p.category_name ?? "", slug: null });
      entries.push({
        url: `${base}/product/${cat}/${productSlug(p)}`,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch {
    /* ignore */
  }

  return entries;
}
