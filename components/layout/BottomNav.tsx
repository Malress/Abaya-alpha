"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/components/providers/StoreProvider";
import { useCart } from "@/components/providers/CartProvider";
import { IconBag, IconHome, IconSearch, IconUser } from "@/components/ui/icons";

export default function BottomNav() {
  const { t, setCartOpen, setSearchOpen } = useStore();
  const { count } = useCart();
  const pathname = usePathname();

  return (
    <nav className="bottomnav" aria-label="Mobile">
      <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
        <IconHome width={20} height={20} />
        {t("home")}
      </Link>
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        style={btnReset}
      >
        <IconSearch width={20} height={20} />
        {t("search")}
      </button>
      <button type="button" onClick={() => setCartOpen(true)} style={btnReset}>
        <span style={{ position: "relative", display: "inline-flex" }}>
          <IconBag width={20} height={20} />
          {count > 0 && <span className="count">{count}</span>}
        </span>
        {t("cart")}
      </button>
      <Link
        href="/account"
        aria-current={pathname.startsWith("/account") ? "page" : undefined}
      >
        <IconUser width={20} height={20} />
        {t("account")}
      </Link>
    </nav>
  );
}

const btnReset: React.CSSProperties = {
  background: "none",
  border: "none",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 3,
  padding: "9px 0 8px",
  fontFamily: "var(--font-sans)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
};
