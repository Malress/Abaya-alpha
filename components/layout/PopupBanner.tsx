"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/components/providers/StoreProvider";
import { IconClose } from "@/components/ui/icons";

// Popup banner from config.popup_banner, gated on enable_popup_banner. Already
// time/channel-filtered server-side. Dismissal tracked by id in localStorage.
export default function PopupBanner() {
  const { config, locale, tx } = useStore();
  const [open, setOpen] = useState(false);
  const raw = config.popup_banner;
  const banner = Array.isArray(raw) ? raw[0] : raw;

  useEffect(() => {
    if (!config.enable_popup_banner || !banner) return;
    const key = `popup_dismissed_${banner.id}`;
    if (localStorage.getItem(key)) return;
    const timer = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(timer);
  }, [config.enable_popup_banner, banner]);

  useEffect(() => {
    if (!open || !banner?.autoclose || !banner.autoclose_timer) return;
    const t = setTimeout(() => dismiss(), banner.autoclose_timer * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const hasContent = Boolean(
    banner && (banner.image || banner.title || banner.title_ar || banner.content || banner.content_ar),
  );
  if (!config.enable_popup_banner || !banner || !hasContent || !open) return null;

  function dismiss() {
    if (banner) localStorage.setItem(`popup_dismissed_${banner.id}`, "1");
    setOpen(false);
  }

  const title = tx(banner.title, banner.title_ar);
  const content = tx(banner.content, banner.content_ar);

  return (
    <div className="scrim" style={{ display: "grid", placeItems: "center" }} onClick={dismiss}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || "Announcement"}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          maxWidth: 440,
          width: "92vw",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          position: "relative",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <button
          className="iconbtn"
          onClick={dismiss}
          aria-label="Close"
          style={{ position: "absolute", insetInlineEnd: 6, insetBlockStart: 6, zIndex: 2, color: "#fff" }}
        >
          <IconClose />
        </button>
        {banner.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner.image} alt="" style={{ width: "100%" }} />
        )}
        <div style={{ padding: 24, textAlign: "center" }}>
          {title && <h3 style={{ fontSize: 26, marginBottom: 10 }}>{title}</h3>}
          {content && (
            <div
              className="prose"
              style={{ textAlign: "center" }}
              // content is store-authored; sanitize before render
              dangerouslySetInnerHTML={{ __html: sanitizeClient(content) }}
            />
          )}
          {banner.redirect_link && (
            <a
              className="btn btn-block"
              style={{ marginTop: 18 }}
              href={banner.redirect_link}
              onClick={dismiss}
            >
              {locale === "ar" ? "تسوق الآن" : "Shop now"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// Minimal client-side tag stripper for banner HTML (defence in depth; the field is
// store-authored). Heavy sanitization happens server-side for product/page prose.
function sanitizeClient(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}
