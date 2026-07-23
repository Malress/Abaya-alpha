"use client";

import type { Review } from "@/lib/ordable/types";
import { IconStar } from "@/components/ui/icons";

function Stars({ rating }: { rating: number | null }) {
  const r = Math.round(rating ?? 0);
  return (
    <div className="row" style={{ gap: 2, color: "var(--sand-deep)" }} aria-label={`${r} / 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <IconStar
          key={i}
          width={15}
          height={15}
          style={{ opacity: i < r ? 1 : 0.25 }}
        />
      ))}
    </div>
  );
}

export default function Reviews({ reviews }: { reviews: Review[] }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 20,
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
      }}
    >
      {reviews.map((rev, i) => (
        <figure
          key={i}
          style={{
            margin: 0,
            padding: 24,
            background: "var(--surface)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
          }}
        >
          {rev.rating != null && <Stars rating={rev.rating} />}
          {rev.comment && (
            <blockquote
              style={{
                margin: "12px 0 14px",
                fontFamily: "var(--font-display)",
                fontSize: 19,
                lineHeight: 1.5,
                color: "var(--ink)",
              }}
            >
              “{rev.comment}”
            </blockquote>
          )}
          {rev.name && (
            <figcaption className="eyebrow" style={{ color: "var(--text-secondary)" }}>
              {rev.name}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
