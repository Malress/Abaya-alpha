"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/components/providers/StoreProvider";
import { useCart } from "@/components/providers/CartProvider";
import { authAction, sfGet, submitOrder } from "@/lib/client-api";
import { formatMoney } from "@/lib/format";
import { toOrderItems } from "@/lib/cart";
import { computeFulfillment } from "@/lib/fulfillment";
import type {
  Area,
  Branch,
  Country,
  PaymentMethod,
  Promotion,
  StorePage,
} from "@/lib/ordable/types";
import { IconChevronDown } from "@/components/ui/icons";
import AuthPanel from "@/components/account/AuthPanel";

interface Me {
  id: number;
  name?: string;
  phone?: string;
  email?: string;
  points?: number;
}

export default function CheckoutView({
  branch,
  areas,
  payments,
  promotions,
  countries,
  agreements,
}: {
  branch: Branch;
  areas: Area[];
  payments: PaymentMethod[];
  promotions: Promotion[];
  countries: Country[];
  agreements: StorePage[];
}) {
  const { config, locale, currency, t, tx } = useStore();
  const { lines, subtotal, clear, hydrated } = useCart();
  const router = useRouter();

  const [me, setMe] = useState<Me | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [wallet, setWallet] = useState(0);

  const canDelivery = branch?.enable_delivery ?? true;
  const canPickup = branch?.enable_pickup ?? false;
  const [isDelivery, setIsDelivery] = useState(canDelivery);

  const [areaId, setAreaId] = useState<number | null>(null);
  const [addr, setAddr] = useState({
    block: "", street: "", building: "", floor: "", apartment: "", additional: "",
  });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [timing, setTiming] = useState<
    { kind: "asap" } | { kind: "slot"; date: string; start: string; end: string } | null
  >(null);

  const [payment, setPayment] = useState<string>("");
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [usePoints, setUsePoints] = useState(false);

  const [isGift, setIsGift] = useState(false);
  const [gift, setGift] = useState({ name: "", number: "", message: "" });

  const [agreed, setAgreed] = useState<Record<string, boolean>>({});
  const [dry, setDry] = useState<{ delivery: number; discount: number; vat: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const dialCode = countries[0]?.dial_code;
  const homeCountry = countries[0];

  // Sign-in status + balances
  useEffect(() => {
    authAction<{ authenticated?: boolean } & Me>({ action: "me" }).then((res) => {
      const data = res.raw as { authenticated?: boolean; data?: Me };
      if (data?.authenticated && data.data) {
        setMe(data.data);
        setName((n) => n || data.data!.name || "");
        setPhone((p) => p || data.data!.phone || "");
        setEmail((e) => e || data.data!.email || "");
        if (config.enable_wallet && config.enable_wallet_staff) {
          sfGet<{ balance?: number }>("/auth/wallet/").then((w) => {
            const b = (w.raw as { data?: { balance?: number } })?.data?.balance ?? (w.data as { balance?: number })?.balance;
            if (typeof b === "number") setWallet(b);
          });
        }
      }
    });
  }, [config.enable_wallet, config.enable_wallet_staff]);

  const fulfillment = useMemo(
    () => (branch ? computeFulfillment(branch, isDelivery, locale) : { asap: { available: false }, days: [] }),
    [branch, isDelivery, locale],
  );

  // Preselect single payment method.
  const availablePayments = useMemo(() => {
    let list = payments;
    if (branch?.disable_cash) list = list.filter((p) => p.value !== "cash" && p.value !== "kod");
    if (isGift && config.disable_cash_for_gift)
      list = list.filter((p) => p.value !== "cash" && p.value !== "kod");
    return list;
  }, [payments, branch, isGift, config.disable_cash_for_gift]);

  useEffect(() => {
    if (availablePayments.length === 1) setPayment(availablePayments[0].value);
    else if (payment && !availablePayments.some((p) => p.value === payment)) setPayment("");
  }, [availablePayments, payment]);

  const selectedArea = areas.find((a) => a.id === areaId);
  const deliveryRate = isDelivery ? dry?.delivery ?? selectedArea?.delivery_rate ?? 0 : 0;
  const discount = dry?.discount ?? 0;
  const vat = dry?.vat ?? 0;
  const walletApplied = useWallet ? Math.min(wallet, Math.max(0, subtotal + deliveryRate - discount)) : 0;
  const total = Math.max(0, subtotal + deliveryRate + vat - discount - walletApplied);

  const areaMin = selectedArea?.minimum_order_value ?? 0;
  const belowAreaMin = isDelivery && areaMin > 0 && subtotal < areaMin;

  // Build the order payload.
  const buildPayload = useCallback(
    (dryRun: boolean) => {
      const returnBase = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
      const isOnline = payment && payment !== "cash" && payment !== "kod";
      const smart = promotions
        .filter((p) => !p.code)
        .flatMap((p) =>
          (p.discounts ?? []).map((d) => ({ type: d.type, id: d.id, promo: p.id })),
        );
      const smartMap: Record<string, { id: number; promo: number }[]> = {};
      for (const s of smart) {
        (smartMap[s.type] ??= []).push({ id: s.id, promo: s.promo });
      }
      return {
        branch_id: branch?.id,
        is_delivery: isDelivery,
        fulfillment_date: timing?.kind === "slot" ? timing.date : fulfillment.asap.date,
        fulfillment_slot_start: timing?.kind === "slot" ? timing.start : fulfillment.asap.start,
        fulfillment_slot_end: timing?.kind === "slot" ? timing.end : fulfillment.asap.end,
        customer: { name, phone: dialCode && phone && !phone.startsWith("+") ? phone : phone, email },
        delivery_address: isDelivery
          ? { area_id: areaId, ...addr }
          : undefined,
        items: toOrderItems(lines),
        payment_method: payment || undefined,
        success_url: isOnline ? `${returnBase}/order/return?status=success` : undefined,
        fail_url: isOnline ? `${returnBase}/order/return?status=fail` : undefined,
        language: locale === "ar" ? "arabic" : "english",
        special_remarks: "",
        manuallyAppliedPromotion: appliedCoupon ? { code: appliedCoupon } : undefined,
        smartPromotionsDiscounts: Object.keys(smartMap).length ? smartMap : undefined,
        use_customer_wallet: me && useWallet ? 1 : undefined,
        use_customer_points: me && usePoints ? 1 : undefined,
        is_gift: isGift || undefined,
        gift_recipient_name: isGift ? gift.name || undefined : undefined,
        gift_recipient_number: isGift ? gift.number || undefined : undefined,
        gift_message: isGift ? gift.message || undefined : undefined,
        dry_run: dryRun,
      };
    },
    [branch, isDelivery, timing, fulfillment, name, phone, email, dialCode, areaId, addr, lines, payment, locale, appliedCoupon, promotions, me, useWallet, usePoints, isGift, gift],
  );

  // Dry-run validation whenever the money-affecting inputs change.
  const dryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated || lines.length === 0 || !branch) return;
    if (isDelivery && !areaId) return;
    if (dryTimer.current) clearTimeout(dryTimer.current);
    dryTimer.current = setTimeout(async () => {
      const res = await submitOrder(buildPayload(true));
      const data = (res.raw as { data?: Record<string, number> })?.data ?? {};
      setDry({
        delivery: Number(data.delivery_rate ?? selectedArea?.delivery_rate ?? 0),
        discount: Number(data.discount_total ?? 0),
        vat: Number(data.vat_amount ?? data.vat_with_product_price ?? 0),
      });
    }, 500);
    return () => {
      if (dryTimer.current) clearTimeout(dryTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, lines, areaId, isDelivery, appliedCoupon, useWallet, usePoints, isGift]);

  async function applyCoupon() {
    if (!coupon.trim()) return;
    setCouponMsg(null);
    const test = coupon.trim();
    const res = await submitOrder({ ...buildPayload(true), manuallyAppliedPromotion: { code: test } });
    if (res.ok) {
      const data = (res.raw as { data?: { discount_total?: number } })?.data ?? {};
      setAppliedCoupon(test);
      setCouponMsg(
        (data.discount_total ?? 0) > 0
          ? `${t("couponApplied")} · −${formatMoney(data.discount_total ?? 0, currency, locale)}`
          : t("couponApplied"),
      );
    } else {
      setAppliedCoupon(null);
      setCouponMsg(res.message || (locale === "ar" ? "رمز غير صالح" : "Invalid code"));
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = t("required");
    if (!phone.trim()) errs.phone = t("required");
    if (isDelivery && !areaId) errs.area = t("required");
    if (isDelivery && !addr.block.trim()) errs.block = t("required");
    if (isDelivery && !addr.street.trim()) errs.street = t("required");
    if (!timing) errs.timing = t("required");
    if (!payment) errs.payment = t("required");
    for (const a of agreements) {
      if (a.checkable && !agreed[a.title]) errs[`agree-${a.title}`] = t("required");
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function placeOrder() {
    setError(null);
    if (!validate()) {
      setError(locale === "ar" ? "يرجى إكمال الحقول المطلوبة" : "Please complete the required fields");
      return;
    }
    setSubmitting(true);
    const res = await submitOrder(buildPayload(false));
    setSubmitting(false);
    if (!res.ok) {
      setError(res.message || (locale === "ar" ? "تعذّر إتمام الطلب" : "Could not place order"));
      return;
    }
    const data = (res.raw as { data?: { tracking_id?: string; payment_link?: string } })?.data ?? {};
    // Persist a thin order record so the tracker has details before the first live fetch.
    try {
      if (data.tracking_id) {
        localStorage.setItem(
          `order_${data.tracking_id}`,
          JSON.stringify({ customer: { name, phone, email }, items: lines, total, placed: Date.now() }),
        );
      }
    } catch {
      /* ignore */
    }
    clear();
    if (data.payment_link) {
      window.location.href = data.payment_link;
      return;
    }
    router.push(`/order/return?status=success&tracking_id=${data.tracking_id ?? ""}`);
  }

  if (hydrated && lines.length === 0) {
    return (
      <div className="empty-state">
        <h3>{t("emptyCart")}</h3>
        <Link href="/" className="btn btn-outline" style={{ marginTop: 16 }}>
          {t("continueShopping")}
        </Link>
      </div>
    );
  }

  const sectionStyle: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-xs)",
    padding: "22px 22px 24px",
    marginBottom: 20,
  };

  return (
    <div className="checkout-grid" style={{ display: "grid", gap: 28, alignItems: "start" }}>
      <div>
        {/* Sign in */}
        {!me && (
          <div style={sectionStyle}>
            <div className="spread">
              <span className="drawer__title">{t("signInToCheckout")}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAuth((v) => !v)}>
                {t("signIn")}
              </button>
            </div>
            {showAuth && (
              <div style={{ marginTop: 18 }}>
                <AuthPanel
                  onAuthed={() => {
                    setShowAuth(false);
                    authAction<{ data?: Me }>({ action: "me" }).then((r) => {
                      const d = (r.raw as { data?: Me })?.data;
                      if (d) {
                        setMe(d);
                        setName((n) => n || d.name || "");
                        setPhone((p) => p || d.phone || "");
                        setEmail((e) => e || d.email || "");
                      }
                    });
                  }}
                />
              </div>
            )}
          </div>
        )}
        {me && (
          <div style={sectionStyle}>
            <span className="muted">
              {locale === "ar" ? "مرحباً" : "Signed in as"} <strong>{me.name || me.email}</strong>
            </span>
          </div>
        )}

        {/* Fulfillment mode */}
        {(canDelivery || canPickup) && (
          <div style={sectionStyle}>
            <span className="label" style={{ marginBottom: 12, display: "block" }}>
              {t("deliveryMethod")}
            </span>
            <div className="seg">
              {canDelivery && (
                <button
                  className={`seg__btn ${isDelivery ? "seg__btn--on" : ""}`}
                  onClick={() => { setIsDelivery(true); setTiming(null); }}
                >
                  {t("delivery")}
                </button>
              )}
              {canPickup && (
                <button
                  className={`seg__btn ${!isDelivery ? "seg__btn--on" : ""}`}
                  onClick={() => { setIsDelivery(false); setTiming(null); }}
                >
                  {t("pickup")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Area + address */}
        {isDelivery && (
          <div style={sectionStyle}>
            <span className="label" style={{ marginBottom: 12, display: "block" }}>
              {t("address")}
            </span>
            <div className="field" style={{ marginBottom: 14 }}>
              <label>{t("area")}</label>
              <div style={{ position: "relative" }}>
                <select
                  className="select"
                  style={{ appearance: "none", paddingInlineEnd: 34 }}
                  value={areaId ?? ""}
                  onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">{t("selectArea")}</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {tx(a.name, a.ar_name)}
                    </option>
                  ))}
                </select>
                <IconChevronDown width={16} height={16} style={{ position: "absolute", insetInlineEnd: 10, top: 14, pointerEvents: "none" }} />
              </div>
              {fieldErrors.area && <span className="field-error">{fieldErrors.area}</span>}
            </div>
            <div className="addr-grid">
              <Field label={t("block")} value={addr.block} onChange={(v) => setAddr({ ...addr, block: v })} err={fieldErrors.block} />
              <Field label={t("street")} value={addr.street} onChange={(v) => setAddr({ ...addr, street: v })} err={fieldErrors.street} />
              <Field label={t("building")} value={addr.building} onChange={(v) => setAddr({ ...addr, building: v })} />
              <Field label={t("floor")} value={addr.floor} onChange={(v) => setAddr({ ...addr, floor: v })} />
              <Field label={t("apartment")} value={addr.apartment} onChange={(v) => setAddr({ ...addr, apartment: v })} />
            </div>
            <div className="field" style={{ marginTop: 14 }}>
              <label>{t("additionalDirections")}</label>
              <input className="input" value={addr.additional} onChange={(e) => setAddr({ ...addr, additional: e.target.value })} />
            </div>
            {belowAreaMin && (
              <p className="notice notice-error" style={{ marginTop: 12 }}>
                {t("minimumOrder")}: {formatMoney(areaMin, currency, locale)}
              </p>
            )}
          </div>
        )}

        {/* Contact */}
        <div style={sectionStyle}>
          <span className="label" style={{ marginBottom: 12, display: "block" }}>
            {t("contactDetails")}
          </span>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>{t("fullName")}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>{t("phone")}</label>
            <div className="row" style={{ gap: 8 }}>
              {dialCode && (
                <span className="pill" dir="ltr" style={{ whiteSpace: "nowrap" }}>
                  {homeCountry?.flag} {dialCode}
                </span>
              )}
              <input className="input" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
            </div>
            {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
          </div>
          <div className="field">
            <label>{t("email")}</label>
            <input className="input" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
          </div>
        </div>

        {/* When */}
        <div style={sectionStyle}>
          <span className="label" style={{ marginBottom: 12, display: "block" }}>
            {t("when")}
          </span>
          <div className="slot-wrap">
            {fulfillment.asap.available && (
              <button
                className={`slot ${timing?.kind === "asap" ? "slot--on" : ""}`}
                onClick={() => setTiming({ kind: "asap" })}
              >
                {t("asap")}
              </button>
            )}
            {fulfillment.days.map((d) =>
              d.slots.map((s) => {
                const on = timing?.kind === "slot" && timing.date === d.date && timing.start === s.start;
                return (
                  <button
                    key={`${d.date}-${s.start}`}
                    className={`slot ${on ? "slot--on" : ""}`}
                    onClick={() => setTiming({ kind: "slot", date: d.date, start: s.start, end: s.end })}
                  >
                    <span className="slot__day">{d.label}</span>
                    <span dir="ltr">{s.label}</span>
                  </button>
                );
              }),
            )}
            {!fulfillment.asap.available && fulfillment.days.length === 0 && (
              <p className="muted">{locale === "ar" ? "لا توجد مواعيد متاحة" : "No slots available"}</p>
            )}
          </div>
          {fieldErrors.timing && <span className="field-error">{fieldErrors.timing}</span>}
        </div>

        {/* Gift */}
        {config.enable_gifts && (
          <div style={sectionStyle}>
            <label className="row" style={{ gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} />
              <span className="drawer__title">{t("giftOrder")}</span>
            </label>
            {isGift && (
              <div className="stack" style={{ gap: 14, marginTop: 16 }}>
                <Field label={t("giftRecipientName")} value={gift.name} onChange={(v) => setGift({ ...gift, name: v })} />
                <Field label={t("giftRecipientNumber")} value={gift.number} onChange={(v) => setGift({ ...gift, number: v })} />
                {config.enable_gifts_message_form && (
                  <div className="field">
                    <label>{t("giftMessage")}</label>
                    <textarea
                      className="textarea"
                      maxLength={config.gift_message_character_limit || undefined}
                      value={gift.message}
                      onChange={(e) => setGift({ ...gift, message: e.target.value })}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Payment */}
        {availablePayments.length > 0 && (
          <div style={sectionStyle}>
            <span className="label" style={{ marginBottom: 12, display: "block" }}>
              {t("paymentMethod")}
            </span>
            <div className="stack" style={{ gap: 10 }}>
              {availablePayments.map((p) => (
                <label key={p.value} className="opt-row" style={{ cursor: "pointer" }}>
                  <span>{tx(p.label, p.ar_label)}</span>
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === p.value}
                    onChange={() => setPayment(p.value)}
                  />
                </label>
              ))}
            </div>
            {fieldErrors.payment && <span className="field-error">{fieldErrors.payment}</span>}
          </div>
        )}
      </div>

      {/* Summary */}
      <aside className="checkout-summary" style={{ ...sectionStyle, position: "sticky", top: 90 }}>
        <h3 style={{ fontSize: 22, marginBottom: 16 }}>{t("orderSummary")}</h3>
        <div className="stack" style={{ gap: 8, maxHeight: 220, overflowY: "auto", marginBottom: 14 }}>
          {lines.map((l) => (
            <div key={l.lineId} className="spread" style={{ fontSize: 14 }}>
              <span style={{ minWidth: 0 }}>
                {l.quantity}× {tx(l.name, l.ar_name)}
              </span>
            </div>
          ))}
        </div>

        {/* Coupon */}
        <div className="field" style={{ marginBottom: 14 }}>
          <label>{t("couponCode")}</label>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
            <button className="btn btn-sm btn-outline" onClick={applyCoupon} type="button">
              {t("applyCoupon")}
            </button>
          </div>
          {couponMsg && (
            <span className={appliedCoupon ? "help" : "field-error"} style={appliedCoupon ? { color: "var(--success)" } : undefined}>
              {couponMsg}
            </span>
          )}
        </div>

        {/* Wallet / points */}
        {me && config.enable_wallet && config.enable_wallet_staff && wallet > 0 && (
          <label className="row" style={{ gap: 10, marginBottom: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} />
            <span>{t("useWallet")} ({formatMoney(wallet, currency, locale)})</span>
          </label>
        )}
        {me && config.enable_loyalty_points_payment && (me.points ?? 0) > 0 && (
          <label className="row" style={{ gap: 10, marginBottom: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} />
            <span>{t("usePoints")} ({me.points})</span>
          </label>
        )}

        <hr className="divider" style={{ margin: "14px 0" }} />
        <SummaryRow label={t("subtotal")} value={formatMoney(subtotal, currency, locale)} />
        {isDelivery && <SummaryRow label={t("delivery")} value={formatMoney(deliveryRate, currency, locale)} />}
        {discount > 0 && <SummaryRow label={t("discount")} value={`− ${formatMoney(discount, currency, locale)}`} accent />}
        {vat > 0 && <SummaryRow label={t("vat")} value={formatMoney(vat, currency, locale)} />}
        {walletApplied > 0 && <SummaryRow label={t("wallet")} value={`− ${formatMoney(walletApplied, currency, locale)}`} accent />}
        <hr className="divider" style={{ margin: "14px 0" }} />
        <div className="spread" style={{ marginBottom: 18 }}>
          <strong>{t("total")}</strong>
          <strong style={{ fontSize: 20 }}>{formatMoney(total, currency, locale)}</strong>
        </div>

        {/* Agreements */}
        {agreements.map((a) => (
          <label key={a.title} className="row" style={{ gap: 10, marginBottom: 10, cursor: "pointer", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={!!agreed[a.title]}
              onChange={(e) => setAgreed({ ...agreed, [a.title]: e.target.checked })}
            />
            <span>
              {a.custom_text ? tx(a.custom_text, a.custom_text_ar) : tx(a.title, a.title_ar)}
            </span>
          </label>
        ))}

        {error && <p className="notice notice-error" style={{ marginBottom: 12 }}>{error}</p>}

        <button
          className="btn btn-lg btn-block"
          disabled={submitting || belowAreaMin || (hydrated && lines.length === 0)}
          onClick={placeOrder}
        >
          {submitting ? <span className="spinner" /> : `${t("placeOrder")} · ${formatMoney(total, currency, locale)}`}
        </button>
      </aside>

      <style>{checkoutCss}</style>
    </div>
  );
}

function Field({
  label, value, onChange, err,
}: { label: string; value: string; onChange: (v: string) => void; err?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
      {err && <span className="field-error">{err}</span>}
    </div>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="spread" style={{ marginBottom: 8, fontSize: 14 }}>
      <span className="muted">{label}</span>
      <span style={accent ? { color: "var(--discount)" } : undefined}>{value}</span>
    </div>
  );
}

const checkoutCss = `
@media(min-width:900px){.checkout-grid{grid-template-columns:1fr 360px}}
.seg{display:inline-flex;border:1px solid var(--line-strong);border-radius:var(--radius-xs);overflow:hidden}
.seg__btn{padding:11px 26px;background:var(--surface);border:none;font-family:var(--font-sans);font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink)}
.seg__btn--on{background:var(--ink);color:#fff}
.addr-grid{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:520px){.addr-grid{grid-template-columns:1fr 1fr}}
.slot-wrap{display:flex;flex-wrap:wrap;gap:10px}
.slot{display:flex;flex-direction:column;gap:2px;align-items:flex-start;padding:12px 16px;border:1px solid var(--line-strong);background:var(--surface);border-radius:var(--radius-xs);font-size:13px;color:var(--ink);min-height:44px}
.slot--on{border-color:var(--ink);background:var(--ink);color:#fff}
.slot__day{font-family:var(--font-sans);font-size:10px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.8}
`;
