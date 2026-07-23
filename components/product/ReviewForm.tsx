"use client";

import { useState } from "react";
import { useStore } from "@/components/providers/StoreProvider";
import { sfPost } from "@/lib/client-api";
import { IconStar } from "@/components/ui/icons";

export default function ReviewForm({ productId }: { productId: number }) {
  const { t, locale } = useStore();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return;
    setStatus("loading");
    const res = await sfPost("/feedback/", {
      product_id: productId,
      rating,
      comment: comment.trim() || undefined,
      customer_name: name.trim() || undefined,
    });
    if (res.ok) {
      setStatus("done");
      setMessage(
        locale === "ar"
          ? "شكراً لك! سيظهر تقييمك بعد الموافقة عليه."
          : "Thank you! Your review will appear once approved.",
      );
    } else {
      setStatus("error");
      setMessage(res.message || (locale === "ar" ? "تعذّر الإرسال" : "Could not submit"));
    }
  }

  if (status === "done") {
    return <p className="notice notice-success" style={{ maxWidth: 520, margin: "0 auto" }}>{message}</p>;
  }

  return (
    <form
      onSubmit={submit}
      className="stack"
      style={{ gap: 14, maxWidth: 520, margin: "8px auto 0" }}
    >
      <div className="row" style={{ gap: 4 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i + 1)}
            aria-label={`${i + 1}`}
            style={{ background: "none", border: "none", padding: 2, color: "var(--sand-deep)" }}
          >
            <IconStar width={22} height={22} style={{ opacity: i < rating ? 1 : 0.25, color: "#FFD700" }} />
          </button>
        ))}
      </div>
      <input
        className="input"
        placeholder={t("fullName")}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <textarea
        className="textarea"
        placeholder={locale === "ar" ? "شاركنا رأيك…" : "Share your thoughts…"}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {status === "error" && <p className="field-error">{message}</p>}
      <button className="btn" disabled={!rating || status === "loading"}>
        {status === "loading" ? <span className="spinner" /> : t("reviews")}
      </button>
    </form>
  );
}
