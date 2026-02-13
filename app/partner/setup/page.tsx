"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

function readHashParams(): URLSearchParams {
  const raw = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
  return new URLSearchParams(raw);
}

export default function PartnerSetupPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState("Einladung wird verarbeitet...");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const hash = readHashParams();
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const type = hash.get("type");

      if (!accessToken || !refreshToken) {
        if (mounted) {
          setStatus("Einladungslink ist unvollstaendig oder abgelaufen. Bitte neue Einladung anfordern.");
          setReady(false);
        }
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (!mounted) return;
      if (error) {
        setStatus("Session konnte nicht gesetzt werden. Bitte Einladung erneut anfordern.");
        setReady(false);
        return;
      }

      setReady(true);
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
      setStatus("Passwort erfolgreich gesetzt. Weiterleitung...");
      setTimeout(() => router.push("/dashboard"), 450);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Passwort konnte nicht gesetzt werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "90px auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, border: "1px solid #ddd", padding: 24, borderRadius: 8 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>Partnerkonto aktivieren</h2>
        <p style={{ fontSize: 14, color: "#475569", margin: 0 }}>{status}</p>

        <label htmlFor="password">Neues Passwort</label>
        <input
          name="password"
          type="password"
          placeholder="Mindestens 10 Zeichen"
          style={{ padding: 8 }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={!ready || busy}
        />

        <label htmlFor="password_confirm">Passwort wiederholen</label>
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
      </div>
    </div>
  );
}
