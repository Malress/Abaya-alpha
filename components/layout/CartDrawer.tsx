"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/components/providers/StoreProvider";
import { useCart } from "@/components/providers/CartProvider";
import { formatMoney } from "@/lib/format";
import { lineTotal } from "@/lib/cart";
import { IconClose, IconMinus, IconPlus, IconTrash } from "@/components/ui/icons";

export default function CartDrawer() {
  const { cartOpen, setCartOpen, locale, currency, t, tx, config } = useStore();
  const { lines, subtotal, setQuantity, remove, count } = useCart();
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!cartOpen) return;
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCartOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [cartOpen, setCartOpen]);

  if (!cartOpen) return null;

  const minOrder = config.minimum_order ?? 0;
  const belowMin = minOrder > 0 && subtotal < minOrder;

  function goCheckout() {
    setCartOpen(false);
    router.push("/checkout");
  }

  return (
    <>
      <div className="scrim" onClick={() => setCartOpen(false)} />
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t("cart")}
      >
        <div className="drawer__head">
          <span className="drawer__title">
            {t("cart")} ({count})
          </span>
          <button
            ref={closeRef}
            className="iconbtn"
            aria-label={t("backToShop")}
            onClick={() => setCartOpen(false)}
          >
            <IconClose />
          </button>
        </div>

        <div className="drawer__body">
          {lines.length === 0 ? (
            <div className="empty-state">
              <h3>{t("emptyCart")}</h3>
              <p>{t("emptyCartHint")}</p>
              <button
                className="btn btn-outline btn-sm"
                style={{ marginTop: 16 }}
                onClick={() => setCartOpen(false)}
              >
                {t("continueShopping")}
              </button>
            </div>
          ) : (
            lines.map((l) => (
              <div key={l.lineId} className="cart-line">
                {l.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="cart-line__img" src={l.image} alt="" />
                ) : (
                  <div className="cart-line__img" />
                )}
                <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                  <span className="cart-line__title">{tx(l.name, l.ar_name)}</span>
                  {l.variantLabel && (
                    <span className="cart-line__meta">{l.variantLabel}</span>
                  )}
                  {l.options.map((o) => (
                    <span key={o.id} className="cart-line__meta">
                      {o.name}
                    </span>
                  ))}
                  <div className="stepper" style={{ marginTop: 6 }}>
                    <button
                      aria-label={t("remove")}
                      onClick={() => setQuantity(l.lineId, l.quantity - 1)}
                    >
                      <IconMinus width={15} height={15} />
                    </button>
                    <span>{l.quantity}</span>
                    <button
                      aria-label={t("quantity")}
                      onClick={() => setQuantity(l.lineId, l.quantity + 1)}
                    >
                      <IconPlus width={15} height={15} />
                    </button>
                  </div>
                </div>
                <div className="stack" style={{ alignItems: "flex-end", gap: 10 }}>
                  <span>{formatMoney(lineTotal(l), currency, locale)}</span>
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
            ))
          )}
        </div>

        {lines.length > 0 && (
          <div className="drawer__foot">
            <div className="spread" style={{ marginBottom: 14 }}>
              <span className="label">{t("subtotal")}</span>
              <strong style={{ fontSize: 17 }}>
                {formatMoney(subtotal, currency, locale)}
              </strong>
            </div>
            {belowMin && (
              <p className="notice notice-error" style={{ marginBottom: 12 }}>
                {t("minimumOrder")}: {formatMoney(minOrder, currency, locale)}
              </p>
            )}
            <button
              className="btn btn-lg btn-block"
              disabled={belowMin}
              onClick={goCheckout}
            >
              {t("checkout")}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
