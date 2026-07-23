"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/components/providers/StoreProvider";
import { IconCheck, IconClose } from "@/components/ui/icons";

function ReturnInner() {
  const { t, locale } = useStore();
  const params = useSearchParams();
  const status = params.get("status");
  const trackingId = params.get("tracking_id");
  const success = status === "success";

  return (
    <div className="container container-narrow section center" style={{ minHeight: "60vh" }}>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          margin: "0 auto 24px",
          background: success ? "var(--sand-soft)" : "#f8ebe8",
          color: success ? "var(--success)" : "var(--error)",
        }}
      >
        {success ? <IconCheck width={34} height={34} /> : <IconClose width={34} height={34} />}
      </div>
      <h1 className="section-title" style={{ marginBottom: 12 }}>
        {success ? t("orderConfirmed") : t("paymentFailed")}
      </h1>
      <p className="muted" style={{ marginBottom: 26 }}>
        {success
          ? t("orderConfirmedHint")
          : locale === "ar"
            ? "لم يكتمل الدفع. يمكنك المحاولة مرة أخرى."
            : "Your payment did not go through. You can try again."}
      </p>

      {success && trackingId && (
        <p className="pill" style={{ margin: "0 auto 26px" }} dir="ltr">
          {t("trackingId")}: {trackingId}
        </p>
      )}

      <div className="row" style={{ gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        {success ? (
          <>
            {trackingId && (
              <Link href={`/track?tracking_id=${trackingId}`} className="btn">
                {t("trackOrder")}
              </Link>
            )}
            <Link href="/" className="btn btn-outline">
              {t("continueShopping")}
            </Link>
          </>
        ) : (
          <>
            <Link href="/checkout" className="btn">
              {t("tryAgain")}
            </Link>
            <Link href="/" className="btn btn-outline">
              {t("continueShopping")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function OrderReturnPage() {
  return (
    <Suspense fallback={<div className="container center" style={{ padding: 100 }}><span className="spinner" /></div>}>
      <ReturnInner />
    </Suspense>
  );
}
