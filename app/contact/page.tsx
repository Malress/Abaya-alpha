"use client";

import { useStore } from "@/components/providers/StoreProvider";
import { IconInstagram, IconWhatsapp, IconTiktok } from "@/components/ui/icons";

function normalizeUrl(u?: string): string | undefined {
  if (!u) return undefined;
  const trimmed = u.trim();
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default function ContactPage() {
  const { config, branches, tx, t } = useStore();

  const socials = [
    { name: "Instagram", key: "instagram", url: normalizeUrl(config.instagram_link), Icon: IconInstagram },
    { name: "WhatsApp", key: "whatsapp", url: normalizeUrl(config.whatsapp_link), Icon: IconWhatsapp },
    { name: "TikTok", key: "tiktok", url: normalizeUrl(config.tiktok_link), Icon: IconTiktok },
    { name: "Snapchat", key: "snapchat", url: normalizeUrl(config.snapchat_link) },
    { name: "Facebook", key: "facebook", url: normalizeUrl(config.facebook_link) },
    { name: "Twitter", key: "twitter", url: normalizeUrl(config.twitter_link) },
    { name: "YouTube", key: "youtube", url: normalizeUrl(config.youtube_link) },
  ].filter((s) => s.url);

  const primaryBranch = branches[0];

  return (
    <div className="container container-narrow" style={{ paddingBlock: "clamp(32px, 5vw, 64px)" }}>
      <div className="section-head" style={{ marginBottom: 36 }}>
        <span className="eyebrow">{tx("Contact Us", "اتصل بنا")}</span>
        <h1 className="section-title">{tx(config.name, config.ar_name)}</h1>
        {(config.slogan || config.ar_slogan) && (
          <p style={{ color: "var(--text-secondary)", fontSize: 16, maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
            {tx(config.slogan, config.ar_slogan)}
          </p>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 24,
        }}
      >
        {/* Contact Info Card */}
        <div
          style={{
            background: "var(--ivory)",
            border: "1px solid var(--line)",
            borderRadius: 16,
            padding: 32,
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.04)",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 600, fontFamily: "var(--font-display)" }}>
            {tx(config.name, config.ar_name)}
          </h2>

          {config.slogan && (
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              {tx(config.slogan, config.ar_slogan)}
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
            {config.contact_number && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)" }}>
                  {tx("Phone", "الهاتف")}
                </span>
                <a
                  href={`tel:${config.contact_number}`}
                  style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)", textDecoration: "none" }}
                >
                  {config.contact_number}
                </a>
              </div>
            )}

            {config.email && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)" }}>
                  {tx("Email", "البريد الإلكتروني")}
                </span>
                <a
                  href={`mailto:${config.email}`}
                  style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)", textDecoration: "none" }}
                >
                  {config.email}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Branch / Location Card */}
        {primaryBranch && (
          <div
            style={{
              background: "var(--ivory)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 32,
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.04)",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <h2 style={{ fontSize: 20, fontWeight: 600, fontFamily: "var(--font-display)" }}>
              {tx("Branch & Location", "الفرع والموقع")}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>{tx(primaryBranch.name, primaryBranch.ar_name)}</h3>
                {(() => {
                  const areaStr = typeof primaryBranch.area === "object" ? tx(primaryBranch.area?.name, primaryBranch.area?.ar_name) : primaryBranch.area;
                  const countryStr = typeof primaryBranch.country === "object" ? tx(primaryBranch.country?.name, primaryBranch.country?.ar_name) : primaryBranch.country;
                  const locationText = [areaStr, countryStr].filter(Boolean).join(", ");
                  return locationText ? (
                    <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
                      📍 {locationText}
                    </p>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Social Media Section */}
      {socials.length > 0 && (
        <div
          style={{
            marginTop: 40,
            background: "var(--ivory)",
            border: "1px solid var(--line)",
            borderRadius: 16,
            padding: 32,
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.04)",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, fontFamily: "var(--font-display)" }}>
            {tx("Follow Us", "تابعنا على")}
          </h2>
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 16 }}>
            {socials.map(({ name, key, url, Icon }) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline"
                style={{ borderRadius: "var(--radius-pill)", paddingInline: 24 }}
              >
                {Icon && <Icon width={18} height={18} />}
                <span>{name}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
