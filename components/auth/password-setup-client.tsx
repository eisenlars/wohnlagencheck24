"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type SetupAudience = "partner" | "admin";

type PasswordSetupClientProps = {
  title: string;
  defaultAudience?: SetupAudience;
};

function readHashParams(): URLSearchParams {
  const raw = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
  return new URLSearchParams(raw);
}

function readSearchParams(): URLSearchParams {
  const raw = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
  return new URLSearchParams(raw);
}

function readAudience(defaultAudience: SetupAudience): SetupAudience {
  const search = readSearchParams();
  return search.get("aud") === "admin" ? "admin" : defaultAudience;
}

function loginPathForAudience(aud: SetupAudience): string {
  return aud === "admin" ? "/admin/login" : "/partner/login";
}

function appPathForAudience(aud: SetupAudience): string {
  return aud === "admin" ? "/admin" : "/dashboard";
}

async function resolvePostSetupTarget(fallback: string): Promise<string> {
  try {
    const res = await fetch("/api/auth/setup-target", { method: "GET", cache: "no-store" });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { redirect_to?: string };
    const target = String(data.redirect_to ?? "").trim();
    return target || fallback;
  } catch {
    return fallback;
  }
}

export default function PasswordSetupClient({ title, defaultAudience = "partner" }: PasswordSetupClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState("Einladung wird verarbeitet...");
  const [viewMode, setViewMode] = useState<"checking" | "form" | "error">("checking");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const aud = readAudience(defaultAudience);
      const fallbackAppPath = appPathForAudience(aud);
      const fallbackLoginPath = loginPathForAudience(aud);
      const hash = readHashParams();
      const search = readSearchParams();
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const hashType = hash.get("type");
      const code = search.get("code");
      const tokenHash = search.get("token_hash");
      const legacyToken = search.get("token");
      const queryType = search.get("type");
      const type = hashType || queryType;
      const otpToken = tokenHash || legacyToken;
      const invalidLinkMessage = "Reset-Link ist ungueltig oder abgelaufen. Bitte Passwort-Reset erneut anfordern.";

      const openFormIfSessionExists = async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!mounted || !user) return false;
        setReady(true);
        setViewMode("form");
        setStatus(type === "invite" ? "Bitte vergeben Sie jetzt Ihr Passwort." : "Bitte bestaetigen Sie Ihr neues Passwort.");
        if (window.location.search || window.location.hash) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        return true;
      };

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!mounted) return;
        if (!error) {
          setReady(true);
          setViewMode("form");
          setStatus(type === "invite" ? "Bitte vergeben Sie jetzt Ihr Passwort." : "Bitte bestaetigen Sie Ihr neues Passwort.");
          if (window.location.search || window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          return;
        }

        if (otpToken && type) {
          const { error: otpError } = await supabase.auth.verifyOtp({
            token_hash: otpToken,
            type: type as "invite" | "recovery" | "magiclink" | "signup" | "email",
          });
          if (!mounted) return;
          if (!otpError) {
            setReady(true);
            setViewMode("form");
            setStatus(type === "invite" ? "Bitte vergeben Sie jetzt Ihr Passwort." : "Bitte bestaetigen Sie Ihr neues Passwort.");
            if (window.location.search || window.location.hash) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
            return;
          }
        }

        if (await openFormIfSessionExists()) return;

        setStatus(invalidLinkMessage);
        setReady(false);
        setViewMode("error");
        return;
      }

      if (otpToken && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: otpToken,
          type: type as "invite" | "recovery" | "magiclink" | "signup" | "email",
        });
        if (!mounted) return;
        if (error) {
          if (await openFormIfSessionExists()) return;
          setStatus(invalidLinkMessage);
          setReady(false);
          setViewMode("error");
          return;
        }
        setReady(true);
        setViewMode("form");
        setStatus(type === "invite" ? "Bitte vergeben Sie jetzt Ihr Passwort." : "Bitte bestaetigen Sie Ihr neues Passwort.");
        if (window.location.search || window.location.hash) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        return;
      }

      if (!accessToken || !refreshToken) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!mounted) return;
        if (user) {
          const target = await resolvePostSetupTarget(fallbackAppPath);
          setViewMode("checking");
          router.replace(target);
          return;
        }
        setViewMode("checking");
        router.replace(fallbackLoginPath);
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (!mounted) return;
      if (error) {
        setStatus("Session konnte nicht gesetzt werden. Bitte Einladung oder Reset-Link erneut anfordern.");
        setReady(false);
        setViewMode("error");
        return;
      }

      setReady(true);
      setViewMode("form");
      if (type === "invite") {
        setStatus("Bitte vergeben Sie jetzt Ihr Passwort.");
      } else {
        setStatus("Bitte bestaetigen Sie Ihr neues Passwort.");
      }
      if (window.location.hash) {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [defaultAudience, router, supabase]);

  async function submit() {
    setBusy(true);
    try {
      const aud = readAudience(defaultAudience);
      const fallbackAppPath = appPathForAudience(aud);
      if (!password || password.length < 10) {
        throw new Error("Passwort muss mindestens 10 Zeichen haben.");
      }
      if (password !== confirm) {
        throw new Error("Passwoerter stimmen nicht ueberein.");
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      setStatus("Passwort erfolgreich gesetzt. Weiterleitung...");
      const target = await resolvePostSetupTarget(fallbackAppPath);
      setTimeout(() => router.push(target), 450);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Passwort konnte nicht gesetzt werden.");
    } finally {
      setBusy(false);
    }
  }

  if (viewMode === "checking") {
    return (
      <div style={{ maxWidth: 420, margin: "90px auto", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, border: "1px solid #ddd", padding: 24, borderRadius: 8 }}>
          <h2 style={{ margin: "0 0 8px 0", color: "#111827" }}>{title}</h2>
          <p style={{ fontSize: 14, color: "#475569", margin: 0 }}>Weiterleitung wird vorbereitet...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: "90px auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, border: "1px solid #ddd", padding: 24, borderRadius: 8 }}>
        <h2 style={{ margin: "0 0 8px 0", color: "#111827" }}>{title}</h2>
        <p style={{ fontSize: 14, color: "#475569", margin: 0 }}>{status}</p>
        {viewMode === "form" ? (
          <>
            <label htmlFor="password" style={{ color: "#111827" }}>Neues Passwort</label>
            <input
              name="password"
              type="password"
              placeholder="Mindestens 10 Zeichen"
              style={{ padding: 8 }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!ready || busy}
            />

            <label htmlFor="password_confirm" style={{ color: "#111827" }}>Passwort wiederholen</label>
            <input
              name="password_confirm"
              type="password"
              placeholder="Passwort wiederholen"
              style={{ padding: 8 }}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={!ready || busy}
            />

            <button
              type="button"
              disabled={!ready || busy}
              onClick={submit}
              style={{
                padding: "10px 12px",
                background: "#0f766e",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: ready && !busy ? "pointer" : "default",
                opacity: ready && !busy ? 1 : 0.6,
              }}
            >
              Passwort setzen
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
