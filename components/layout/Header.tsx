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
} from "@/components/ui/icons";

export default function Header() {
  const {
    config,
    categories,
    locale,
    setLocale,
    tx,
    t,
    setCartOpen,
    setSearchOpen,
    setMenuOpen,
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
      <div className="container">
        <div className="header__bar">
          <div className="header__left">
            <button
              className="iconbtn"
              aria-label={t("search")}
              onClick={() => setSearchOpen(true)}
            >
              <IconSearch />
            </button>
            <button
              className="iconbtn"
              style={{ display: "none" }}
              data-mobile-menu
              aria-label={t("menu")}
              onClick={() => setMenuOpen(true)}
            >
              <IconMenu />
            </button>
          </div>

          <Link href="/" className="header__wordmark">
            {wordmark}
          </Link>

          <div className="header__right">
            <button
              className="langbtn"
              onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
              aria-label="Toggle language"
            >
              {t("language")}
            </button>
            <Link href="/account" className="iconbtn" aria-label={t("account")}>
              <IconUser />
            </Link>
            <button
              className="iconbtn"
              aria-label={`${t("cart")} (${count})`}
              onClick={() => setCartOpen(true)}
            >
              <IconBag />
              {count > 0 && <span className="count">{count}</span>}
            </button>
          </div>
        </div>
      </div>

      <nav className="nav container" aria-label="Primary">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
          {t("home")}
        </Link>
        {topCats.map((c) => {
          const href = `/category/${categorySlug(c)}`;
          return (
            <Link
              key={c.id}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
            >
              {tx(c.name, c.ar_name)}
            </Link>
          );
        })}
      </nav>

      <style>{`@media (max-width: 899px){ [data-mobile-menu]{ display: grid !important; } }`}</style>
    </header>
  );
}
