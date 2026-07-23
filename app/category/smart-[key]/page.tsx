import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadBoot, getLocale } from "@/lib/ordable/boot";
import { getSmartCategories } from "@/lib/ordable/endpoints";
import { pick } from "@/lib/i18n";
import { IconChevronRight } from "@/components/ui/icons";
import ProductCard from "@/components/product/ProductCard";

async function resolve(key: string) {
  const boot = await loadBoot();
  const locale = await getLocale();
  if (!boot) return null;
  const smartCats = await getSmartCategories(boot.branchId);
  const category = smartCats.find((c) => c.key === key) ?? null;
  return { boot, locale, category };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const { key } = await params;
  const r = await resolve(key);
  if (!r?.category) return {};
  const name = pick(r.locale, r.category.name, r.category.ar_name);
  return { title: name };
}

export default async function SmartCategoryPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const r = await resolve(key);
  if (!r?.category) notFound();

  const { locale, category } = r;
  const tx = (en?: string | null, ar?: string | null) => pick(locale, en, ar);
  const name = tx(category.name, category.ar_name) || "";
  const products = category.products ?? [];

  return (
    <div className="container" style={{ paddingBottom: 64 }}>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">{tx("Home", "الرئيسية")}</Link>
        <IconChevronRight width={13} height={13} className="dir-icon" />
        <span>{name}</span>
      </nav>
      <div className="section-head">
        <h1 className="section-title">{name}</h1>
      </div>
      {products.length > 0 ? (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "64px 0", color: "var(--muted)" }}>
          {tx("No products found.", "لم يتم العثور على منتجات.")}
        </div>
      )}
    </div>
  );
}
