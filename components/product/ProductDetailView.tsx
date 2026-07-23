"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/components/providers/StoreProvider";
import { useCart } from "@/components/providers/CartProvider";
import { formatMoney, isOutOfStock } from "@/lib/format";
import type {
  ExtraField,
  OptionChoice,
  ProductDetail,
  ProductOption,
  ProductShort,
  ProductVariant,
  Review,
  SelectedOption,
} from "@/lib/ordable/types";
import { uploadFile } from "@/lib/client-api";
import ProductCard from "./ProductCard";
import Reviews from "./Reviews";
import ReviewForm from "./ReviewForm";
import Gallery from "./Gallery";
import { IconCheck, IconMinus, IconPlus } from "@/components/ui/icons";

export default function ProductDetailView({
  product,
  description,
  crossSell,
  reviews,
  enableReviews,
}: {
  product: ProductDetail;
  description: string;
  crossSell: ProductShort[];
  reviews: Review[];
  enableReviews: boolean;
}) {
  const { locale, currency, t, tx, setCartOpen } = useStore();
  const { add } = useCart();

  const variantKeys = useMemo(() => product.variant_keys ?? [], [product.variant_keys]);
  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const hasVariants = Boolean(product.has_variants && variants.length);

  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const [optionSel, setOptionSel] = useState<Record<number, Record<number, number>>>(
    () => initOptions(product.options ?? []),
  );
  const [extraVals, setExtraVals] = useState<Record<number, string>>({});
  const [uploading, setUploading] = useState<Record<number, boolean>>({});
  const [remarks, setRemarks] = useState("");
  const [qty, setQty] = useState(product.min_addable_quantity || 1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve the matching variant child once every key has a selection.
  const resolvedVariant: ProductVariant | null = useMemo(() => {
    if (!hasVariants) return null;
    if (variantKeys.some((k) => !selectedValues[k.variant_key])) return null;
    return (
      variants.find((v) =>
        (v.variant_values ?? []).every(
          (vv) => selectedValues[vv.variant_key] === vv.variant_value,
        ),
      ) ?? null
    );
  }, [hasVariants, variantKeys, variants, selectedValues]);

  const active = resolvedVariant ?? product;
  const oos = isOutOfStock({
    product_type: active.type_of_product || product.product_type,
    inventory_on_hand: active.inventory_on_hand,
    allow_preordering: product.allow_preordering,
    buyable: active.buyable,
  });

  const basePrice = resolvedVariant?.price ?? product.price;
  const strikePrice = resolvedVariant?.striked_price ?? product.striked_price;

  const options = useMemo(
    () => [...(product.options ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [product.options],
  );
  const extraFields = useMemo(
    () => [...(product.extra_fields ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [product.extra_fields],
  );

  const selectedOptions: SelectedOption[] = useMemo(() => {
    const out: SelectedOption[] = [];
    for (const opt of options) {
      const picks = optionSel[opt.id] ?? {};
      for (const choice of opt.choices ?? []) {
        const q = picks[choice.id] ?? 0;
        if (q > 0) {
          out.push({
            id: choice.id,
            quantity: q,
            name: tx(choice.name, choice.ar_name),
            price: choice.price ?? 0,
          });
        }
      }
    }
    return out;
  }, [options, optionSel, tx]);

  const optionsTotal = selectedOptions.reduce((s, o) => s + (o.price ?? 0) * o.quantity, 0);
  const unitTotal = basePrice + optionsTotal;

  // ---- validation ----
  function optionQtyTotal(opt: ProductOption): number {
    const picks = optionSel[opt.id] ?? {};
    return Object.values(picks).reduce((a, b) => a + b, 0);
  }
  const optionErrors = options.filter(
    (o) => (o.minimum ?? 0) > 0 && optionQtyTotal(o) < (o.minimum ?? 0),
  );
  const missingExtra = extraFields.filter(
    (f) => f.required && !(extraVals[f.id] ?? "").trim(),
  );
  const needsVariant = hasVariants && !resolvedVariant;
  const canAdd =
    !oos && !needsVariant && optionErrors.length === 0 && missingExtra.length === 0;

  function setSingle(opt: ProductOption, choiceId: number) {
    setOptionSel((prev) => ({ ...prev, [opt.id]: { [choiceId]: 1 } }));
  }
  function toggleCheckbox(opt: ProductOption, choiceId: number) {
    setOptionSel((prev) => {
      const cur = prev[opt.id]?.[choiceId] ?? 0;
      return { ...prev, [opt.id]: { ...(prev[opt.id] ?? {}), [choiceId]: cur ? 0 : 1 } };
    });
  }
  function stepChoice(opt: ProductOption, choice: OptionChoice, delta: number) {
    setOptionSel((prev) => {
      const cur = prev[opt.id]?.[choice.id] ?? 0;
      const optTotal = optionQtyTotal(opt);
      let next = cur + delta;
      if (next < 0) next = 0;
      if (choice.maximum != null && next > choice.maximum) next = choice.maximum;
      if (opt.maximum != null && delta > 0 && optTotal + delta > opt.maximum) return prev;
      return { ...prev, [opt.id]: { ...(prev[opt.id] ?? {}), [choice.id]: next } };
    });
  }

  async function onFile(field: ExtraField, file: File | null) {
    if (!file) return;
    setUploading((u) => ({ ...u, [field.id]: true }));
    const res = await uploadFile(file);
    setUploading((u) => ({ ...u, [field.id]: false }));
    if (res.ok && res.data?.file_url) {
      setExtraVals((v) => ({ ...v, [field.id]: res.data!.file_url }));
    } else {
      setError(res.message || "Upload failed");
    }
  }

  function handleAdd() {
    if (!canAdd) {
      setError(needsVariant ? t("selectOptions") : t("required"));
      return;
    }
    setError(null);
    const variantLabel = resolvedVariant
      ? variantKeys.map((k) => selectedValues[k.variant_key]).join(" · ")
      : undefined;
    add({
      productId: resolvedVariant?.id ?? product.id,
      parentId: product.id,
      name: product.name,
      ar_name: product.ar_name,
      image: resolvedVariant?.photo_medium || resolvedVariant?.photo || product.photo_medium || product.photo,
      unitPrice: basePrice,
      quantity: qty,
      options: selectedOptions,
      extraFields: extraFields
        .filter((f) => extraVals[f.id])
        .map((f) => ({ id: f.id, value: extraVals[f.id], name: tx(f.name, f.ar_name) })),
      specialRequests: remarks,
      variantLabel,
      categoryId: product.category_id,
      noMingling: product.no_mingling,
      maxQuantity: product.max_addable_quantity || undefined,
    });
    setAdded(true);
    setCartOpen(true);
    setTimeout(() => setAdded(false), 1800);
  }

  // Available values per key, cross-filtered by current selection.
  function valuesForKey(key: string): { value: string; label: string; photo?: string | null }[] {
    const seen = new Map<string, { value: string; label: string; photo?: string | null }>();
    for (const v of variants) {
      const vv = v.variant_values ?? [];
      const compatible = vv.every(
        (x) => x.variant_key === key || !selectedValues[x.variant_key] || selectedValues[x.variant_key] === x.variant_value,
      );
      if (!compatible) continue;
      const match = vv.find((x) => x.variant_key === key);
      if (match && !seen.has(match.variant_value)) {
        seen.set(match.variant_value, {
          value: match.variant_value,
          label: locale === "ar" ? match.variant_value_ar || match.variant_value : match.variant_value,
          photo: v.photo_small || v.photo,
        });
      }
    }
    return [...seen.values()];
  }

  const galleryImgs = useMemo(() => {
    const imgs: string[] = [];
    const push = (u?: string | null) => u && !imgs.includes(u) && imgs.push(u);
    if (resolvedVariant) push(resolvedVariant.photo_medium || resolvedVariant.photo);
    push(product.photo_medium || product.photo);
    for (const g of product.gallery ?? []) push(g.photo_medium || g.photo);
    return imgs;
  }, [product, resolvedVariant]);

  return (
    <>
      <div className="pdp">
        <div className="pdp__gallery">
          <Gallery images={galleryImgs} alt={tx(product.name, product.ar_name)} />
        </div>

        <div className="pdp__info">
          {product.category_name && (
            <span className="eyebrow">{tx(product.category_name, product.category_ar_name)}</span>
          )}
          <h1 className="pdp__title">{tx(product.name, product.ar_name)}</h1>

          <div className="pdp__price">
            {strikePrice && strikePrice > basePrice && (
              <span className="price-strike" style={{ fontSize: 18 }}>
                {formatMoney(strikePrice, currency, locale)}
              </span>
            )}
            <span
              className={strikePrice && strikePrice > basePrice ? "price-sale" : "price-now"}
              style={{ fontSize: 24 }}
            >
              {formatMoney(unitTotal, currency, locale)}
            </span>
          </div>

          {oos && <p className="notice notice-error">{t("outOfStock")}</p>}

          {/* Variants */}
          {hasVariants &&
            variantKeys.map((k) => {
              const isColor = /colou?rs?|لون/i.test(k.variant_key + (k.variant_key_ar ?? ""));
              const values = valuesForKey(k.variant_key);
              return (
                <div key={k.variant_key} className="pdp__group">
                  <span className="label">
                    {locale === "ar" ? k.variant_key_ar || k.variant_key : k.variant_key}
                  </span>
                  <div className="chips">
                    {values.map((v) => {
                      const selected = selectedValues[k.variant_key] === v.value;
                      return (
                        <button
                          key={v.value}
                          type="button"
                          className={`chip ${selected ? "chip--on" : ""} ${isColor && v.photo ? "chip--swatch" : ""}`}
                          onClick={() =>
                            setSelectedValues((prev) => ({ ...prev, [k.variant_key]: v.value }))
                          }
                          aria-pressed={selected}
                          title={v.label}
                        >
                          {isColor && v.photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={v.photo} alt={v.label} />
                          ) : (
                            v.label
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

          {/* Options */}
          {options.map((opt) => {
            const label = tx(opt.option_name || opt.name, opt.option_ar_name || opt.ar_name);
            const required = (opt.minimum ?? 0) > 0;
            const choices = [...(opt.choices ?? [])].sort(
              (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
            );
            return (
              <div key={opt.id} className="pdp__group">
                <span className="label">
                  {label || t("selectOptions")}{" "}
                  <span className="muted" style={{ textTransform: "none", letterSpacing: 0 }}>
                    {required ? `· ${t("required")}` : `· ${t("optional")}`}
                  </span>
                </span>
                <div className="stack" style={{ gap: 8 }}>
                  {choices.map((c) => {
                    const q = optionSel[opt.id]?.[c.id] ?? 0;
                    const priceLabel =
                      (c.price ?? 0) > 0 ? ` +${formatMoney(c.price ?? 0, currency, locale)}` : "";
                    if (opt.multiple) {
                      return (
                        <div key={c.id} className="opt-row">
                          <span>
                            {tx(c.name, c.ar_name)}
                            <span className="muted">{priceLabel}</span>
                          </span>
                          <div className="stepper">
                            <button
                              aria-label="−"
                              disabled={q <= 0}
                              onClick={() => stepChoice(opt, c, -1)}
                            >
                              <IconMinus width={14} height={14} />
                            </button>
                            <span>{q}</span>
                            <button aria-label="+" onClick={() => stepChoice(opt, c, 1)}>
                              <IconPlus width={14} height={14} />
                            </button>
                          </div>
                        </div>
                      );
                    }
                    const single = !opt.multiple && (opt.maximum ?? 1) <= 1;
                    return (
                      <label key={c.id} className="opt-row" style={{ cursor: "pointer" }}>
                        <span>
                          {tx(c.name, c.ar_name)}
                          <span className="muted">{priceLabel}</span>
                        </span>
                        <input
                          type={single ? "radio" : "checkbox"}
                          name={`opt-${opt.id}`}
                          checked={q > 0}
                          onChange={() =>
                            single ? setSingle(opt, c.id) : toggleCheckbox(opt, c.id)
                          }
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Extra fields */}
          {extraFields.map((f) => (
            <div key={f.id} className="field pdp__group">
              <label>
                {tx(f.name, f.ar_name)} {f.required ? `· ${t("required")}` : ""}
              </label>
              {f.type === "text" && (
                <input
                  className="input"
                  value={extraVals[f.id] ?? ""}
                  onChange={(e) => setExtraVals((v) => ({ ...v, [f.id]: e.target.value }))}
                />
              )}
              {f.type === "checkbox" && (
                <label className="row" style={{ gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={extraVals[f.id] === "true"}
                    onChange={(e) =>
                      setExtraVals((v) => ({ ...v, [f.id]: e.target.checked ? "true" : "" }))
                    }
                  />
                  <span>{tx(f.name, f.ar_name)}</span>
                </label>
              )}
              {f.type === "file" && (
                <div className="stack" style={{ gap: 6 }}>
                  <input
                    type="file"
                    onChange={(e) => onFile(f, e.target.files?.[0] ?? null)}
                  />
                  {uploading[f.id] && <span className="help">{t("processing")}</span>}
                  {extraVals[f.id] && <span className="help">✓ {t("added")}</span>}
                </div>
              )}
            </div>
          ))}

          {product.allow_special_remarks && (
            <div className="field pdp__group">
              <label>{t("specialRequests")}</label>
              <textarea
                className="textarea"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          )}

          {/* Quantity + add */}
          <div className="pdp__group">
            <span className="label">{t("quantity")}</span>
            <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
              <div className="stepper">
                <button
                  aria-label="−"
                  disabled={qty <= (product.min_addable_quantity || 1)}
                  onClick={() => setQty((q) => Math.max(product.min_addable_quantity || 1, q - (product.increments || 1)))}
                >
                  <IconMinus width={16} height={16} />
                </button>
                <span>{qty}</span>
                <button
                  aria-label="+"
                  disabled={product.max_addable_quantity ? qty >= product.max_addable_quantity : false}
                  onClick={() => setQty((q) => q + (product.increments || 1))}
                >
                  <IconPlus width={16} height={16} />
                </button>
              </div>
            </div>
          </div>

          {error && <p className="field-error">{error}</p>}

          <button
            className="btn btn-lg btn-block"
            style={{ marginTop: 8 }}
            disabled={!canAdd}
            onClick={handleAdd}
            aria-live="polite"
          >
            {added ? (
              <>
                <IconCheck width={17} height={17} /> {t("added")}
              </>
            ) : needsVariant ? (
              t("selectOptions")
            ) : oos ? (
              t("soldOut")
            ) : (
              `${t("addToCart")} · ${formatMoney(unitTotal * qty, currency, locale)}`
            )}
          </button>

          {description && (
            <details className="pdp__desc" open>
              <summary className="label">{t("description")}</summary>
              <div className="prose" dangerouslySetInnerHTML={{ __html: description }} />
            </details>
          )}
        </div>
      </div>

      {crossSell.length > 0 && (
        <section className="section-tight">
          <div className="section-head">
            <h2 className="section-title" style={{ fontSize: "clamp(24px,4vw,36px)" }}>
              {t("youMayAlsoLike")}
            </h2>
          </div>
          <div className="product-grid">
            {crossSell.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {enableReviews && (
        <section className="section-tight">
          <div className="section-head">
            <h2 className="section-title" style={{ fontSize: "clamp(24px,4vw,36px)" }}>
              {t("reviews")}
            </h2>
          </div>
          {reviews.length > 0 ? (
            <Reviews reviews={reviews} />
          ) : (
            <p className="muted center" style={{ marginBottom: 24 }}>
              {locale === "ar" ? "لا توجد تقييمات بعد." : "No reviews yet."}
            </p>
          )}
          <ReviewForm productId={product.id} />
        </section>
      )}

      <style>{pdpCss}</style>
    </>
  );
}

function initOptions(options: ProductOption[]): Record<number, Record<number, number>> {
  const out: Record<number, Record<number, number>> = {};
  for (const opt of options) {
    out[opt.id] = {};
    for (const c of opt.choices ?? []) {
      if ((c.preselected ?? 0) > 0) out[opt.id][c.id] = c.preselected ?? 1;
    }
  }
  return out;
}

const pdpCss = `
.pdp{display:grid;grid-template-columns:1fr;gap:clamp(24px,4vw,56px);padding-bottom:56px}
@media(min-width:900px){.pdp{grid-template-columns:1.05fr 1fr;align-items:start}
.pdp__info{position:sticky;top:calc(var(--header-h) + 12px)}}
.pdp__title{font-size:clamp(28px,4vw,44px);margin:10px 0 14px}
.pdp__price{display:flex;gap:12px;align-items:baseline;margin-bottom:22px}
.pdp__group{margin-bottom:22px;display:flex;flex-direction:column;gap:10px}
.chips{display:flex;flex-wrap:wrap;gap:10px}
.chip{min-height:42px;min-width:44px;padding:0 16px;border:1px solid var(--line-strong);background:var(--surface);
 font-family:var(--font-sans);font-size:12px;letter-spacing:0.06em;text-transform:uppercase;border-radius:var(--radius-xs);color:var(--ink)}
.chip--on{border-color:var(--ink);background:var(--ink);color:#fff}
.chip--swatch{padding:0;width:46px;height:46px;overflow:hidden}
.chip--swatch img{width:100%;height:100%;object-fit:cover}
.chip--swatch.chip--on{outline:2px solid var(--ink);outline-offset:2px}
.opt-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:var(--radius-xs);background:var(--surface)}
.pdp__desc{margin-top:14px;border-top:1px solid var(--line);padding-top:18px}
.pdp__desc summary{cursor:pointer;margin-bottom:12px}
`;
