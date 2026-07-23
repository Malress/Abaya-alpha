"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BootData } from "@/lib/ordable/boot";
import type { Currency, Locale } from "@/lib/ordable/types";
import { pick as pickLocale, t as translate, type STRINGS } from "@/lib/i18n";

interface StoreContextValue extends BootData {
  locale: Locale;
  setLocale: (l: Locale) => void;
  currency: Currency | undefined;
  t: (key: keyof typeof STRINGS) => string;
  tx: (en?: string | null, ar?: string | null) => string;
  // UI
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({
  boot,
  locale,
  children,
}: {
  boot: BootData;
  locale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const setLocale = useCallback(
    (l: Locale) => {
      document.cookie = `locale=${l}; path=/; max-age=${60 * 60 * 24 * 365}`;
      document.documentElement.lang = l;
      document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
      router.refresh();
    },
    [router],
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      ...boot,
      locale,
      setLocale,
      currency: boot.config.base_currency,
      t: (key) => translate(locale, key),
      tx: (en, ar) => pickLocale(locale, en, ar),
      cartOpen,
      setCartOpen,
      searchOpen,
      setSearchOpen,
      menuOpen,
      setMenuOpen,
    }),
    [boot, locale, setLocale, cartOpen, searchOpen, menuOpen],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
