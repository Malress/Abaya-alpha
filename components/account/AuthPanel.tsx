"use client";

import { useState } from "react";
import { useStore } from "@/components/providers/StoreProvider";
import { authAction } from "@/lib/client-api";

type Step = "form" | "verify";

export default function AuthPanel({ onAuthed }: { onAuthed: () => void }) {
  const { config, locale, t } = useStore();
  const phoneEnabled = Boolean(config.enable_phone_login);

  const [channel, setChannel] = useState<"email" | "phone">(phoneEnabled ? "phone" : "email");
  const [mode, setMode] = useState<0 | 1>(1); // 1 = login, 0 = sign-up
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await authAction({
      action: "auth",
      channel,
      mode,
      name: mode === 0 ? name : undefined,
      email: channel === "email" ? email : undefined,
      phone: channel === "phone" ? phone : undefined,
      password,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.message || (locale === "ar" ? "تعذّر تسجيل الدخول" : "Could not sign in"));
      return;
    }
    const verify = (res.raw as { verify?: boolean })?.verify;
    if (verify) setStep("verify");
    else onAuthed();
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await authAction({
      action: "verify",
      channel,
      email: channel === "email" ? email : undefined,
      phone: channel === "phone" ? phone : undefined,
      code,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.message || (locale === "ar" ? "رمز غير صحيح" : "Invalid code"));
      return;
    }
    onAuthed();
  }

  if (step === "verify") {
    return (
      <form onSubmit={verify} className="stack" style={{ gap: 14 }}>
        <p className="help">
          {locale === "ar" ? "أدخل رمز التحقق المرسل إليك." : "Enter the verification code we sent you."}
        </p>
        <div className="field">
          <label>{t("verificationCode")}</label>
          <input className="input" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" />
        </div>
        {error && <p className="field-error">{error}</p>}
        <button className="btn btn-block" disabled={loading}>
          {loading ? <span className="spinner" /> : t("verify")}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
      <div className="seg" style={{ alignSelf: "start" }}>
        <button type="button" className={`seg__btn ${mode === 1 ? "seg__btn--on" : ""}`} onClick={() => setMode(1)}>
          {t("signIn")}
        </button>
        <button type="button" className={`seg__btn ${mode === 0 ? "seg__btn--on" : ""}`} onClick={() => setMode(0)}>
          {t("register")}
        </button>
      </div>

      {phoneEnabled && (
        <div className="seg" style={{ alignSelf: "start" }}>
          <button type="button" className={`seg__btn ${channel === "phone" ? "seg__btn--on" : ""}`} onClick={() => setChannel("phone")}>
            {t("phone")}
          </button>
          <button type="button" className={`seg__btn ${channel === "email" ? "seg__btn--on" : ""}`} onClick={() => setChannel("email")}>
            {t("email")}
          </button>
        </div>
      )}

      {mode === 0 && (
        <div className="field">
          <label>{t("fullName")}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      )}
      {channel === "email" ? (
        <div className="field">
          <label>{t("email")}</label>
          <input className="input" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
        </div>
      ) : (
        <div className="field">
          <label>{t("phone")}</label>
          <input className="input" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </div>
      )}
      <div className="field">
        <label>{t("password")}</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>

      {error && <p className="field-error">{error}</p>}
      <button className="btn btn-block" disabled={loading}>
        {loading ? <span className="spinner" /> : mode === 1 ? t("signIn") : t("register")}
      </button>

      <div className="seg" style={{ border: "none" }}>
        <style>{`.seg__btn{-webkit-tap-highlight-color:transparent}`}</style>
      </div>
    </form>
  );
}
