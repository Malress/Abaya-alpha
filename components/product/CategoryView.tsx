"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/components/providers/StoreProvider";
import { sfGet, sfPost } from "@/lib/client-api";
import { unwrapList } from "@/lib/ordable/unwrap";
import type { ProductShort } from "@/lib/ordable/types";
import type { FilterDef } from "@/lib/ordable/endpoints";
import ProductCard from "./ProductCard";
import { IconChevronDown, IconClose } from "@/components/ui/icons";

type Sort = "" | "price-asc" | "price-desc" | "name-asc" | "name-desc";
const PAGE = 12;

export default function CategoryView({
  categoryId,
  branchId,
  initialProducts,
  initialHasNext,
  filters,
  priceRange,
  enableFilters,
}: {
  categoryId: number;
  branchId: number;
  initialProducts: ProductShort[];
  initialHasNext: boolean;
  filters: FilterDef[];
  priceRange?: { min: number; max: number };
  enableFilters: boolean;
}) {
  const { t, locale } = useStore();
  const [products, setProducts] = useState(initialProducts);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(initialHasNext);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<Sort>("");
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const firstRender = useRef(true);

  const filtersActive = sort !== "" || selectedOptions.length > 0;

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      setLoading(true);
      let list: ProductShort[] = [];
      let more = false;
      if (filtersActive) {
        const res = await sfPost("/products/filter/", {
          branch_id: branchId,
          channel: "web",
          categories: [categoryId],
          filter_options: selectedOptions,
          price_range: priceRange ? [priceRange.min, priceRange.max] : undefined,
          sort: sort || undefined,
          page: nextPage,
          limit: PAGE,
        });
        list = unwrapList<ProductShort>(res.raw);
        more = list.length >= PAGE;
      } else {
        const res = await sfGet(
          `/products/?branch_id=${branchId}&channel=web&category_id=${categoryId}&page=${nextPage}&limit=${PAGE}`,
        );
        list = unwrapList<ProductShort>(res.raw);
        const raw = res.raw as { meta?: { has_next_page?: boolean }; has_next_page?: boolean };
        more = Boolean(raw?.meta?.has_next_page ?? raw?.has_next_page ?? list.length >= PAGE);
      }
      const visible = list.filter((p) => !p.is_variant);
      setProducts((prev) => (replace ? visible : [...prev, ...visible]));
      setHasNext(more);
      setPage(nextPage);
      setLoading(false);
    },
    [filtersActive, branchId, categoryId, selectedOptions, sort, priceRange],
  );

  // Re-query from page 1 when sort/filters change.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    load(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, selectedOptions]);

  function toggleOption(id: number) {
    setSelectedOptions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const sortOptions: { value: Sort; label: string }[] = [
    { value: "", label: t("sort") },
    { value: "price-asc", label: t("priceLowHigh") },
    { value: "price-desc", label: t("priceHighLow") },
    { value: "name-asc", label: t("nameAZ") },
    { value: "name-desc", label: t("nameZA") },
  ];

  const hasFilterDefs = enableFilters && filters.length > 0;

  const FilterControls = (
    <div className="stack" style={{ gap: 22 }}>
      {filters.map((f) => (
        <fieldset key={f.id} style={{ border: "none", padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 10 }}>
            {locale === "ar" ? f.ar_name || f.name : f.name}
          </legend>
          <div className="stack" style={{ gap: 8 }}>
            {(f.options ?? []).map((o) => (
              <label key={o.id} className="row" style={{ gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(o.id)}
                  onChange={() => toggleOption(o.id)}
                />
                <span>{locale === "ar" ? o.ar_name || o.name : o.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {selectedOptions.length > 0 && (
        <button className="btn btn-sm btn-outline" onClick={() => setSelectedOptions([])}>
          {t("clear")}
        </button>
      )}
    </div>
  );

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Toolbar */}
      <div
        className="spread"
        style={{ borderBlock: "1px solid var(--line)", padding: "14px 0", marginBottom: 26 }}
      >
        <span className="muted" style={{ fontSize: 13 }}>
          {products.length} {t("results")}
        </span>
        <div className="row" style={{ gap: 10 }}>
          {hasFilterDefs && (
            <button
              className="btn btn-sm btn-outline"
              onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
            >
              {t("filters")}
              {selectedOptions.length > 0 ? ` (${selectedOptions.length})` : ""}
            </button>
          )}
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <select
              className="select"
              style={{ minHeight: 38, paddingInlineEnd: 34, appearance: "none" }}
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label={t("sort")}
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <IconChevronDown
              width={16}
              height={16}
              style={{ position: "absolute", insetInlineEnd: 10, pointerEvents: "none" }}
            />
          </div>
        </div>
      </div>

      {products.length === 0 && !loading ? (
        <div className="empty-state">
          <h3>{t("noResults")}</h3>
          <p>{t("noResultsHint")}</p>
        </div>
      ) : (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {hasNext && (
        <div className="center" style={{ marginTop: 44 }}>
          <button
            className="btn btn-outline"
            disabled={loading}
            onClick={() => load(page + 1, false)}
          >
            {loading ? <span className="spinner" /> : t("loadMore")}
          </button>
        </div>
      )}

      {/* Filter drawer */}
      {drawerOpen && hasFilterDefs && (
        <>
          <div className="scrim" onClick={() => setDrawerOpen(false)} />
          <aside
            className="drawer drawer-start"
            role="dialog"
            aria-modal="true"
            aria-label={t("filters")}
          >
            <div className="drawer__head">
              <span className="drawer__title">{t("filters")}</span>
              <button
                className="iconbtn"
                aria-label={t("backToShop")}
                onClick={() => setDrawerOpen(false)}
              >
                <IconClose />
              </button>
            </div>
            <div className="drawer__body">{FilterControls}</div>
            <div className="drawer__foot">
              <button className="btn btn-block" onClick={() => setDrawerOpen(false)}>
                {t("apply")}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
