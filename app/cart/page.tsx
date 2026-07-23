"use client";

import Link from "next/link";
import { useStore } from "@/components/providers/StoreProvider";
import { useCart } from "@/components/providers/CartProvider";
import { formatMoney } from "@/lib/format";
import { lineTotal } from "@/lib/cart";
import { IconMinus, IconPlus, IconTrash } from "@/components/ui/icons";

export default function CartPage() {
  const { locale, currency, config, t, tx } = useStore();
  const { lines, subtotal, setQuantity, remove, count, hydrated } = useCart();

  const minOrder = config.minimum_order ?? 0;
  const belowMin = minOrder > 0 && subtotal < minOrder;

  return (
    <div className="container section-tight">
      <div className="section-head">
        <h1 className="section-title">{t("cart")}</h1>
      </div>

      {!hydrated ? (
        <div className="center" style={{ padding: 60 }}>
          <span className="spinner" />
        </div>
      ) : lines.length === 0 ? (
        <div className="empty-state">
          <h3>{t("emptyCart")}</h3>
          <p>{t("emptyCartHint")}</p>
          <Link href="/" className="btn btn-outline" style={{ marginTop: 18 }}>
            {t("continueShopping")}
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 40,
            gridTemplateColumns: "1fr",
            alignItems: "start",
            paddingBottom: 60,
          }}
          className="cart-layout"
        >
          <div>
            {lines.map((l) => (
              <div key={l.lineId} className="cart-line" style={{ gridTemplateColumns: "90px 1fr auto" }}>
                {l.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="cart-line__img" style={{ width: 90, height: 116 }} src={l.image} alt="" />
                ) : (
                  <div className="cart-line__img" style={{ width: 90, height: 116 }} />
                )}
                <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                  <span className="cart-line__title" style={{ fontSize: 16 }}>
                    {tx(l.name, l.ar_name)}
                  </span>
                  {l.variantLabel && <span className="cart-line__meta">{l.variantLabel}</span>}
                  {l.options.map((o) => (
                    <span key={o.id} className="cart-line__meta">
                      {o.name}
                      {(o.price ?? 0) > 0 ? ` (+${formatMoney(o.price ?? 0, currency, locale)})` : ""}
                    </span>
                  ))}
                  <div className="stepper" style={{ marginTop: 8 }}>
                    <button aria-label={t("remove")} onClick={() => setQuantity(l.lineId, l.quantity - 1)}>
                      <IconMinus width={15} height={15} />
                    </button>
                    <span>{l.quantity}</span>
                    <button aria-label={t("quantity")} onClick={() => setQuantity(l.lineId, l.quantity + 1)}>
                      <IconPlus width={15} height={15} />
                    </button>
                  </div>
                </div>
                <div className="stack" style={{ alignItems: "flex-end", gap: 12 }}>
                  <strong>{formatMoney(lineTotal(l), currency, locale)}</strong>
                  <button
                    className="iconbtn"
                    style={{ width: 34, height: 34 }}
                    aria-label={t("remove")}
                    onClick={() => remove(l.lineId)}
                  >
                    <IconTrash width={17} height={17} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <aside
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-xs)",
              padding: 24,
            }}
          >
            <h3 style={{ fontSize: 22, marginBottom: 18 }}>{t("orderSummary")}</h3>
            <div className="spread" style={{ marginBottom: 10 }}>
              <span className="muted">
                {t("subtotal")} ({count})
              </span>
              <span>{formatMoney(subtotal, currency, locale)}</span>
            </div>
            <hr className="divider" style={{ margin: "16px 0" }} />
            <div className="spread" style={{ marginBottom: 18 }}>
              <strong>{t("total")}</strong>
              <strong style={{ fontSize: 18 }}>{formatMoney(subtotal, currency, locale)}</strong>
            </div>
            {belowMin && (
              <p className="notice notice-error" style={{ marginBottom: 12 }}>
                {t("minimumOrder")}: {formatMoney(minOrder, currency, locale)}
              </p>
            )}
            <Link
              href="/checkout"
              className="btn btn-lg btn-block"
              aria-disabled={belowMin}
              style={belowMin ? { opacity: 0.45, pointerEvents: "none" } : undefined}
            >
              {t("checkout")}
            </Link>
            <Link href="/" className="btn btn-ghost btn-block" style={{ marginTop: 10 }}>
              {t("continueShopping")}
            </Link>
          </aside>
        </div>
      )}

      <style>{`@media(min-width:900px){.cart-layout{grid-template-columns:1fr 360px !important}}`}</style>
    </div>
  );
}
