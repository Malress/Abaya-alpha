"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProductShort } from "@/lib/ordable/types";
import { useStore } from "@/components/providers/StoreProvider";
import { useCart } from "@/components/providers/CartProvider";
import { displayPrice, formatMoney, isOnSale, isOutOfStock, productImage } from "@/lib/format";
import { productSlug, categorySlug } from "@/lib/slug";
import { IconCheck } from "@/components/ui/icons";

export default function ProductCard({ product }: { product: ProductShort }) {
  const { locale, currency, t, tx } = useStore();
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  const oos = isOutOfStock(product);
  const sale = isOnSale(product);
  const { price, isFrom } = displayPrice(product);
  const img = productImage(product, "small");
  const name = tx(product.name, product.ar_name);
  const cat = categorySlug({
    id: product.category_id ?? 0,
    name: product.category_name ?? "",
    slug: null,
  });
  const href = `/product/${cat}/${productSlug(product)}`;

  const needsOptions = product.has_variants || product.has_required_options;

  function quickAdd(e: React.MouseEvent) {
    e.preventDefault();
    if (oos) return;
    add({
      productId: product.id,
      name: product.name,
      ar_name: product.ar_name,
      image: img,
      unitPrice: product.price,
      quantity: 1,
      options: [],
      categoryId: product.category_id,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  return (
    <article className="product-card">
      <Link href={href} className="product-card__media" aria-label={name}>
        {sale && !oos && <span className="badge badge-sale">{t("sale")}</span>}
        {oos && <span className="badge badge-oos">{t("soldOut")}</span>}
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={name} loading="lazy" />
        ) : (
          <div className="product-card__ph" aria-hidden>
            {name.slice(0, 1) || "◆"}
          </div>
        )}
      </Link>
      <div className="product-card__body">
        {product.category_name && (
          <span className="product-card__cat">
            {tx(product.category_name, product.category_ar_name)}
          </span>
        )}
        <Link href={href}>
          <h3 className="product-card__title">{name}</h3>
        </Link>
        <div className="product-card__price">
          {isFrom && <span className="muted" style={{ fontSize: 12 }}>{t("from")}</span>}
          {sale && (
            <span className="price-strike">
              {formatMoney(product.striked_price ?? 0, currency, locale)}
            </span>
          )}
          <span className={sale ? "price-sale" : "price-now"}>
            {formatMoney(price, currency, locale)}
          </span>
        </div>
        <div className="product-card__actions">
          {oos ? (
            <button className="btn btn-sm btn-outline btn-block" disabled>
              {t("soldOut")}
            </button>
          ) : needsOptions ? (
            <Link href={href} className="btn btn-sm btn-outline btn-block">
              {t("chooseOptions")}
            </Link>
          ) : (
            <button
              className="btn btn-sm btn-outline btn-block"
              onClick={quickAdd}
              aria-live="polite"
            >
              {added ? (
                <>
                  <IconCheck width={15} height={15} /> {t("added")}
                </>
              ) : (
                t("addToCart")
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
