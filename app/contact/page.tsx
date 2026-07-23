"use client";

import { useStore } from "@/components/providers/StoreProvider";
import { IconInstagram, IconWhatsapp, IconTiktok, IconPhone, IconMapPin, IconClock } from "@/components/ui/icons";
import { compressSchedule } from "@/lib/hours";

function normalizeUrl(u?: string): string | undefined {
  if (!u) return undefined;
  const trimmed = u.trim();
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default function ContactPage() {
  const { config, branches, tx, t } = useStore();

  const socials = [
    { name: "Instagram", key: "instagram", url: normalizeUrl(config.instagram_link), Icon: IconInstagram, color: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)" },
    { name: "WhatsApp", key: "whatsapp", url: normalizeUrl(config.whatsapp_link), Icon: IconWhatsapp, color: "linear-gradient(45deg, #25D366, #128C7E)" },
    { name: "TikTok", key: "tiktok", url: normalizeUrl(config.tiktok_link), Icon: IconTiktok, color: "linear-gradient(45deg, #111, #333)" },
    { name: "Snapchat", key: "snapchat", url: normalizeUrl(config.snapchat_link), color: "linear-gradient(45deg, #FFFC00, #d4d100)", textColor: "#000" },
    { name: "Facebook", key: "facebook", url: normalizeUrl(config.facebook_link), color: "linear-gradient(45deg, #1877F2, #0d5bb5)" },
    { name: "Twitter", key: "twitter", url: normalizeUrl(config.twitter_link), color: "linear-gradient(45deg, #1DA1F2, #0c85d0)" },
    { name: "YouTube", key: "youtube", url: normalizeUrl(config.youtube_link), color: "linear-gradient(45deg, #FF0000, #c20000)" },
  ].filter((s) => s.url);



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
        {(config.contact_number || config.email) && (
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
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
            {config.contact_number && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)" }}>
                  {tx("Phone", "الهاتف")}
                </span>
                <a
                  href={`tel:${config.contact_number}`}
                  style={{ fontSize: 16, fontWeight: 500, color: "var(--brand)", textDecoration: "none" }}
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
                  style={{ fontSize: 16, fontWeight: 500, color: "var(--brand)", textDecoration: "none" }}
                >
                  {config.email}
                </a>
              </div>
            )}
          </div>
          </div>
        )}

        {/* Branch / Location Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, alignItems: "stretch" }}>
          {branches.map((b) => {
            const areaStr = typeof b.area === "object" ? tx(b.area?.name, b.area?.ar_name) : b.area;
            const locationText = [areaStr].filter(Boolean).join(", ");
            const hasMapLink = b.lat && b.lng;
            const hours = b.pickup_working_hours || b.delivery_working_hours;
            const formattedHours = compressSchedule(hours, tx);
            
            let phone = (b as any).contact_number || (b as any).phone;
            if (phone && phone.toLowerCase() === "+nonenone") phone = null; // Fix the invalid phone bug
  
            return (
              <div
                key={b.id}
                style={{
                  background: "var(--ivory)",
                  border: "1px solid var(--line)",
                  borderRadius: 16,
                  padding: 24,
                  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 24,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <h2 style={{ fontSize: 24, fontWeight: 600, fontFamily: "var(--font-display)" }}>
                    {tx(b.name, b.ar_name)}
                  </h2>
    
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {locationText && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ color: "var(--brand)", marginTop: 2 }}>
                          <IconMapPin width={20} height={20} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>
                            {tx("Address", "العنوان")}
                          </span>
                          <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>
                            {locationText}
                          </p>
                        </div>
                      </div>
                    )}
  
                    {phone && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ color: "var(--brand)", marginTop: 2 }}>
                          <IconPhone width={20} height={20} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>
                            {tx("Phone", "الهاتف")}
                          </span>
                          <a
                            href={`tel:${phone}`}
                            style={{ fontSize: 14, color: "var(--text-secondary)", textDecoration: "none" }}
                          >
                            {phone}
                          </a>
                        </div>
                      </div>
                    )}
  
                    {formattedHours.length > 0 && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ color: "var(--brand)", marginTop: 2 }}>
                          <IconClock width={20} height={20} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>
                            {tx("Working Hours", "ساعات العمل")}
                          </span>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {formattedHours.map((schedule, i) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-secondary)", borderBottom: i !== formattedHours.length - 1 ? "1px dashed var(--line)" : "none", paddingBottom: i !== formattedHours.length - 1 ? 6 : 0 }}>
                                <span style={{ fontWeight: 500 }}>{schedule.label}</span>
                                <span>{schedule.time}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
  
                {hasMapLink && (
                  <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)", height: "100%", minHeight: 240 }}>
                    <iframe
                      width="100%"
                      height="100%"
                      style={{ border: 0, display: "block", minHeight: 240 }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://maps.google.com/maps?q=${b.lat},${b.lng}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                    ></iframe>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
            {socials.map(({ name, key, url, Icon, color, textColor }) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="btn"
                style={{ 
                  borderRadius: "var(--radius-pill)", 
                  paddingInline: 24,
                  background: color,
                  color: textColor || "#fff",
                  boxShadow: "none"
                }}
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
