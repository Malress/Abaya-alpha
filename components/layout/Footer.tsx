"use client";

import Link from "next/link";
import { useStore } from "@/components/providers/StoreProvider";
import { slugify } from "@/lib/slug";
import { IconInstagram, IconWhatsapp, IconTiktok } from "@/components/ui/icons";

function normalizeUrl(u?: string): string | undefined {
  if (!u) return undefined;
  const trimmed = u.trim();
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default function Footer() {
  const { config, pages, tx, t } = useStore();

  // Match socials by field key — never by URL pattern.
  const socials = [
    { key: "instagram", url: normalizeUrl(config.instagram_link), Icon: IconInstagram },
    { key: "whatsapp", url: normalizeUrl(config.whatsapp_link), Icon: IconWhatsapp },
    { key: "tiktok", url: normalizeUrl(config.tiktok_link), Icon: IconTiktok },
  ].filter((s) => s.url);

  const footerPages = pages.filter(
    (p) => String(p.placement) === "0" || p.placement === 0,
  );

  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div>
          <div className="footer__word">{tx(config.name, config.ar_name)}</div>
          {config.slogan && (
            <p style={{ maxWidth: 320, color: "#b4ad9f" }}>
              {tx(config.slogan, config.ar_slogan)}
            </p>
          )}
          {socials.length > 0 && (
            <div className="social">
              {socials.map(({ key, url, Icon }) => (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={key}
                >
                  <Icon />
                </a>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4>{tx("Information", "معلومات")}</h4>
          <div className="footer__links">
            {footerPages.map((p) => (
              <Link key={p.title} href={`/pages/${slugify(p.title)}`}>
                {tx(p.title, p.title_ar)}
              </Link>
            ))}
            <Link href="/track">{t("trackOrder")}</Link>
          </div>
        </div>

        <div>
          <h4>{tx("Contact", "تواصل")}</h4>
          <div className="footer__links">
            {config.contact_number && (
              <a href={`tel:${config.contact_number}`} dir="ltr">
                {config.contact_number}
              </a>
            )}
            {config.email && <a href={`mailto:${config.email}`}>{config.email}</a>}
            <Link href="/account">{t("account")}</Link>
          </div>
        </div>
      </div>
      <div className="footer__bottom">
        © {new Date().getFullYear()} {tx(config.name, config.ar_name)}.{" "}
        {tx("All rights reserved.", "جميع الحقوق محفوظة.")}
      </div>
    </footer>
  );
}
