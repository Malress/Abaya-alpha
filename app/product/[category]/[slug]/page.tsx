import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadBoot, getLocale } from "@/lib/ordable/boot";
import { getProduct, getCrossSelling, getReviews } from "@/lib/ordable/endpoints";
import { pick } from "@/lib/i18n";
import { idFromSlug, categorySlug } from "@/lib/slug";
import { sanitize } from "@/lib/sanitize";
import ProductDetailView from "@/components/product/ProductDetailView";
import { IconChevronRight } from "@/components/ui/icons";
import type { ProductShort, Review } from "@/lib/ordable/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const id = idFromSlug(slug);
  const boot = await loadBoot();
  const locale = await getLocale();
  if (!boot || id == null) return {};
  try {
    const p = await getProduct(id, boot.branchId);
    const name = pick(locale, p.meta_name || p.name, p.ar_name);
    const desc = pick(locale, p.short_description || p.meta_description, p.ar_short_description);
    return {
      title: name,
      description: desc ? desc.replace(/<[^>]+>/g, "").slice(0, 160) : undefined,
      openGraph: { title: name, images: p.photo_medium || p.photo ? [p.photo_medium || p.photo!] : undefined },
    };
  } catch {
    return {};
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const [boot, locale] = await Promise.all([loadBoot(), getLocale()]);
  const id = idFromSlug(slug);
  if (!boot || id == null) notFound();

  let product;
  try {
    product = await getProduct(id, boot.branchId);
  } catch {
    notFound();
  }

  const tx = (en?: string | null, ar?: string | null) => pick(locale, en, ar);

  const [crossSell, reviews] = await Promise.all([
    boot.config.enable_product_cross_sell_items
      ? getCrossSelling(id, boot.branchId)
      : Promise.resolve([] as ProductShort[]),
    boot.config.enable_product_feedback ? getReviews(id) : Promise.resolve([] as Review[]),
  ]);

  const description = sanitize(locale === "ar" ? product.ar_description || product.description : product.description || product.ar_description);
  const catName = product.category_name ?? category;
  const catHref = `/category/${categorySlug({ id: product.category_id ?? 0, name: product.category_name ?? "", slug: null })}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: tx(product.name, product.ar_name),
    image: product.photo_medium || product.photo || undefined,
    description: (product.short_description || "").replace(/<[^>]+>/g, "") || undefined,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: boot.config.base_currency?.iso ?? "KWD",
      availability: (product.inventory_on_hand ?? 1) > 0 || product.product_type !== "stocked"
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">{tx("Home", "الرئيسية")}</Link>
        <IconChevronRight width={13} height={13} className="dir-icon" />
        <Link href={catHref}>{tx(catName, product.category_ar_name)}</Link>
        <IconChevronRight width={13} height={13} className="dir-icon" />
        <span>{tx(product.name, product.ar_name)}</span>
      </nav>

      <ProductDetailView
        product={product}
        description={description}
        crossSell={crossSell.filter((p) => !p.is_variant)}
        reviews={reviews}
        enableReviews={Boolean(boot.config.enable_product_feedback)}
      />
    </div>
  );
}
