"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatMoney, productImage, displayPrice } from "@/lib/format";
import { categorySlug, productSlug } from "@/lib/slug";
import type { ProductShort, Locale, Currency } from "@/lib/ordable/types";
import { pick } from "@/lib/i18n";

export default function FeaturedSwitcher({ 
  products, 
  locale, 
  baseCurrency,
  btnText
}: { 
  products: ProductShort[];
  locale: Locale;
  baseCurrency?: Currency;
  btnText: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (products.length <= 2) return;
    const interval = setInterval(() => {
      setIndex((i) => (i + 2 >= products.length ? 0 : i + 2));
    }, 5000);
    return () => clearInterval(interval);
  }, [products.length]);

  const displayed = products.slice(index, index + 2);
  const tx = (en?: string | null, ar?: string | null) => pick(locale, en, ar);

  return (
    <div className={`featured-duo${displayed.length === 1 ? " featured-duo--single" : ""}`}>
      {displayed.map((p) => {
        const img = productImage(p, "medium") || productImage(p, "small");
        const name = tx(p.name, p.ar_name);
        const catName = tx(p.category_name, p.category_ar_name);
        const { price } = displayPrice(p);
        const href = `/product/${categorySlug({ id: p.category_id ?? 0, name: p.category_name ?? "", slug: null })}/${productSlug(p)}`;
        
        return (
          <Link key={p.id} href={href} className="featured-panel">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt={name || ""} className="featured-panel__img" loading="lazy" />
            ) : (
              <div className="featured-panel__img" style={{ background: "var(--sand-soft)" }} />
            )}
            <div className="featured-panel__overlay" />
            <div className="featured-panel__info">
              {catName && <span className="featured-panel__cat">{catName}</span>}
              <p className="featured-panel__name">{name}</p>
              <span className="featured-panel__price">
                {formatMoney(price, baseCurrency, locale)}
              </span>
              <span className="featured-panel__btn">{btnText}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
