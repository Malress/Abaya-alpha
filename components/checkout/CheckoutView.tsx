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
  branches,
  areas,
  payments,
  promotions,
  countries,
  agreements,
}: {
  branches: Branch[];
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

  const [areaId, setAreaId] = useState<number | null>(null);

  const activeBranch = useMemo(() => {
    if (areaId) {
      const area = areas.find(a => a.id === areaId);
      if (area?.branch_id) {
        return branches.find(b => b.id === area.branch_id) || branches[0];
      }
    }
    return branches[0];
  }, [areaId, areas, branches]);

  const canDelivery = activeBranch?.enable_delivery ?? true;
  const canPickup = activeBranch?.enable_pickup ?? false;
  const [isDelivery, setIsDelivery] = useState(true);

  // Address fields
  const [block, setBlock] = useState("");
  const [street, setStreet] = useState("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");
  const [additional, setAdditional] = useState("");
  const [paci, setPaci] = useState("");
  const [nationalAddressCode, setNationalAddressCode] = useState("");
  const [zone, setZone] = useState("");
  const [avenue, setAvenue] = useState("");

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

  // Gift fields
  const [isGift, setIsGift] = useState(false);
  const [giftName, setGiftName] = useState("");
  const [giftNumber, setGiftNumber] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [giftLink, setGiftLink] = useState("");
  const [sendGiftAnonymously, setSendGiftAnonymously] = useState(false);
  const [unknownGiftLocation, setUnknownGiftLocation] = useState(false);

  const [agreed, setAgreed] = useState<Record<string, boolean>>({});
  const [dry, setDry] = useState<{ delivery: number; discount: number; vat: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const activeCountries = useMemo(() => {
    const map = new Map<string, { id: string; name: string; ar_name?: string }>();
    for (const a of areas) {
      if (a.country?.name && !map.has(a.country.name)) {
        map.set(a.country.name, {
          id: a.country.name,
          name: a.country.name,
          ar_name: a.country.ar_name,
        });
      }
    }
    if (map.size === 0 && countries.length > 0) {
      for (const c of countries) {
        if (c.name && !map.has(c.name)) {
          map.set(c.name, { id: c.name, name: c.name, ar_name: c.ar_name });
        }
      }
    }
    return Array.from(map.values());
  }, [areas, countries]);

  const [selectedCountry, setSelectedCountry] = useState<string>(
    () => activeCountries[0]?.id || countries[0]?.name || "Kuwait"
  );

  const selectedCountryObj = useMemo(() => {
    return (
      countries.find((c) => c.name === selectedCountry || c.ar_name === selectedCountry) ||
      countries[0]
    );
  }, [countries, selectedCountry]);

  const [selectedPhoneCountry, setSelectedPhoneCountry] = useState<string>(
    () => countries[0]?.name || "Kuwait"
  );

  const phoneCountryObj = useMemo(() => {
    return (
      countries.find((c) => c.name === selectedPhoneCountry || c.ar_name === selectedPhoneCountry) ||
      countries[0]
    );
  }, [countries, selectedPhoneCountry]);

  const dialCode = phoneCountryObj?.dial_code || countries[0]?.dial_code;

  const [selectedGiftPhoneCountry, setSelectedGiftPhoneCountry] = useState<string>(
    () => countries[0]?.name || "Kuwait"
  );

  const giftPhoneCountryObj = useMemo(() => {
    return (
      countries.find((c) => c.name === selectedGiftPhoneCountry || c.ar_name === selectedGiftPhoneCountry) ||
      countries[0]
    );
  }, [countries, selectedGiftPhoneCountry]);

  const giftDialCode = giftPhoneCountryObj?.dial_code || countries[0]?.dial_code;

  const cName = selectedCountryObj?.name || "";
  const isKuwait = cName === "Kuwait";
  const isKSA = cName === "Saudi Arabia";
  const isQatar = cName === "Qatar";
  const isUAE = cName === "United Arab Emirates" || cName === "UAE";
  const isBahrain = cName === "Bahrain";
  const isOman = cName === "Oman";

  const filteredAreas = useMemo(() => {
    if (activeCountries.length <= 1) return areas;
    return areas.filter((a) => a.country?.name === selectedCountry || !a.country?.name);
  }, [areas, activeCountries, selectedCountry]);

  const groupedAreas = useMemo(() => {
    const map = new Map<string, Area[]>();
    for (const a of filteredAreas) {
      const pName = tx(a.province?.name, a.province?.ar_name) || tx("All Areas", "جميع المناطق");
      if (!map.has(pName)) map.set(pName, []);
      map.get(pName)!.push(a);
    }
    const res: { province: string; areas: Area[] }[] = [];
    map.forEach((areasList, province) => {
      res.push({ province, areas: areasList });
    });
    return res;
  }, [filteredAreas, tx]);

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

  const fulfillment = useMemo(() => {
    if (!activeBranch) return { asap: { available: false }, days: [] };
    const area = areas.find((a) => a.id === areaId);
    return computeFulfillment(activeBranch, isDelivery, locale, 14, area?.delivery_minutes);
  }, [activeBranch, isDelivery, locale, areaId, areas]);

  // Preselect single payment method.
  const availablePayments = useMemo(() => {
    let list = [...payments];
    if (activeBranch?.disable_cash) list = list.filter((p) => p.value !== "cash" && p.value !== "kod");
    if (isGift && config.disable_cash_for_gift) {
      list = list.filter((p) => p.value !== "cash" && p.value !== "kod");
    }
    return list;
  }, [payments, activeBranch, isGift, config.disable_cash_for_gift]);

  useEffect(() => {
    if (availablePayments.length === 1) setPayment(availablePayments[0].value);
    else if (payment && !availablePayments.some((p) => p.value === payment)) setPayment("");
  }, [availablePayments, payment]);

  useEffect(() => {
    if (!timing) {
      if (fulfillment.asap.available) {
        setTiming({ kind: "asap" });
      } else if (fulfillment.days.length > 0 && fulfillment.days[0].slots.length > 0) {
        const firstDay = fulfillment.days[0];
        const firstSlot = firstDay.slots[0];
        setTiming({ kind: "slot", date: firstDay.date, start: firstSlot.start, end: firstSlot.end });
      }
    }
  }, [fulfillment, timing]);

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
        channel: "web",
        branch_id: activeBranch?.id,
        is_delivery: isDelivery,
        fulfillment_date: timing?.kind === "slot" ? timing.date : fulfillment.asap.date,
        fulfillment_slot_start: timing?.kind === "slot" ? timing.start : fulfillment.asap.start,
        fulfillment_slot_end: timing?.kind === "slot" ? timing.end : fulfillment.asap.end,
        customer: { name, phone: dialCode && phone && !phone.startsWith("+") ? dialCode + phone : phone, email },
        delivery_address: isDelivery
          ? {
              area_id: areaId,
              block: isQatar ? (zone || "-") : (isUAE ? "-" : (block || "-")),
              street: street || "-",
              building: building || "-",
              floor: floor,
              apartment: apartment,
              additional: additional,
              ...(isKuwait && paci ? { paci } : {}),
              ...(isKSA && nationalAddressCode
                ? {
                    paci: nationalAddressCode,
                    national_address_code: nationalAddressCode,
                  }
                : {}),
              ...(isQatar && zone ? { zone } : {}),
              ...((isKuwait || isBahrain || isOman) && avenue ? { avenue } : {})
            }
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
        ...(isGift && config.enable_gifts ? {
          is_gift: true,
          gift_recipient_name: giftName || undefined,
          gift_recipient_number: giftNumber ? `${giftDialCode}${giftNumber}` : undefined,
          ...(config.enable_gifts_message_form && giftMessage ? { gift_message: giftMessage } : {}),
          ...(config.enable_gift_links && giftLink ? { gift_link: giftLink } : {}),
          ...(config.enable_send_gift_anonymously ? { send_gift_anonymously: sendGiftAnonymously } : {}),
          ...(config.enable_unknown_gift_recipient_location ? { unknown_gift_recipient_location: unknownGiftLocation } : {})
        } : {}),
        dry_run: dryRun,
      };
    },
    [activeBranch, isDelivery, timing, fulfillment, name, phone, email, dialCode, areaId, block, street, building, floor, apartment, additional, paci, nationalAddressCode, zone, avenue, isKuwait, isKSA, isQatar, isUAE, isBahrain, isOman, lines, payment, locale, appliedCoupon, promotions, me, useWallet, usePoints, isGift, config, giftName, giftNumber, giftMessage, giftLink, sendGiftAnonymously, unknownGiftLocation],
  );

  // Dry-run validation whenever the money-affecting inputs change.
  const dryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated || lines.length === 0 || !activeBranch) return;
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
    if (isDelivery) {
      if (!areaId) errs.area = t("required");
      if (isQatar) {
        if (!zone.trim()) errs.zone = t("required");
        if (!street.trim()) errs.street = t("required");
      } else if (isKSA) {
        if (!nationalAddressCode.trim()) errs.nationalAddressCode = t("required");
        if (!block.trim()) errs.block = t("required");
        if (!street.trim()) errs.street = t("required");
      } else {
        if (!isUAE && !block.trim()) errs.block = t("required");
        if (!street.trim()) errs.street = t("required");
      }
    }
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
    borderRadius: "var(--radius-lg)",
    padding: "24px",
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)",
  };

  const hideAddress = isGift && unknownGiftLocation;

  return (
    <div className="checkout-grid" style={{ display: "grid", gap: 28, alignItems: "start" }}>
      <div className="stack" style={{ gap: 28 }}>
        {/* Sign in */}
        {!me && (
          <div className="checkout-sections-container">
            <div className="spread">
              <span className="section-title" style={{ margin: 0 }}>{t("signInToCheckout")}</span>
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
          <div className="checkout-sections-container">
            <span className="muted">
              {locale === "ar" ? "مرحباً" : "Signed in as"} <strong>{me.name || me.email}</strong>
            </span>
          </div>
        )}

        {/* Gift */}
        {config.enable_gifts && (
          <div className="checkout-sections-container">
            <label className="row" style={{ gap: 10, cursor: "pointer", paddingBottom: isGift ? 16 : 0, borderBottom: isGift ? "1px solid var(--line)" : "none" }}>
              <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} />
              <span className="section-title" style={{ margin: 0 }}>{t("giftOrder")}</span>
            </label>
            {isGift && (
              <div className="stack" style={{ gap: 14, paddingTop: 16 }}>
                <div className="addr-grid">
                  <Field label={t("giftRecipientName")} value={giftName} onChange={setGiftName} req={config.enable_force_gift_name_number} />
                  <div className="field">
                    <label>{t("giftRecipientNumber")}{config.enable_force_gift_name_number && <span className="req">*</span>}</label>
                    <div className="row" style={{ gap: 8 }}>
                    <select
                      dir="ltr"
                      className="select"
                      value={selectedGiftPhoneCountry}
                      onChange={(e) => setSelectedGiftPhoneCountry(e.target.value)}
                      style={{ width: "auto", minWidth: 90, fontWeight: 700, paddingInlineEnd: 8 }}
                    >
                      {countries.map((c) => (
                        <option key={c.name} value={c.name}>{c.alpha_2_code || c.name} {c.dial_code}</option>
                      ))}
                    </select>
                    <input className="input" dir="ltr" value={giftNumber} onChange={(e) => setGiftNumber(e.target.value)} inputMode="tel" />
                  </div>
                  </div>
                </div>
                {config.enable_gifts_message_form && (
                  <div className="field">
                    <label>{t("giftMessage")}</label>
                    <textarea
                      className="textarea"
                      maxLength={config.gift_message_character_limit || undefined}
                      value={giftMessage}
                      onChange={(e) => setGiftMessage(e.target.value)}
                    />
                  </div>
                )}
                {config.enable_gift_links && (
                  <Field label={tx("Gift Link", "رابط الهدية")} value={giftLink} onChange={setGiftLink} />
                )}
                {config.enable_send_gift_anonymously && (
                  <label className="row" style={{ gap: 10, cursor: "pointer", marginTop: 8 }}>
                    <input type="checkbox" checked={sendGiftAnonymously} onChange={(e) => setSendGiftAnonymously(e.target.checked)} />
                    <span>{tx("Send Gift Anonymously", "إرسال الهدية بشكل مجهول")}</span>
                  </label>
                )}
                {config.enable_unknown_gift_recipient_location && (
                  <label className="row" style={{ gap: 10, cursor: "pointer" }}>
                    <input type="checkbox" checked={unknownGiftLocation} onChange={(e) => setUnknownGiftLocation(e.target.checked)} />
                    <span>{tx("I don't know the recipient's address", "لا أعرف عنوان المستلم")}</span>
                  </label>
                )}
              </div>
            )}
          </div>
        )}

        <div className="checkout-sections-container">
          {/* Contact Details */}
          <div className="checkout-section" style={{ paddingTop: 0 }}>
          <span className="section-title">
            {isGift ? tx("Sender's Details", "بيانات المرسل") : t("contactDetails")}
          </span>
          <div className="addr-grid">
            <div className="field">
              <label>{t("fullName")}<span className="req">*</span></label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
            </div>
            <div className="field">
              <label>{t("phone")}<span className="req">*</span></label>
              <div className="row" style={{ gap: 8 }}>
                <select
                  dir="ltr"
                  className="select"
                  value={selectedPhoneCountry}
                  onChange={(e) => setSelectedPhoneCountry(e.target.value)}
                  style={{ width: "auto", minWidth: 90, fontWeight: 700, paddingInlineEnd: 8 }}
                >
                  {countries.map((c) => (
                    <option key={c.name} value={c.name}>{c.alpha_2_code || c.name} {c.dial_code}</option>
                  ))}
                </select>
                <input className="input" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
              </div>
              {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
            </div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>{t("email")}</label>
            <input className="input" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
          </div>
        </div>

        {/* Fulfillment mode */}
        {!hideAddress && (canDelivery || canPickup) && (
          <div className="checkout-section">
            <span className="section-title">{t("deliveryMethod")}</span>
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

        {/* Address / Branch */}
        {!hideAddress && isDelivery && (
          <div className="checkout-section">
            <span className="section-title">{t("address")}</span>
            
            {activeCountries.length > 1 && (
              <div className="field" style={{ marginBottom: 14 }}>
                <label>{tx("Country", "الدولة")}<span className="req">*</span></label>
                <div className="country-chips">
                  {activeCountries.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`country-chip ${selectedCountry === c.id ? "country-chip--on" : ""}`}
                      onClick={() => {
                        setSelectedCountry(c.id);
                        setAreaId(null);
                      }}
                    >
                      {tx(c.name, c.ar_name)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="field" style={{ marginBottom: 14 }}>
              <label>{t("area")}<span className="req">*</span></label>
              <div style={{ position: "relative" }}>
                <select
                  className="select"
                  style={{ appearance: "none", paddingInlineEnd: 34 }}
                  value={areaId ?? ""}
                  onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">{t("selectArea")}</option>
                  {groupedAreas.map((g) => (
                    <optgroup key={g.province} label={g.province}>
                      {g.areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {tx(a.name, a.ar_name)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <IconChevronDown width={16} height={16} style={{ position: "absolute", insetInlineEnd: 10, top: 14, pointerEvents: "none" }} />
              </div>
              {fieldErrors.area && <span className="field-error">{fieldErrors.area}</span>}
            </div>

            {/* Regional Address Grid */}
            {isKSA ? (
              <div className="addr-grid">
                <Field label={tx("National Address Code", "الرمز البريدي")} value={nationalAddressCode} onChange={setNationalAddressCode} err={fieldErrors.nationalAddressCode} req />
                <Field label={t("block")} value={block} onChange={setBlock} err={fieldErrors.block} req />
              </div>
            ) : (
              <div className="addr-grid">
                {isQatar ? (
                  <Field label={tx("Zone", "المنطقة")} value={zone} onChange={setZone} err={fieldErrors.zone} req />
                ) : !isUAE ? (
                  <Field label={t("block")} value={block} onChange={setBlock} err={fieldErrors.block} req />
                ) : null}
                <Field label={t("street")} value={street} onChange={setStreet} err={fieldErrors.street} req />
              </div>
            )}
            
            {isKSA && (
              <div style={{ marginTop: 14 }}>
                <Field label={t("street")} value={street} onChange={setStreet} err={fieldErrors.street} req />
              </div>
            )}

            {!isKSA && (isKuwait || isBahrain || isOman) && (
              <div className="addr-grid" style={{ marginTop: 14 }}>
                <Field label={tx("Avenue (Optional)", "جادة (اختياري)")} value={avenue} onChange={setAvenue} />
                {isKuwait && (
                  <Field label={tx("PACI", "الرقم الآلي")} value={paci} onChange={setPaci} />
                )}
              </div>
            )}

            <div className="addr-grid" style={{ marginTop: 14 }}>
              <Field label={t("building")} value={building} onChange={setBuilding} />
              <Field label={t("floor")} value={floor} onChange={setFloor} />
              <Field label={t("apartment")} value={apartment} onChange={setApartment} />
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <label>{t("additionalDirections")}</label>
              <input className="input" value={additional} onChange={(e) => setAdditional(e.target.value)} />
            </div>

            {belowAreaMin && (
              <p className="notice notice-error" style={{ marginTop: 12 }}>
                {t("minimumOrder")}: {formatMoney(areaMin, currency, locale)}
              </p>
            )}
          </div>
        )}

        {/* Pickup Form */}
        {!hideAddress && !isDelivery && canPickup && (
          <div className="checkout-section">
            <span className="section-title">{t("pickupStore")}</span>
            {activeBranch ? (
              <div className="field">
                <div style={{ padding: 12, background: "var(--bg)", borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>
                  <div style={{ fontWeight: "bold" }}>{tx(activeBranch.name, activeBranch.ar_name)}</div>
                  {(activeBranch as any).address && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{(activeBranch as any).address}</div>}
                </div>
              </div>
            ) : (
              <div className="field-error">{t("noPickup")}</div>
            )}
            
            <div className="field" style={{ marginTop: 14 }}>
              <label>{t("vehicleDetails")}</label>
              <input className="input" placeholder={locale === "ar" ? "نوع السيارة، لونها، أو رقم اللوحة (اختياري)" : "Car type, color, or plate number (optional)"} value={additional} onChange={(e) => setAdditional(e.target.value)} />
            </div>
          </div>
        )}

      </div>
      </div>

      {/* Summary */}
      <aside className="checkout-summary" style={{ ...sectionStyle, position: "sticky", top: 130 }}>
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

        {/* When – in summary */}
        <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--line)" }}>
          <div className="spread">
            <div className="stack" style={{ gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.55 }}>{t("when")}</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>
                {timing?.kind === "asap"
                  ? (fulfillment.asap.label || (locale === "ar" ? "في أقرب وقت" : "ASAP"))
                  : timing?.kind === "slot"
                  ? (() => {
                      const dayLabel = fulfillment.days.find(d => d.date === timing.date)?.label || timing.date;
                      const slotLabel = fulfillment.days.find(d => d.date === timing.date)?.slots.find(s => s.start === timing.start)?.label || `${timing.start}–${timing.end}`;
                      return `${dayLabel}, ${slotLabel}`;
                    })()
                  : <span style={{ opacity: 0.4 }}>{locale === "ar" ? "غير محدد" : "Not selected"}</span>
                }
              </span>
            </div>
            {fulfillment.days.length > 0 && fulfillment.asap.available && (
              timing?.kind === "asap" ? (
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    const firstDay = fulfillment.days[0];
                    if (firstDay && firstDay.slots.length > 0) {
                      setTiming({ kind: "slot", date: firstDay.date, start: firstDay.slots[0].start, end: firstDay.slots[0].end });
                    }
                  }}
                  style={{ fontSize: 11, padding: "4px 12px", flexShrink: 0 }}
                >
                  {tx("Change", "تغيير")}
                </button>
              ) : timing?.kind === "slot" ? (
                <button
                  className="btn btn-sm btn-text"
                  onClick={() => setTiming({ kind: "asap" })}
                  style={{ fontSize: 11, textDecoration: "underline", flexShrink: 0 }}
                >
                  {tx("Cancel", "إلغاء")}
                </button>
              ) : null
            )}
          </div>

          {timing?.kind === "slot" && (
            <div className="addr-grid" style={{ marginTop: 10 }}>
              <div className="field">
                <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.6 }}>{tx("Date", "التاريخ")}</label>
                <div style={{ position: "relative" }}>
                  <select
                    className="select"
                    style={{ appearance: "none", paddingInlineEnd: 34 }}
                    value={timing.date}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      const dayObj = fulfillment.days.find(d => d.date === newDate);
                      if (dayObj && dayObj.slots.length > 0) {
                        setTiming({ kind: "slot", date: newDate, start: dayObj.slots[0].start, end: dayObj.slots[0].end });
                      } else {
                        setTiming({ kind: "slot", date: newDate, start: "", end: "" });
                      }
                    }}
                  >
                    <option value="" disabled>{tx("Select Date", "اختر التاريخ")}</option>
                    {fulfillment.days.map((d) => (
                      <option key={d.date} value={d.date}>{d.label}</option>
                    ))}
                  </select>
                  <IconChevronDown width={16} height={16} style={{ position: "absolute", insetInlineEnd: 10, top: 14, pointerEvents: "none" }} />
                </div>
              </div>
              <div className="field">
                <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.6 }}>{tx("Time", "الوقت")}</label>
                <div style={{ position: "relative" }}>
                  <select
                    className="select"
                    style={{ appearance: "none", paddingInlineEnd: 34 }}
                    value={`${timing.start}|${timing.end}`}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && val !== "|") {
                        const [start, end] = val.split("|");
                        setTiming({ kind: "slot", date: timing.date, start, end });
                      }
                    }}
                    disabled={!timing.date}
                  >
                    <option value="|" disabled>{tx("Select Time", "اختر الوقت")}</option>
                    {fulfillment.days.find(d => d.date === timing.date)?.slots.map(s => (
                      <option key={`${s.start}-${s.end}`} value={`${s.start}|${s.end}`}>{s.label}</option>
                    ))}
                  </select>
                  <IconChevronDown width={16} height={16} style={{ position: "absolute", insetInlineEnd: 10, top: 14, pointerEvents: "none" }} />
                </div>
              </div>
            </div>
          )}

          {!timing && (
            <div style={{ position: "relative", marginTop: 8 }}>
              <select
                className="select"
                style={{ appearance: "none", paddingInlineEnd: 34 }}
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "asap") setTiming({ kind: "asap" });
                  else if (val === "schedule_trigger") {
                    const firstDay = fulfillment.days[0];
                    if (firstDay && firstDay.slots.length > 0) {
                      setTiming({ kind: "slot", date: firstDay.date, start: firstDay.slots[0].start, end: firstDay.slots[0].end });
                    }
                  }
                }}
              >
                <option value="" disabled>{locale === "ar" ? "اختر موعد التسليم" : "Select delivery time / schedule"}</option>
                {fulfillment.asap.available && <option value="asap">{fulfillment.asap.label || (locale === "ar" ? "في أقرب وقت" : "ASAP")}</option>}
                {fulfillment.days.length > 0 && <option value="schedule_trigger">{tx("Schedule for later", "جدولة لوقت لاحق")}</option>}
              </select>
              <IconChevronDown width={16} height={16} style={{ position: "absolute", insetInlineEnd: 10, top: 14, pointerEvents: "none" }} />
            </div>
          )}
          {fieldErrors.timing && <span className="field-error" style={{ marginTop: 4 }}>{fieldErrors.timing}</span>}
        </div>

        {/* Payment – in summary */}
        {availablePayments.length > 0 && (
          <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.55, display: "block", marginBottom: 8 }}>{t("paymentMethod")}</span>
            <div className="stack" style={{ gap: 8 }}>
              {availablePayments.map((p) => (
                <label key={p.value} className="opt-row" style={{ cursor: "pointer" }}>
                  <span>{tx(p.label, p.ar_label)}</span>
                  <input type="radio" name="payment" checked={payment === p.value} onChange={() => setPayment(p.value)} />
                </label>
              ))}
            </div>
            {fieldErrors.payment && <span className="field-error" style={{ marginTop: 4 }}>{fieldErrors.payment}</span>}
          </div>
        )}
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
  label, value, onChange, err, req
}: { label: string; value: string; onChange: (v: string) => void; err?: string; req?: boolean }) {
  return (
    <div className="field">
      <label>{label}{req && <span className="req">*</span>}</label>
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
.checkout-sections-container {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: 16px 24px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
}
.checkout-section {
  padding-block: 24px;
  border-bottom: 1px solid var(--line);
}
.checkout-section:last-child {
  border-bottom: none;
  padding-bottom: 8px;
}
.section-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  display: block;
}
.req { color: var(--error); margin-inline-start: 4px; }
.country-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.country-chip {
  padding: 8px 16px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}
.country-chip--on {
  background: var(--brand);
  color: #fff;
  border-color: var(--brand);
}
.seg{display:inline-flex;border:1px solid var(--line-strong);border-radius:var(--radius-pill);overflow:hidden;padding:3px;background:var(--cream)}
.seg__btn{padding:10px 24px;background:transparent;border:none;border-radius:var(--radius-pill);font-family:var(--font-sans);font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink);cursor:pointer;transition:all 0.2s}
.seg__btn--on{background:var(--ink);color:#fff;box-shadow:0 4px 14px rgba(0,0,0,0.12)}
.addr-grid{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:520px){.addr-grid{grid-template-columns:1fr 1fr}}
.slot-wrap{display:flex;flex-wrap:wrap;gap:10px}
.slot{display:flex;flex-direction:column;gap:2px;align-items:flex-start;padding:12px 16px;border:1px solid var(--line-strong);background:var(--surface);border-radius:var(--radius-md);font-size:13px;color:var(--ink);min-height:44px;cursor:pointer;transition:all 0.2s}
.slot--on{border-color:var(--ink);background:var(--ink);color:#fff;box-shadow:0 4px 14px rgba(0,0,0,0.12)}
.slot__day{font-family:var(--font-sans);font-size:10px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.8}
.opt-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border:1px solid var(--line);border-radius:var(--radius-lg);background:var(--surface);transition:all 0.2s;box-shadow:0 4px 14px rgba(0,0,0,0.02)}
.opt-row:hover{border-color:var(--sand-deep)}
`;
