import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { loadBoot, getLocale } from "@/lib/ordable/boot";
import { getProducts } from "@/lib/ordable/endpoints";
import { pick } from "@/lib/i18n";
import { IconChevronRight } from "@/components/ui/icons";
import CategoryView from "@/components/product/CategoryView";
import { categorySlug } from "@/lib/slug";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const name = pick(locale, "All Products", "كل المنتجات");
  return { title: name };
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const boot = await loadBoot();
  if (!boot) return null;

  const { tab } = await searchParams;
  const currentTab = tab === "categories" ? "categories" : "products";

  const locale = await getLocale();
  const tx = (en?: string | null, ar?: string | null) => pick(locale, en, ar);
  const name = tx("Shop", "التسوق") || "";

  // Fetch all products (no category filter)
  const firstPage = await getProducts({
    branchId: boot.branchId,
    page: 1,
    limit: 16,
  });

  const topCats = boot.categories
    .filter((c) => !c.is_child)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

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

      <div className="shop-tabs" style={{ display: "flex", gap: 16, marginBottom: 32, borderBottom: "1px solid var(--line-light)" }}>
        <Link 
          href="/shop?tab=products" 
          style={{ 
            padding: "12px 24px", 
            fontWeight: 600, 
            borderBottom: currentTab === "products" ? "2px solid var(--ink)" : "2px solid transparent",
            color: currentTab === "products" ? "var(--ink)" : "var(--ink-soft)"
          }}
        >
          {tx("All Products", "كل المنتجات")}
        </Link>
        <Link 
          href="/shop?tab=categories" 
          style={{ 
            padding: "12px 24px", 
            fontWeight: 600, 
            borderBottom: currentTab === "categories" ? "2px solid var(--ink)" : "2px solid transparent",
            color: currentTab === "categories" ? "var(--ink)" : "var(--ink-soft)"
          }}
        >
          {tx("Shop by Category", "تسوق حسب الفئة")}
        </Link>
      </div>

      {currentTab === "products" ? (
        <CategoryView
          branchId={boot.branchId}
          initialProducts={firstPage.products}
          initialHasNext={firstPage.hasNext}
          filters={[]}
          enableFilters={Boolean(boot.config.enable_filter_and_sort)}
        />
      ) : (
        <div className="cat-grid">
          {topCats.map((c, i) => {
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
      )}
    </div>
  );
}
