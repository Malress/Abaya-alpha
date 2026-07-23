"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/providers/StoreProvider";
import { sfGet } from "@/lib/client-api";
import type { ProductShort } from "@/lib/ordable/types";
import { formatMoney, isOutOfStock, productImage } from "@/lib/format";
import { categorySlug, productSlug } from "@/lib/slug";
import { unwrapList } from "@/lib/ordable/unwrap";
import { IconClose, IconSearch } from "@/components/ui/icons";

export default function SearchOverlay() {
  const { searchOpen, setSearchOpen, branchId, locale, currency, t, tx } = useStore();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductShort[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
    else {
      setQ("");
      setResults([]);
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSearchOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, setSearchOpen]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      const res = await sfGet(
        `/products/?branch_id=${branchId}&channel=web&limit=8&page=1&search=${encodeURIComponent(q.trim())}`,
      );
      setResults(unwrapList<ProductShort>(res.raw).filter((p) => !p.is_variant));
      setLoading(false);
    }, 400);
    return () => clearTimeout(handle);
  }, [q, branchId]);

  if (!searchOpen) return null;

  return (
    <div className="search-overlay" onClick={() => setSearchOpen(false)}>
      <div className="search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="spread" style={{ marginBottom: 14 }}>
          <div className="row" style={{ gap: 10, flex: 1 }}>
            <IconSearch />
            <input
              ref={inputRef}
              className="input"
              style={{ border: "none", padding: 0, minHeight: "auto" }}
              placeholder={t("searchProducts")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label={t("search")}
            />
          </div>
          <button
            className="iconbtn"
            aria-label={t("backToShop")}
            onClick={() => setSearchOpen(false)}
          >
            <IconClose />
          </button>
        </div>
        <hr className="divider" />
        <div style={{ marginTop: 14, maxHeight: "50vh", overflowY: "auto" }}>
          {loading && <p className="muted center">{t("loading")}</p>}
          {!loading && q.trim() && results.length === 0 && (
            <p className="muted center">{t("noResults")}</p>
          )}
          <div className="stack" style={{ gap: 4 }}>
            {results.map((p) => {
              const cat = categorySlug({
                id: p.category_id ?? 0,
                name: p.category_name ?? "",
                slug: null,
              });
              return (
                <Link
                  key={p.id}
                  href={`/product/${cat}/${productSlug(p)}`}
                  onClick={() => setSearchOpen(false)}
                  className="row"
                  style={{ gap: 12, padding: "8px 4px" }}
                >
                  {productImage(p, "thumb") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={productImage(p, "thumb")!}
                      alt=""
                      style={{ width: 46, height: 58, objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ width: 46, height: 58, background: "var(--sand-soft)" }} />
                  )}
                  <span style={{ flex: 1, minWidth: 0 }}>{tx(p.name, p.ar_name)}</span>
                  <span className="muted">
                    {isOutOfStock(p)
                      ? t("soldOut")
                      : formatMoney(p.price, currency, locale)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
