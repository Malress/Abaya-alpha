import type { Metadata } from "next";
import { Outfit, Jost, Cairo } from "next/font/google";
import "./globals.css";
import { loadBoot, getLocale } from "@/lib/ordable/boot";
import AppShell from "@/components/layout/AppShell";
import { pick } from "@/lib/i18n";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-outfit",
  display: "swap",
});
const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-jost",
  display: "swap",
});
const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  variable: "--font-cairo",
  display: "swap",
});

const PLACEHOLDER_COLOR = "#0099cc";

function isRealColor(c?: string): c is string {
  return Boolean(
    c &&
      /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim()) &&
      c.trim().toLowerCase() !== PLACEHOLDER_COLOR,
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const boot = await loadBoot();
  const locale = await getLocale();
  const c = boot?.config;
  const name = c ? pick(locale, c.meta_name || c.name, c.ar_name) : "Store";
  const description = c
    ? pick(locale, c.meta_description || c.slogan, c.ar_slogan)
    : "";
  return {
    title: { default: name, template: `%s · ${name}` },
    description: description || undefined,
    metadataBase: process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
      : undefined,
    icons: c?.favicon ? { icon: c.favicon } : undefined,
    openGraph: {
      title: name,
      description: description || undefined,
      images: c?.cover ? [c.cover] : undefined,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [boot, locale] = await Promise.all([loadBoot(), getLocale()]);
  const dir = locale === "ar" ? "rtl" : "ltr";
  const fontVars = `${outfit.variable} ${jost.variable} ${cairo.variable}`;

  // Apply verified config colors at runtime with accessible neutral fallbacks.
  const overrides: string[] = [];
  if (boot && isRealColor(boot.config.discount_tag_color)) {
    overrides.push(`--discount:${boot.config.discount_tag_color};`);
  }
  if (boot && isRealColor(boot.config.theme_color)) {
    overrides.push(`--brand:${boot.config.theme_color};`);
  }
  const themeStyle = overrides.length ? `:root{${overrides.join("")}}` : "";

  return (
    <html lang={locale} dir={dir} className={fontVars}>
      <body>
        {themeStyle && <style dangerouslySetInnerHTML={{ __html: themeStyle }} />}
        {boot ? (
          <AppShell boot={boot} locale={locale}>
            {children}
          </AppShell>
        ) : (
          <div
            className="empty-state"
            style={{ minHeight: "80vh", display: "grid", placeItems: "center" }}
          >
            <div>
              <h2>Store unavailable</h2>
              <p>We couldn&apos;t reach the store right now. Please try again shortly.</p>
            </div>
          </div>
        )}
      </body>
    </html>
  );
}
