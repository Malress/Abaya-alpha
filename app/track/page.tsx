"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/components/providers/StoreProvider";
import { sfGet } from "@/lib/client-api";
import { unwrapOrder } from "@/lib/ordable/unwrap";
import { formatMoney } from "@/lib/format";

interface TrackedOrder {
  tracking_id?: string;
  status?: string;
  total?: number;
  delivery_rate?: number;
  discount_total?: number;
  currency?: { symbol?: string; decimals?: number };
  placed?: string;
  expected_delivery_date_time?: string;
  branch_name?: string;
  customer?: { name?: string };
  items?: { name?: string; quantity?: number }[];
}

const STATUS_STEPS = ["Received", "Preparing", "Out for Delivery", "Complete"];

function TrackInner() {
  const { locale, currency, t, tx } = useStore();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("tracking_id") ?? "");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(
    async (id: string) => {
      if (!id.trim()) return;
      setLoading(true);
      setError(null);
      setOrder(null);
      const res = await sfGet(`/order/?tracking_id=${encodeURIComponent(id.trim())}`);
      setLoading(false);
      if (!res.ok) {
        setError(res.message || (locale === "ar" ? "لم يتم العثور على الطلب" : "Order not found"));
        return;
      }
      const found = unwrapOrder<TrackedOrder>(res.raw);
      if (!found) {
        setError(locale === "ar" ? "لم يتم العثور على الطلب" : "Order not found");
        return;
      }
      setOrder(found);
    },
    [locale],
  );

  useEffect(() => {
    const id = params.get("tracking_id");
    if (id) lookup(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentStep = order ? STATUS_STEPS.indexOf(order.status ?? "") : -1;

  return (
    <div className="container container-narrow section-tight">
      <div className="section-head">
        <span className="eyebrow">{t("orderStatus")}</span>
        <h1 className="section-title">{t("trackOrder")}</h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup(code);
        }}
        className="row"
        style={{ gap: 10, maxWidth: 520, margin: "0 auto 30px" }}
      >
        <input
          className="input"
          dir="ltr"
          placeholder={t("trackingId")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="btn" disabled={loading}>
          {loading ? <span className="spinner" /> : t("trackOrder")}
        </button>
      </form>

      {error && <p className="notice notice-error" style={{ maxWidth: 520, margin: "0 auto" }}>{error}</p>}

      {order && (
        <div style={{ maxWidth: 620, margin: "0 auto", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-xs)", padding: 28 }}>
          <div className="spread" style={{ marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
            <span dir="ltr" style={{ fontFamily: "var(--font-sans)", letterSpacing: "0.06em" }}>
              #{order.tracking_id}
            </span>
            {order.status && <span className="pill">{order.status}</span>}
          </div>

          {currentStep >= 0 && (
            <div className="track-steps" style={{ marginBottom: 24 }}>
              {STATUS_STEPS.map((s, i) => (
                <div key={s} className={`track-step ${i <= currentStep ? "track-step--on" : ""}`}>
                  <span className="track-dot" />
                  <span className="track-label">{s}</span>
                </div>
              ))}
            </div>
          )}

          {order.items && order.items.length > 0 && (
            <div className="stack" style={{ gap: 8, marginBottom: 18 }}>
              {order.items.map((it, i) => (
                <div key={i} className="spread" style={{ fontSize: 14 }}>
                  <span>{it.quantity}× {it.name}</span>
                </div>
              ))}
            </div>
          )}

          {typeof order.total === "number" && (
            <div className="spread">
              <strong>{t("total")}</strong>
              <strong>{formatMoney(order.total, currency, locale)}</strong>
            </div>
          )}
          {order.branch_name && <p className="muted" style={{ marginTop: 12 }}>{tx(order.branch_name, undefined)}</p>}
        </div>
      )}

      <style>{`
        .track-steps{display:flex;justify-content:space-between;gap:6px}
        .track-step{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;text-align:center;position:relative}
        .track-step:not(:last-child)::after{content:"";position:absolute;top:7px;inset-inline-start:50%;width:100%;height:2px;background:var(--line)}
        .track-step--on:not(:last-child)::after{background:var(--ink)}
        .track-dot{width:14px;height:14px;border-radius:50%;background:var(--line);z-index:1}
        .track-step--on .track-dot{background:var(--ink)}
        .track-label{font-family:var(--font-sans);font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-secondary)}
        .track-step--on .track-label{color:var(--ink)}
      `}</style>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="container center" style={{ padding: 100 }}><span className="spinner" /></div>}>
      <TrackInner />
    </Suspense>
  );
}
