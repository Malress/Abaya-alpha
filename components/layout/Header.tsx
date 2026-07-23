"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/components/providers/StoreProvider";
import { useCart } from "@/components/providers/CartProvider";
import { categorySlug } from "@/lib/slug";
import {
  IconBag,
  IconMenu,
  IconSearch,
  IconUser,
  IconTruck,
  IconChevronDown,
} from "@/components/ui/icons";

export default function Header() {
  const {
    config,
    categories,
    locale,
    setLocale,
    tx,
    t,
    setSearchOpen,
    setMenuOpen,
    branches,
  } = useStore();
  const { count } = useCart();
  const pathname = usePathname();

  const wordmark = tx(config.name, config.ar_name) || "Store";
  const topCats = categories
    .filter((c) => !c.is_child)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .slice(0, 7);

  return (
    <header className="header">
      <div className="header__bar" style={{ paddingInline: "clamp(16px, 3vw, 24px)" }}>
          <div className="header__left">
            <button
              className="nav-action"
              style={{ display: "none" }}
              data-mobile-menu
              onClick={() => setMenuOpen(true)}
            >
              <IconMenu />
              <span>{t("menu")}</span>
            </button>
            
            <div className="desktop-nav" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Link href="/shop" className="nav-action">
                <span>{tx("Shop All", "تسوق الكل")}</span>
              </Link>

              <div className="nav-dropdown">
                <button className="nav-action" style={{ cursor: "pointer" }}>
                  <span>{tx("Categories", "الفئات")}</span>
                  <IconChevronDown width={14} height={14} />
                </button>
                <div className="nav-dropdown-content">
                  {topCats.map((c, i) => (
                    <Link key={`${c.id}-${i}`} href={`/category/${categorySlug(c)}`} className="nav-dropdown-item">
                      {tx(c.name, c.ar_name)}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="nav-dropdown">
                <button className="nav-action" style={{ cursor: "pointer" }}>
                  <span>{tx("Contact Us", "اتصل بنا")}</span>
                  <IconChevronDown width={14} height={14} />
                </button>
                <div className="nav-dropdown-content">
                  {branches?.[0] && (
                    <div className="nav-dropdown-item" style={{ pointerEvents: "none", opacity: 0.6 }}>
                      {tx(branches[0].name, branches[0].ar_name)}
                      {branches[0].area ? `, ${branches[0].area}` : ""}
                    </div>
                  )}
                  {config.contact_number && (
                    <a href={`tel:${config.contact_number}`} className="nav-dropdown-item">
                      {config.contact_number}
                    </a>
                  )}
                  {config.email && (
                    <a href={`mailto:${config.email}`} className="nav-dropdown-item">
                      {config.email}
                    </a>
                  )}
                  {config.instagram_link && (
                    <a href={config.instagram_link} target="_blank" className="nav-dropdown-item" rel="noreferrer">
                      Instagram
                    </a>
                  )}
                  {config.whatsapp_link && (
                    <a href={config.whatsapp_link} target="_blank" className="nav-dropdown-item" rel="noreferrer">
                      WhatsApp
                    </a>
                  )}
                  {config.tiktok_link && (
                    <a href={config.tiktok_link} target="_blank" className="nav-dropdown-item" rel="noreferrer">
                      TikTok
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Link href="/" className="header__wordmark">
            {wordmark}
          </Link>

          <div className="header__right">
            <button
              className="nav-action desktop-nav"
              onClick={() => setSearchOpen(true)}
            >
              <IconSearch />
              <span>{t("search")}</span>
            </button>
            <button
              className="nav-action"
              style={{ display: "none" }}
              data-mobile-search
              onClick={() => setSearchOpen(true)}
            >
              <IconSearch />
            </button>
            <button
              className="langbtn"
              onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
              aria-label="Toggle language"
            >
              {t("language")}
            </button>
            <Link href="/track" className="nav-action desktop-nav">
              <IconTruck />
              <span>{t("trackOrder")}</span>
            </Link>
            <Link href="/account" className="nav-action">
              <IconUser />
              <span className="desktop-nav">{t("account")}</span>
            </Link>
            <Link href="/cart" className="nav-action" style={{ position: "relative" }}>
              <IconBag />
              <span className="desktop-nav">{t("cart")}</span>
              {count > 0 && <span className="count" style={{ position: "absolute", top: -2, right: 0, background: "var(--discount)", color: "#fff", borderRadius: 99, padding: "2px 6px", fontSize: 10, fontWeight: "bold" }}>{count}</span>}
            </Link>
          </div>
        </div>
      <style>{`
        @media (max-width: 899px) { 
          [data-mobile-menu], [data-mobile-search] { display: flex !important; } 
          .desktop-nav { display: none !important; }
        }
      `}</style>
    </header>
  );
}
