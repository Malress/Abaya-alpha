"use client";

import { useEffect, useState } from "react";

export default function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (active >= images.length) setActive(0);
  }, [images, active]);

  if (images.length === 0) {
    return (
      <div
        style={{
          aspectRatio: "3 / 4",
          background: "var(--sand-soft)",
          borderRadius: "var(--radius-xs)",
          display: "grid",
          placeItems: "center",
          color: "var(--muted)",
          fontFamily: "var(--font-display)",
          fontSize: 56,
        }}
        aria-hidden
      >
        {alt.slice(0, 1) || "◆"}
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div
        style={{
          aspectRatio: "3 / 4",
          overflow: "hidden",
          background: "var(--sand-soft)",
          borderRadius: "var(--radius-xs)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[active]}
          alt={alt}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      {images.length > 1 && (
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }} role="tablist" aria-label={alt}>
          {images.map((img, i) => (
            <button
              key={img + i}
              role="tab"
              aria-selected={i === active}
              aria-label={`${alt} ${i + 1}`}
              onClick={() => setActive(i)}
              style={{
                width: 64,
                height: 80,
                padding: 0,
                border: i === active ? "1px solid var(--ink)" : "1px solid var(--line)",
                background: "var(--sand-soft)",
                borderRadius: "var(--radius-xs)",
                overflow: "hidden",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
