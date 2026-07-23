import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadBoot, getLocale } from "@/lib/ordable/boot";
import { getProducts, getFilters } from "@/lib/ordable/endpoints";
import { pick } from "@/lib/i18n";
import { categorySlug, idFromSlug } from "@/lib/slug";
import type { Category } from "@/lib/ordable/types";
import CategoryView from "@/components/product/CategoryView";
import { IconChevronRight } from "@/components/ui/icons";

async function resolve(slug: string) {
  const boot = await loadBoot();
  const locale = await getLocale();
  const id = idFromSlug(slug);
  if (!boot || id == null) return null;
  const category = boot.categories.find((c) => c.id === id) ?? null;
  return { boot, locale, id, category };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const r = await resolve(slug);
  if (!r?.category) return {};
  const name = pick(r.locale, r.category.name, r.category.ar_name);
  return { title: name };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await resolve(slug);
  if (!r) notFound();
  const { boot, locale, id, category } = r;
  const tx = (en?: string | null, ar?: string | null) => pick(locale, en, ar);

  const name = category ? tx(category.name, category.ar_name) : tx("Shop", "التسوق");
  const subs: Category[] = (category?.sub_categories ?? [])
    .map((subId) => boot.categories.find((c) => c.id === subId))
    .filter((c): c is Category => Boolean(c))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // Find parent if this is a child category
  const parent = category?.is_child 
    ? boot.categories.find(p => p.sub_categories?.includes(category.id)) 
    : null;

  const [firstPage, filters] = await Promise.all([
    getProducts({ branchId: boot.branchId, categoryId: id, page: 1, limit: 12 }),
    boot.config.enable_filter_and_sort
      ? getFilters(boot.branchId, id)
      : Promise.resolve({ filter_list: [] as never[] }),
  ]);



  return (
    <div className="container">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">{tx("Home", "الرئيسية")}</Link>
        <IconChevronRight width={13} height={13} className="dir-icon" />
        {parent && (
          <>
            <Link href={`/category/${categorySlug(parent)}`}>{tx(parent.name, parent.ar_name)}</Link>
            <IconChevronRight width={13} height={13} className="dir-icon" />
          </>
        )}
        <span>{name}</span>
      </nav>
      <div className="section-head">
        <h1 className="section-title">{name}</h1>
      </div>
      
      {subs.length > 0 && (
        <div className="cat-grid" style={{ paddingBottom: 40 }}>
          {subs.map((c, i) => {
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


      <CategoryView
        categoryId={id}
        branchId={boot.branchId}
        initialProducts={firstPage.products}
        initialHasNext={firstPage.hasNext}
        filters={filters.filter_list}
        priceRange={"price_range" in filters ? filters.price_range : undefined}
        enableFilters={Boolean(boot.config.enable_filter_and_sort)}
      />
    </div>
  );
}
