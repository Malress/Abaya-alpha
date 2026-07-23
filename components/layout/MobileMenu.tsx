"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useStore } from "@/components/providers/StoreProvider";
import { categorySlug } from "@/lib/slug";
import { IconClose } from "@/components/ui/icons";

export default function MobileMenu() {
  const { menuOpen, setMenuOpen, categories, config, locale, setLocale, tx, t } =
    useStore();

  useEffect(() => {
    if (!menuOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, setMenuOpen]);

  if (!menuOpen) return null;

  const topCats = categories
    .filter((c) => !c.is_child)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <>
      <div className="scrim" onClick={() => setMenuOpen(false)} />
      <aside
        className="drawer drawer-start"
        role="dialog"
        aria-modal="true"
        aria-label={t("menu")}
      >
        <div className="drawer__head">
          <span className="drawer__title">{tx(config.name, config.ar_name)}</span>
          <button
            className="iconbtn"
            aria-label={t("backToShop")}
            onClick={() => setMenuOpen(false)}
          >
            <IconClose />
          </button>
        </div>
        <div className="drawer__body">
          <nav className="stack" style={{ gap: 4 }}>
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              style={menuLink}
            >
              {t("home")}
            </Link>
            {topCats.map((c) => (
              <Link
                key={c.id}
                href={`/category/${categorySlug(c)}`}
                onClick={() => setMenuOpen(false)}
                style={menuLink}
              >
                {tx(c.name, c.ar_name)}
              </Link>
            ))}
            <Link href="/track" onClick={() => setMenuOpen(false)} style={menuLink}>
              {t("trackOrder")}
            </Link>
            <Link href="/account" onClick={() => setMenuOpen(false)} style={menuLink}>
              {t("account")}
            </Link>
          </nav>
        </div>
        <div className="drawer__foot">
          <button
            className="btn btn-outline btn-block"
            onClick={() => {
              setLocale(locale === "ar" ? "en" : "ar");
              setMenuOpen(false);
            }}
          >
            {t("language")}
          </button>
        </div>
      </aside>
    </>
  );
}

const menuLink: React.CSSProperties = {
  padding: "14px 4px",
  borderBottom: "1px solid var(--line)",
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};
