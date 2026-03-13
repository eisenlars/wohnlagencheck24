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

export default function PartnerInviteActivationClient() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState("Einladungslink wird geprueft...");
  const [viewMode, setViewMode] = useState<"checking" | "form" | "error">("checking");
  const [errorKind, setErrorKind] = useState<"invalid_invite" | "already_active">("invalid_invite");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accessEmail, setAccessEmail] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [showInviteRequest, setShowInviteRequest] = useState(false);
  const invalidMessage = "Der Einladungslink ist ungueltig oder abgelaufen. Bitte fordere einen neuen Einladungslink an.";

  useEffect(() => {
    let mounted = true;

    async function showInvalidInviteState() {
      try {
        const res = await fetch("/api/auth/setup-target", { method: "GET", cache: "no-store" });
        const payload = (await res.json().catch(() => ({}))) as { redirect_to?: string };
        const redirectTo = String(payload.redirect_to ?? "").trim();
        if (!mounted) return;
        if (redirectTo === "/dashboard") {
          setErrorKind("already_active");
          setStatus("Ihr Partnerkonto ist bereits aktiviert. Sie koennen direkt in Ihr Dashboard wechseln.");
          setReady(false);
          setViewMode("error");
          setShowInviteRequest(false);
          return;
        }
      } catch {
        // Fallback below.
      }

      if (!mounted) return;
      setErrorKind("invalid_invite");
      setStatus(invalidMessage);
      setReady(false);
      setViewMode("error");
      setShowInviteRequest(false);
    }

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
      const prefEmail = String(search.get("email") ?? "").trim();
      const hasAuthLinkPayload = Boolean(code || (otpToken && type) || (accessToken && refreshToken));
      const supportedType = !type || type === "invite" || type === "recovery";

      if (prefEmail) setAccessEmail(prefEmail);
      if (!supportedType) {
        await showInvalidInviteState();
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!mounted) return;
        if (!error) {
          setErrorKind("invalid_invite");
          setReady(true);
          setViewMode("form");
          setStatus("Bitte vergeben Sie jetzt Ihr Passwort fuer die Aktivierung.");
          if (window.location.search || window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          return;
        }
      }

      if (otpToken && (type === "invite" || type === "recovery")) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: otpToken,
          type,
        });
        if (!mounted) return;
        if (!error) {
          setErrorKind("invalid_invite");
          setReady(true);
          setViewMode("form");
          setStatus("Bitte vergeben Sie jetzt Ihr Passwort fuer die Aktivierung.");
          if (window.location.search || window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          return;
        }
      }

      if (!hasAuthLinkPayload || !accessToken || !refreshToken) {
        await showInvalidInviteState();
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (!mounted) return;
      if (error) {
        await showInvalidInviteState();
        return;
      }

      setErrorKind("invalid_invite");
      setReady(true);
      setViewMode("form");
      setStatus("Bitte vergeben Sie jetzt Ihr Passwort fuer die Aktivierung.");
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
      const activationRes = await fetch("/api/auth/complete-setup", { method: "POST" });
      if (!activationRes.ok) {
        throw new Error("Partnerkonto konnte nicht aktiviert werden. Bitte erneut versuchen.");
      }
      await supabase.auth.signOut();
      router.replace("/partner/setup/success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Partnerkonto konnte nicht aktiviert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function requestNewInviteLink() {
    const email = String(accessEmail ?? "").trim().toLowerCase();
    if (!email) {
      setStatus("Bitte gib deine E-Mail-Adresse ein.");
      return;
    }

    setRequestBusy(true);
    try {
      const res = await fetch("/api/auth/request-partner-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await res.json().catch(() => ({}))) as { retry_after_sec?: number };
      if (res.status === 429) {
        const retry = Number(payload.retry_after_sec ?? 0);
        setStatus(retry > 0 ? `Zu viele Anfragen. Bitte in ${retry}s erneut versuchen.` : "Zu viele Anfragen. Bitte spaeter erneut versuchen.");
        return;
      }
      if (!res.ok) {
        throw new Error("Die Anfrage konnte nicht uebermittelt werden. Bitte erneut versuchen.");
      }
      router.replace("/partner/setup/requested");
    } catch {
      setStatus("Die Anfrage konnte nicht uebermittelt werden. Bitte erneut versuchen.");
    } finally {
      setRequestBusy(false);
    }
  }

  if (viewMode === "checking") {
    return (
      <div style={{ maxWidth: 420, margin: "90px auto", fontFamily: "sans-serif" }}>
        <div style={{ display: "grid", gap: 12, border: "1px solid #ddd", padding: 24, borderRadius: 8 }}>
          <h2 style={{ margin: 0, color: "#111827" }}>Partnerkonto aktivieren</h2>
          <p style={{ fontSize: 14, color: "#475569", margin: 0 }}>Weiterleitung wird vorbereitet...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: "90px auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "grid", gap: 12, border: "1px solid #ddd", padding: 24, borderRadius: 8 }}>
        <h2 style={{ margin: 0, color: "#111827" }}>Partnerkonto aktivieren</h2>
        <p style={{ fontSize: 14, color: viewMode === "error" && errorKind !== "already_active" ? "#b91c1c" : "#475569", margin: 0 }}>
          {status}
        </p>
        {viewMode === "form" ? (
          <>
            <label htmlFor="password" style={{ color: "#111827" }}>Passwort festlegen</label>
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
                background: "#0f766e",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: ready && !busy ? "pointer" : "default",
                opacity: ready && !busy ? 1 : 0.6,
                fontWeight: 700,
              }}
            >
              Partnerkonto aktivieren
            </button>
          </>
        ) : null}
        {viewMode === "error" ? (
          errorKind === "already_active" ? (
            <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                style={{
                  padding: "10px 12px",
                  background: "#0f766e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Zum Dashboard
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
              <p style={{ margin: 0, fontSize: 14, color: "#475569", lineHeight: 1.45 }}>
                Falls Ihr Partnerkonto bereits aktiviert ist, melden Sie sich bitte an oder nutzen Sie den Passwort-vergessen-Prozess.
              </p>
              <button
                type="button"
                onClick={() => router.push("/partner/login")}
                style={{
                  padding: "10px 12px",
                  background: "#0f766e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Zur Anmeldung
              </button>
              {!showInviteRequest ? (
                <button
                  type="button"
                  onClick={() => setShowInviteRequest(true)}
                  style={{
                    padding: "10px 12px",
                    background: "#ffffff",
                    color: "#111827",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Ich brauche eine neue Einladung
                </button>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <label htmlFor="request_email" style={{ color: "#111827", fontWeight: 700 }}>
                    E-Mail-Adresse
                  </label>
                  <input
                    id="request_email"
                    name="request_email"
                    type="email"
                    placeholder="ihre@email.de"
                    style={{ padding: 8 }}
                    value={accessEmail}
                    onChange={(event) => setAccessEmail(event.target.value)}
                    disabled={requestBusy}
                  />
                  <button
                    type="button"
                    onClick={requestNewInviteLink}
                    style={{
                      padding: "10px 12px",
                      background: "#111827",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: requestBusy ? "default" : "pointer",
                      fontWeight: 700,
                      opacity: requestBusy ? 0.75 : 1,
                    }}
                    disabled={requestBusy}
                  >
                    Neuen Link beantragen
                  </button>
                </div>
              )}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
