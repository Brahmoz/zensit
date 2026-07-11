"use client";
import { useEffect, useState, useRef } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, addDoc, doc, updateDoc, query, where } from "firebase/firestore";

export default function EmergencyListener() {
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [localCoords, setLocalCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [activeProfile, setActiveProfile] = useState<any>(null);

  // SOS trigger state
  const [isPressing, setIsPressing] = useState(false);
  const [pressProgress, setPressProgress] = useState(0);
  const pressTimerRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);

  // Local active SOS broadcast
  const [myActiveAlertId, setMyActiveAlertId] = useState<string | null>(null);

  // Audio oscillator reference for the siren
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const sirenIntervalRef = useRef<any>(null);

  // Helper: Haversine distance in km
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Siren using Web Audio API — only called from user gesture handlers
  const startSiren = () => {
    try {
      if (audioCtxRef.current) return;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      oscRef.current = osc;

      let isHigh = false;
      sirenIntervalRef.current = setInterval(() => {
        if (oscRef.current) {
          oscRef.current.frequency.setValueAtTime(isHigh ? 950 : 650, ctx.currentTime);
          isHigh = !isHigh;
        }
      }, 400);
    } catch (e) {
      console.warn("Audio Context blocked:", e);
    }
  };

  const stopSiren = () => {
    if (sirenIntervalRef.current) { clearInterval(sirenIntervalRef.current); sirenIntervalRef.current = null; }
    if (oscRef.current) { try { oscRef.current.stop(); } catch {} oscRef.current = null; }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; }
  };

  // Load active profile from localStorage, poll every 4s
  useEffect(() => {
    const loadProfile = () => {
      const stored = localStorage.getItem("zensit_user_profiles");
      const activeId = localStorage.getItem("zensit_active_profile_id");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.length > 0) {
            const active = activeId
              ? (parsed.find((p: any) => p.id === activeId) || parsed[0])
              : parsed[0];
            setActiveProfile(active);
          }
        } catch {}
      }
    };
    loadProfile();
    const interval = setInterval(loadProfile, 4000);
    return () => clearInterval(interval);
  }, []);

  // Get user GPS once
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setLocalCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // Listen for active Firestore emergency alerts
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "emergency_alerts"), where("resolved", "==", false));

    const unsub = onSnapshot(q, (snap) => {
      const alerts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const matches = alerts.filter((alert: any) => {
        if (alert.id === myActiveAlertId) return false;
        const sameProfile = activeProfile && alert.profileName === activeProfile.name;
        let isNearby = false;
        if (localCoords && alert.gps) {
          const dist = getDistance(localCoords.lat, localCoords.lon, alert.gps.lat, alert.gps.lon);
          if (dist <= 5) isNearby = true;
        }
        return sameProfile || isNearby;
      });
      setActiveAlerts(matches);
      // AudioContext must be triggered by user gesture — siren NOT auto-started here
      if (matches.length === 0) stopSiren();
    });

    return () => { unsub(); stopSiren(); };
  }, [activeProfile, localCoords, myActiveAlertId]);

  // Long-press logic
  const handlePressStart = () => {
    setIsPressing(true);
    setPressProgress(0);
    const startTime = Date.now();
    const duration = 5000; // 5 seconds
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setPressProgress(pct);
      if (elapsed >= duration) clearInterval(progressIntervalRef.current);
    }, 50);
    pressTimerRef.current = setTimeout(async () => {
      setIsPressing(false);
      setPressProgress(0);
      await triggerSOS();
    }, duration);
  };

  const handlePressEnd = () => {
    setIsPressing(false);
    setPressProgress(0);
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  };

  const triggerSOS = async () => {
    if (!db) { alert("Database connection offline."); return; }
    let lat = 20.5937, lon = 78.9629;
    if (navigator.geolocation) {
      try {
        const pos: any = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 })
        );
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      } catch {}
    }
    try {
      const docRef = await addDoc(collection(db, "emergency_alerts"), {
        profileName: activeProfile?.name || "Anonymous User",
        allergies: activeProfile?.allergies || "Unknown Allergens",
        gps: { lat, lon },
        timestamp: new Date().toISOString(),
        resolved: false
      });
      setMyActiveAlertId(docRef.id);
    } catch (e) {
      console.error(e);
      alert("Failed to broadcast SOS.");
    }
  };

  const cancelMySOS = async () => {
    if (!db || !myActiveAlertId) return;
    try {
      await updateDoc(doc(db, "emergency_alerts", myActiveAlertId), { resolved: true });
      setMyActiveAlertId(null);
    } catch (e) { console.error(e); }
  };

  const resolveExternalAlert = async (alertId: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, "emergency_alerts", alertId), { resolved: true });
    } catch (e) { console.error(e); }
  };

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Global keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes sos-flash-bg {
          0%   { background: rgba(127, 29, 29, 0.97); }
          50%  { background: rgba(220, 38, 38, 1); }
          100% { background: rgba(127, 29, 29, 0.97); }
        }
        @keyframes sos-icon-pulse {
          0%   { transform: scale(1);    box-shadow: 0 0 0px  rgba(255,255,255,0.3); }
          50%  { transform: scale(1.14); box-shadow: 0 0 42px rgba(255,255,255,0.5); }
          100% { transform: scale(1);    box-shadow: 0 0 0px  rgba(255,255,255,0.3); }
        }
        @keyframes sos-slide-in {
          from { transform: scale(0.85); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        @keyframes sos-btn-glow {
          0%   { box-shadow: 0 0 8px  rgba(220,38,38,0.45); }
          50%  { box-shadow: 0 0 22px rgba(220,38,38,0.9); }
          100% { box-shadow: 0 0 8px  rgba(220,38,38,0.45); }
        }
      `}} />

      {/* ── RECEIVER: full-screen flashing red overlay ─────────────────── */}
      {activeAlerts.map((alert: any) => {
        let distStr = "unknown distance";
        if (localCoords && alert.gps) {
          const d = getDistance(localCoords.lat, localCoords.lon, alert.gps.lat, alert.gps.lon);
          distStr = `~${d.toFixed(2)} km away`;
        }
        return (
          <div key={alert.id} style={{
            position: "fixed", inset: 0, zIndex: 10000,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "24px 20px", textAlign: "center", color: "#fff",
            animation: "sos-flash-bg 0.8s infinite ease-in-out",
            overflowY: "auto"
          }}>
            <div style={{ animation: "sos-slide-in 0.4s ease both", width: "100%", maxWidth: 500 }}>
              <div style={{
                width: 120, height: 120, borderRadius: "50%",
                background: "rgba(255,255,255,0.15)",
                border: "3px solid rgba(255,255,255,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "3.5rem", margin: "0 auto 28px",
                animation: "sos-icon-pulse 1.2s infinite ease-in-out"
              }}>
                🚨
              </div>

              <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.7, marginBottom: 8 }}>
                Emergency Alert Received
              </div>
              <h1 style={{ fontSize: "clamp(1.6rem,5vw,2.4rem)", fontWeight: 900, marginBottom: 16, lineHeight: 1.15 }}>
                Nearby Help Request
              </h1>
              <div style={{
                display: "inline-block", background: "rgba(0,0,0,0.35)",
                padding: "10px 24px", borderRadius: 50, fontSize: "1.1rem",
                fontWeight: 700, border: "1px solid rgba(255,255,255,0.2)", marginBottom: 24
              }}>
                👤 {alert.profileName}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28 }}>
                {[
                  { label: "GPS Proximity", value: distStr, icon: "📍" },
                  { label: "Sent at", value: new Date(alert.timestamp).toLocaleTimeString(), icon: "🕐" },
                  { label: "Known Allergies", value: alert.allergies, icon: "⚠️", full: true },
                ].map((item, i) => (
                  <div key={i} style={{
                    gridColumn: (item as any).full ? "1 / -1" : "auto",
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 12, padding: "12px 16px", textAlign: "left"
                  }}>
                    <div style={{ fontSize: "0.65rem", opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                      {item.icon} {item.label}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${alert.gps?.lat},${alert.gps?.lon}`}
                  target="_blank" rel="noreferrer"
                  style={{
                    display: "block", background: "#22c55e", color: "#fff",
                    padding: "16px", borderRadius: 14, fontWeight: 800,
                    fontSize: "1rem", textDecoration: "none",
                    boxShadow: "0 4px 20px rgba(34,197,94,0.4)"
                  }}
                >
                  🗺️ Open Directions in Maps
                </a>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button type="button" onClick={() => startSiren()} style={{
                    background: "rgba(255,255,255,0.15)", color: "#fff",
                    border: "1px solid rgba(255,255,255,0.3)",
                    padding: "14px", borderRadius: 12, fontWeight: 700,
                    fontSize: "0.875rem", cursor: "pointer"
                  }}>
                    🔊 Siren On
                  </button>
                  <button type="button" onClick={() => stopSiren()} style={{
                    background: "transparent", color: "rgba(255,255,255,0.7)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    padding: "14px", borderRadius: 12, fontWeight: 700,
                    fontSize: "0.875rem", cursor: "pointer"
                  }}>
                    🔕 Mute
                  </button>
                </div>

                <button type="button" onClick={() => resolveExternalAlert(alert.id)} style={{
                  background: "rgba(255,255,255,0.95)", color: "#991b1b",
                  border: "none", padding: "16px", borderRadius: 14,
                  fontWeight: 900, fontSize: "1rem", cursor: "pointer"
                }}>
                  ✓ Mark Resolved — I&apos;ve Helped
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── SENDER: full-screen red broadcast status ──────────────────── */}
      {myActiveAlertId && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          textAlign: "center", color: "#fff", padding: 24,
          animation: "sos-flash-bg 0.9s infinite ease-in-out"
        }}>
          <div style={{ animation: "sos-slide-in 0.4s ease both", maxWidth: 420 }}>
            <div style={{
              width: 100, height: 100, borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              border: "3px solid rgba(255,255,255,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "3rem", margin: "0 auto 24px",
              animation: "sos-icon-pulse 1s infinite ease-in-out"
            }}>
              🚨
            </div>
            <div style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.75, marginBottom: 8 }}>
              Your SOS is Active
            </div>
            <h1 style={{ fontSize: "2rem", fontWeight: 900, marginBottom: 12 }}>
              Broadcasting to Nearby Devices
            </h1>
            <p style={{ opacity: 0.85, fontSize: "0.95rem", lineHeight: 1.6, marginBottom: 28 }}>
              Your GPS coordinates are being shared with<br />
              nearby Zensit users.{" "}
              <strong>Stay calm — help is coming.</strong>
            </p>
            <button type="button" onClick={cancelMySOS} style={{
              background: "#fff", color: "#b91c1c", border: "none",
              padding: "16px 32px", borderRadius: 14, fontWeight: 900,
              cursor: "pointer", fontSize: "1rem", width: "100%"
            }}>
              ✓ I&apos;m Safe — Cancel SOS
            </button>
          </div>
        </div>
      )}

      {/* ── SOS BUTTON — top-right corner, hidden while SOS is active ─── */}
      {!myActiveAlertId && (
        <div style={{
          position: "fixed",
          top: 15,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9000,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6
        }}>
          {/* Tooltip above button during press */}
          {isPressing && (
            <div style={{
              background: "rgba(10,12,20,0.92)",
              border: "1px solid rgba(220,38,38,0.4)",
              padding: "4px 8px",
              borderRadius: 6,
              fontSize: "0.65rem",
              color: "#fca5a5",
              fontWeight: 700,
              whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)"
            }}>
              Keep holding... {Math.round(pressProgress)}%
            </div>
          )}

          {/* Pill Container */}
          <button
            type="button"
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            style={{
              position: "relative",
              height: 38,
              minWidth: 140,
              borderRadius: 20,
              background: isPressing
                ? `rgba(220, 38, 38, ${0.15 + (pressProgress / 120)})`
                : "rgba(220, 38, 38, 0.1)",
              border: `1.5px solid ${isPressing ? "#ef4444" : "rgba(220, 38, 38, 0.4)"}`,
              boxShadow: isPressing
                ? `0 0 15px rgba(239, 68, 68, ${0.2 + pressProgress / 200})`
                : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "0 16px",
              color: "#fca5a5",
              fontWeight: 800,
              fontSize: "0.8rem",
              letterSpacing: "0.03em",
              userSelect: "none",
              overflow: "hidden",
              transform: isPressing ? `scale(${1 + pressProgress / 1000})` : "scale(1)",
              transition: "transform 0.08s ease, background 0.1s ease, border-color 0.2s ease"
            }}
            title="Hold 5 seconds to broadcast Emergency SOS"
          >
            {/* Linear background progress bar */}
            {isPressing && (
              <div style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${pressProgress}%`,
                background: "rgba(239, 68, 68, 0.25)",
                zIndex: 0,
                transition: "width 0.05s linear",
                pointerEvents: "none"
              }} />
            )}

            <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 6 }}>
              <span>🚨</span>
              <span>SOS <span style={{ opacity: 0.8, fontWeight: 500 }}>(Hold 5s)</span></span>
            </span>
          </button>
        </div>
      )}
    </>
  );
}
