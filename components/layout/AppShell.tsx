"use client";

import type { BootData } from "@/lib/ordable/boot";
import type { Locale } from "@/lib/i18n";
import { StoreProvider, useStore } from "@/components/providers/StoreProvider";
import { CartProvider } from "@/components/providers/CartProvider";
import Header from "./Header";
import Footer from "./Footer";
import SearchOverlay from "./SearchOverlay";
import MobileMenu from "./MobileMenu";
import BottomNav from "./BottomNav";
import PopupBanner from "./PopupBanner";

function AnnounceBar() {
  const { config, tx } = useStore();
  const msg = tx(config.slogan, config.ar_slogan);
  if (!msg || /creative slogan/i.test(msg)) return null;
  return <div className="announce">{msg}</div>;
}

function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnnounceBar />
      <Header />
      <main className="page-pad-bottom">{children}</main>
      <Footer />
      <BottomNav />
      <SearchOverlay />
      <MobileMenu />
      <PopupBanner />
    </>
  );
}

export default function AppShell({
  boot,
  locale,
  children,
}: {
  boot: BootData;
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <StoreProvider boot={boot} locale={locale}>
      <CartProvider>
        <Chrome>{children}</Chrome>
      </CartProvider>
    </StoreProvider>
  );
}
