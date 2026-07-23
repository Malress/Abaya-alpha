import Link from "next/link";
import { loadBoot, getLocale } from "@/lib/ordable/boot";
import { getSmartCategories, getReviews } from "@/lib/ordable/endpoints";
import { pick } from "@/lib/i18n";
import { categorySlug } from "@/lib/slug";
import { productSlug } from "@/lib/slug";
import ProductCard from "@/components/product/ProductCard";
import Reviews from "@/components/product/Reviews";
import HeroCarousel, { type HeroSlide } from "@/components/layout/HeroCarousel";
import type { ProductShort } from "@/lib/ordable/types";
import { formatMoney, productImage, displayPrice } from "@/lib/format";

// Seed changes every 12 hours → products randomise a few times a day
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function HomePage() {
  const [boot, locale] = await Promise.all([loadBoot(), getLocale()]);
  if (!boot) return null;
  const { config, branchId, categories } = boot;

  const [smart, reviews] = await Promise.all([
    getSmartCategories(branchId),
    config.enable_feedback ? getReviews() : Promise.resolve([]),
  ]);

  const tx = (en?: string | null, ar?: string | null) => pick(locale, en, ar);
  const topCats = categories
    .filter((c) => !c.is_child)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const covers = [config.cover_large, config.cover_medium, config.cover, ...(config.gallery || [])].filter(Boolean) as string[];
  const uniqueCovers = Array.from(new Set(covers));

  const slides: HeroSlide[] = [];
  
  uniqueCovers.forEach((img, idx) => {
    slides.push({
      id: `main-cover-${idx}`,
      image: img,
      title: "",
    });
  });

  const catsWithPhotos = topCats.filter(c => c.photo || c.products?.find(p => p.photo_medium || p.photo));
  // stable "random" for SSR/CSR match: just take a slice of cats with photos
  const numCats = Math.ceil(catsWithPhotos.length * 0.6);
  const slideCats = [...catsWithPhotos].sort(() => Math.random() - 0.5).slice(0, numCats);

  for (const c of slideCats) {
    const images: string[] = [];
    if (c.photo) images.push(c.photo);
    if (c.products) {
      for (const p of c.products) {
        if (p.photo_medium) images.push(p.photo_medium);
        else if (p.photo) images.push(p.photo);
      }
    }
    const uniqueImages = Array.from(new Set(images));
    if (uniqueImages.length > 0) {
      slides.push({
        id: `cat-${c.id}`,
        image: uniqueImages[0],
        images: uniqueImages,
        title: tx(c.name, c.ar_name) || "",
        buttonText: `${tx("Shop", "تسوق")} ${tx(c.name, c.ar_name)}`,
        href: `/category/${categorySlug(c)}`,
      });
    }
  }

  for (const s of smart) {
    const images: string[] = [];
    if (s.photo) images.push(s.photo);
    if (s.gallery) images.push(...s.gallery);
    if (s.products) {
      for (const p of s.products) {
        if (p.photo_medium) images.push(p.photo_medium);
        else if (p.photo) images.push(p.photo);
      }
    }
    const uniqueImages = Array.from(new Set(images));
    if (uniqueImages.length > 0) {
      slides.push({
        id: `smart-${s.key}`,
        image: uniqueImages[0],
        images: uniqueImages,
        title: tx(s.name, s.ar_name) || "",
        buttonText: `${tx("Shop", "تسوق")} ${tx(s.name, s.ar_name)}`,
        href: `/category/smart-${s.key}`,
      });
    }
  }

  // Home product rows: prefer smart categories, else top categories carrying products.
  type Row = { key: string; title: string; href?: string; products: ProductShort[] };
  const rows: Row[] = [];
  for (const s of smart) {
    if (s.products?.length) {
      rows.push({ 
        key: `smart-${s.key}`, 
        title: tx(s.name, s.ar_name) || "", 
        products: s.products, 
        href: `/category/smart-${s.key}` 
      });
    }
  }
  for (const c of topCats) {
    if (rows.length >= 3) break;
    const prods = (c.products ?? []).filter((p) => !p.is_variant);
    if (prods.length) {
      rows.push({
        key: `cat-${c.id}`,
        title: tx(c.name, c.ar_name),
        href: `/category/${categorySlug(c)}`,
        products: prods,
      });
    }
  }

  // Seed changes every 12 h → new featured picks a few times a day
  const seed = Math.floor(Date.now() / (1000 * 60 * 60 * 12));

  // Pick 2 featured products from across the first 2 rows (with images)
  const topRowsProducts = rows.slice(0, 2).flatMap(r => r.products).filter(p => p.photo_medium || p.photo);
  const globalFeatured = seededShuffle(topRowsProducts, seed).slice(0, 2);
  const globalFeaturedIds = new Set(globalFeatured.map(p => p.id));

  return (
    <>
      {slides.length > 0 && <HeroCarousel slides={slides} />}

      {topCats.length > 0 && (
        <section className="section container">
          <div className="section-head">
            <span className="eyebrow">{tx("Explore", "استكشف")}</span>
            <h2 className="section-title">{tx("Categories", "الفئات")}</h2>
          </div>
          <div className="cat-grid">
            {topCats.slice(0, 6).map((c, i) => {
              const photo = c.photo || c.products?.find((p) => p.photo_medium)?.photo_medium;
              return (
                <Link key={`${c.id}-${i}`} href={`/category/${categorySlug(c)}`} className="cat-tile">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt={tx(c.name, c.ar_name)} loading="lazy" />
                  ) : null}
                  <span className="cat-tile__label">{tx(c.name, c.ar_name)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Featured duo — edge-to-edge */}
      {globalFeatured.length > 0 && (
        <div className={`featured-duo${globalFeatured.length === 1 ? " featured-duo--single" : ""}`}>
          {globalFeatured.map((p) => {
            const img = productImage(p, "medium") || productImage(p, "small");
            const name = tx(p.name, p.ar_name);
            const catName = tx(p.category_name, p.category_ar_name);
            const { price } = displayPrice(p);
            const href = `/product/${categorySlug({ id: p.category_id ?? 0, name: p.category_name ?? "", slug: null })}/${productSlug(p)}`;
            return (
              <Link key={p.id} href={href} className="featured-panel">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={name} className="featured-panel__img" loading="lazy" />
                ) : (
                  <div className="featured-panel__img" style={{ background: "var(--sand-soft)" }} />
                )}
                <div className="featured-panel__overlay" />
                <div className="featured-panel__info">
                  {catName && <span className="featured-panel__cat">{catName}</span>}
                  <p className="featured-panel__name">{name}</p>
                  <span className="featured-panel__price">
                    {formatMoney(price, config.base_currency, locale)}
                  </span>
                  <span className="featured-panel__btn">
                    {tx("View Product", "عرض المنتج")}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {rows.map((row) => {
        // Remaining products after removing the featured ones
        const rest = row.products.filter((p) => !globalFeaturedIds.has(p.id)).slice(0, 8);
        if (rest.length === 0) return null;

        return (
          <section key={row.key} className="section-tight">
            {/* Section header */}
            <div className="container">
              <div className="section-head">
                <h2 className="section-title" style={{ fontSize: "clamp(26px,4vw,40px)" }}>
                  {row.title}
                </h2>
                {row.href && (
                  <Link href={row.href} className="link-underline">
                    {tx("View all", "عرض الكل")}
                  </Link>
                )}
              </div>
            </div>

            {/* Remaining products grid */}
            {rest.length > 0 && (
              <div className="container">
                <div className="product-grid">
                  {rest.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })}

      {rows.length === 0 && (
        <section className="section container center">
          <p className="muted">
            {tx("Our collection is coming soon.", "مجموعتنا قادمة قريباً.")}
          </p>
        </section>
      )}

      {config.enable_feedback && reviews.length > 0 && (
        <section className="section container">
          <div className="section-head">
            <span className="eyebrow">{tx("Loved by our clients", "بإعجاب عملائنا")}</span>
            <h2 className="section-title">{tx("Reviews", "التقييمات")}</h2>
          </div>
          <Reviews reviews={reviews.slice(0, 6)} />
        </section>
      )}
    </>
  );
}

