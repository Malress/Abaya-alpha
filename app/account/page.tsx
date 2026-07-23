"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/providers/StoreProvider";
import { authAction, sfGet } from "@/lib/client-api";
import { formatMoney } from "@/lib/format";
import AuthPanel from "@/components/account/AuthPanel";

interface Me {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  points?: number;
  total_points?: number;
}
interface OrderRow {
  tracking_id?: string;
  status?: string;
  total?: number;
  placed?: string;
}

export default function AccountPage() {
  const { config, locale, currency, t, tx } = useStore();
  const [me, setMe] = useState<Me | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [wallet, setWallet] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const res = await authAction<{ authenticated?: boolean; data?: Me }>({ action: "me" });
    const data = res.raw as { authenticated?: boolean; data?: Me };
    if (data?.authenticated && data.data) {
      setMe(data.data);
      const [o, w] = await Promise.all([
        sfGet<OrderRow[]>("/orders/"),
        config.enable_wallet && config.enable_wallet_staff
          ? sfGet<{ balance?: number }>("/auth/wallet/")
          : Promise.resolve(null),
      ]);
      const list = (o.raw as { data?: OrderRow[] })?.data ?? (Array.isArray(o.data) ? o.data : []);
      setOrders(Array.isArray(list) ? list : []);
      if (w) {
        const b = (w.raw as { data?: { balance?: number } })?.data?.balance;
        if (typeof b === "number") setWallet(b);
      }
    } else {
      setMe(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await authAction({ action: "logout" });
    setMe(null);
    setOrders([]);
  }

  if (loading) {
    return (
      <div className="container center" style={{ padding: 100 }}>
        <span className="spinner" />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="container container-narrow section-tight">
        <div className="section-head">
          <span className="eyebrow">{tx(config.name, config.ar_name)}</span>
          <h1 className="section-title">{t("account")}</h1>
        </div>
        <div
          style={{
            maxWidth: 440,
            margin: "0 auto",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-xs)",
            padding: 28,
          }}
        >
          <AuthPanel onAuthed={refresh} />
        </div>
      </div>
    );
  }

  return (
    <div className="container container-narrow section-tight">
      <div className="spread" style={{ marginBottom: 30 }}>
        <div>
          <span className="eyebrow">{t("account")}</span>
          <h1 className="section-title" style={{ textAlign: "start", fontSize: "clamp(28px,4vw,42px)" }}>
            {me.name || me.email}
          </h1>
        </div>
        <button className="btn btn-sm btn-outline" onClick={signOut}>
          {t("signOut")}
        </button>
      </div>

      <div className="acct-cards" style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr", marginBottom: 30 }}>
        {config.enable_loyalty_points && (
          <div className="acct-stat">
            <span className="label">{t("points")}</span>
            <strong style={{ fontSize: 26 }}>{me.points ?? 0}</strong>
          </div>
        )}
        {wallet != null && (
          <div className="acct-stat">
            <span className="label">{t("wallet")}</span>
            <strong style={{ fontSize: 26 }}>{formatMoney(wallet, currency, locale)}</strong>
          </div>
        )}
      </div>

      <h2 style={{ fontSize: 24, marginBottom: 16 }}>{t("myOrders")}</h2>
      {orders.length === 0 ? (
        <div className="empty-state" style={{ padding: 40 }}>
          <p>{locale === "ar" ? "لا توجد طلبات بعد." : "No orders yet."}</p>
          <Link href="/" className="btn btn-outline btn-sm" style={{ marginTop: 14 }}>
            {t("continueShopping")}
          </Link>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {orders.map((o, i) => (
            <div key={o.tracking_id ?? i} className="spread" style={{ padding: 16, border: "1px solid var(--line)", borderRadius: "var(--radius-xs)", background: "var(--surface)", flexWrap: "wrap", gap: 10 }}>
              <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                <span dir="ltr" style={{ fontFamily: "var(--font-sans)", fontSize: 13 }}>
                  #{o.tracking_id}
                </span>
                {o.status && <span className="pill" style={{ alignSelf: "start" }}>{o.status}</span>}
              </div>
              <div className="row" style={{ gap: 14 }}>
                {typeof o.total === "number" && <strong>{formatMoney(o.total, currency, locale)}</strong>}
                {o.tracking_id && (
                  <Link href={`/track?tracking_id=${o.tracking_id}`} className="link-underline">
                    {t("trackOrder")}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @media(min-width:600px){.acct-cards{grid-template-columns:repeat(2,1fr)}}
        .acct-stat{display:flex;flex-direction:column;gap:8px;padding:22px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-xs)}
      `}</style>
    </div>
  );
}
