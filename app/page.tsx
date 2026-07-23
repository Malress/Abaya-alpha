import Link from "next/link";
import { loadBoot, getLocale } from "@/lib/ordable/boot";
import { getSmartCategories, getReviews } from "@/lib/ordable/endpoints";
import { pick } from "@/lib/i18n";
import { categorySlug } from "@/lib/slug";
import ProductCard from "@/components/product/ProductCard";
import Reviews from "@/components/product/Reviews";
import HeroCarousel, { type HeroSlide } from "@/components/layout/HeroCarousel";
import type { ProductShort } from "@/lib/ordable/types";

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

      {rows.map((row) => (
        <section key={row.key} className="section-tight container">
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
          <div className="product-grid">
            {row.products.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ))}

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
