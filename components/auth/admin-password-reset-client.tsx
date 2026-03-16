"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

function readHashParams(): URLSearchParams {
  const raw = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
  return new URLSearchParams(raw);
}

function readSearchParams(): URLSearchParams {
  const raw = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
  return new URLSearchParams(raw);
}

function setResetFlowCookie(value: string | null) {
  if (typeof document === "undefined") return;
  if (!value) {
    document.cookie = "wc24_reset_flow=; Path=/; Max-Age=0; SameSite=Lax";
    return;
  }
  document.cookie = `wc24_reset_flow=${value}; Path=/; SameSite=Lax`;
}

function hardNavigateToLogin(path: string) {
  setResetFlowCookie(null);
  if (typeof window === "undefined") return;
  window.location.assign(path);
}

export default function AdminPasswordResetClient() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState("Passwort-Link wird geprueft...");
  const [viewMode, setViewMode] = useState<"checking" | "form" | "error">("checking");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    let mounted = true;
    const invalidMessage = "Der Passwort-Link ist ungueltig oder abgelaufen. Bitte fordere ueber die Admin-Anmeldeseite einen neuen Passwort-Link an.";

    (async () => {
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
      const hasAuthLinkPayload = Boolean(code || (otpToken && type) || (accessToken && refreshToken));

      if (type && type !== "recovery") {
        if (!mounted) return;
        setStatus(invalidMessage);
        setReady(false);
        setViewMode("error");
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!mounted) return;
        if (!error) {
          setResetFlowCookie("admin");
          setReady(true);
          setViewMode("form");
          setStatus("Bitte vergebe jetzt dein neues Admin-Passwort.");
          if (window.location.search || window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          return;
        }
      }

      if (otpToken && type === "recovery") {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: otpToken,
          type: "recovery",
        });
        if (!mounted) return;
        if (!error) {
          setResetFlowCookie("admin");
          setReady(true);
          setViewMode("form");
          setStatus("Bitte vergebe jetzt dein neues Admin-Passwort.");
          if (window.location.search || window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          return;
        }
      }

      if (!hasAuthLinkPayload || !accessToken || !refreshToken) {
        if (!mounted) return;
        setStatus(invalidMessage);
        setReady(false);
        setViewMode("error");
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (!mounted) return;
      if (error) {
        setStatus(invalidMessage);
        setReady(false);
        setViewMode("error");
        return;
      }

      setResetFlowCookie("admin");
      setReady(true);
      setViewMode("form");
      setStatus("Bitte vergebe jetzt dein neues Admin-Passwort.");
      if (window.location.hash) {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function submit() {
    setBusy(true);
    try {
      if (!password || password.length < 10) {
        throw new Error("Passwort muss mindestens 10 Zeichen haben.");
      }
      if (password !== confirm) {
        throw new Error("Passwoerter stimmen nicht ueberein.");
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      await supabase.auth.signOut();
      setResetFlowCookie(null);
      router.replace("/admin/login?message=Passwort%20erfolgreich%20gesetzt.%20Bitte%20neu%20anmelden.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Passwort konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  if (viewMode === "checking") {
    return (
      <div style={{ maxWidth: 420, margin: "90px auto", fontFamily: "sans-serif" }}>
        <div style={{ display: "grid", gap: 12, border: "1px solid #ddd", padding: 24, borderRadius: 8 }}>
          <h2 style={{ margin: 0, color: "#111827" }}>Admin-Passwort neu setzen</h2>
          <p style={{ fontSize: 14, color: "#475569", margin: 0 }}>Weiterleitung wird vorbereitet...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: "90px auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "grid", gap: 12, border: "1px solid #ddd", padding: 24, borderRadius: 8 }}>
        <h2 style={{ margin: 0, color: "#111827" }}>Admin-Passwort neu setzen</h2>
        <p style={{ fontSize: 14, color: viewMode === "error" ? "#b91c1c" : "#475569", margin: 0 }}>{status}</p>
        {viewMode === "form" ? (
          <>
            <label htmlFor="password" style={{ color: "#111827" }}>Neues Passwort</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Mindestens 10 Zeichen"
              style={{ padding: 8 }}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={!ready || busy}
            />
            <label htmlFor="password_confirm" style={{ color: "#111827" }}>Passwort bestaetigen</label>
            <input
              id="password_confirm"
              name="password_confirm"
              type="password"
              placeholder="Passwort wiederholen"
              style={{ padding: 8 }}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              disabled={!ready || busy}
            />
            <button
              type="button"
              disabled={!ready || busy}
              onClick={submit}
              style={{
                padding: "10px 12px",
                background: "#111827",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: ready && !busy ? "pointer" : "default",
                opacity: ready && !busy ? 1 : 0.6,
                fontWeight: 700,
              }}
            >
              Neues Passwort speichern
            </button>
          </>
        ) : null}
        {viewMode === "error" ? (
          <button
            type="button"
            onClick={() => hardNavigateToLogin("/admin/login")}
            style={{
              textDecoration: "none",
              padding: "10px 12px",
              border: "1px solid #111827",
              borderRadius: 6,
              color: "#111827",
              fontWeight: 700,
              textAlign: "center",
              background: "#ffffff",
              cursor: "pointer",
            }}
          >
            Zur Admin-Anmeldeseite
          </button>
        ) : null}
      </div>
    </div>
  );
}
