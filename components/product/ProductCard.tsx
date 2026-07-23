"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { sfGet } from "@/lib/client-api";
import type { ProductShort } from "@/lib/ordable/types";
import { useStore } from "@/components/providers/StoreProvider";
import { useCart } from "@/components/providers/CartProvider";
import { displayPrice, formatMoney, isOnSale, isOutOfStock, productImage } from "@/lib/format";
import { productSlug, categorySlug } from "@/lib/slug";
import { IconCheck } from "@/components/ui/icons";

export default function ProductCard({ product }: { product: ProductShort }) {
  const { locale, currency, t, tx, branchId } = useStore();
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  const oos = isOutOfStock(product);
  const sale = isOnSale(product);
  const asDetail = product as any;
  const [fetchedVariants, setFetchedVariants] = useState<any[]>([]);
  const [fetchedVariantKeys, setFetchedVariantKeys] = useState<any[]>([]);
  const [fetchedOptions, setFetchedOptions] = useState<any[]>([]);

  useEffect(() => {
    const needsFetchVariants = product.has_variants && !asDetail.variants;
    const needsFetchOptions = product.price === 0 && product.has_required_options && !asDetail.options;
    
    if (needsFetchVariants || needsFetchOptions) {
      sfGet(`/product/?product_id=${product.id}&branch_id=${branchId}`).then(res => {
        if (res.ok && res.data) {
          const detail = res.data as any;
          if (detail.variants) setFetchedVariants(detail.variants);
          if (detail.variant_keys) setFetchedVariantKeys(detail.variant_keys);
          if (detail.options) setFetchedOptions(detail.options);
        }
      });
    }
  }, [product.id, product.has_variants, product.price, product.has_required_options, branchId, asDetail.variants, asDetail.options]);

  const { price, isFrom } = displayPrice({ ...product, options: asDetail.options || fetchedOptions });
  const img = productImage(product, "small");
  const name = tx(product.name, product.ar_name);
  const cat = categorySlug({
    id: product.category_id ?? 0,
    name: product.category_name ?? "",
    slug: null,
  });
  const href = `/product/${cat}/${productSlug(product)}`;

  const needsOptions = product.has_variants || product.has_required_options;

  const variantKeys = asDetail.variant_keys || fetchedVariantKeys;
  const variants = asDetail.variants || fetchedVariants;
  
  const swatchImages: { url: string; label: string }[] = [];
  if (product.has_variants && variants.length > 0) {
    const colorKey = variantKeys.find((k: any) => 
      /colou?rs?|لون|style/i.test(k.variant_key + (k.variant_key_ar ?? ""))
    );
    if (colorKey) {
      const seen = new Set<string>();
      for (const v of variants) {
        const vv = v.variant_values || [];
        const match = vv.find((x: any) => x.variant_key === colorKey.variant_key);
        if (match) {
          const photo = v.photo_small || v.photo;
          if (photo && !seen.has(match.variant_value)) {
            seen.add(match.variant_value);
            swatchImages.push({ url: photo, label: match.variant_value });
          }
        }
      }
    }
  }

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
        {swatchImages.length > 0 && (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            {swatchImages.slice(0, 5).map((swatch, idx) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img 
                key={idx} 
                src={swatch.url} 
                alt={swatch.label} 
                title={swatch.label} 
                style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--line-strong)' }} 
              />
            ))}
            {swatchImages.length > 5 && (
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', alignSelf: 'center', marginLeft: 2 }}>
                +{swatchImages.length - 5}
              </span>
            )}
          </div>
        )}
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
