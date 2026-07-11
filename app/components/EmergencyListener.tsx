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
  const [pressProgress, setPressProgress] = useState(0); // 0 to 100
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
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Sirens sound generator using Web Audio API
  const startSiren = () => {
    try {
      if (audioCtxRef.current) return; // Already running
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

      // Alternating frequency siren
      let isHigh = false;
      sirenIntervalRef.current = setInterval(() => {
        if (oscRef.current) {
          oscRef.current.frequency.setValueAtTime(isHigh ? 950 : 650, ctx.currentTime);
          isHigh = !isHigh;
        }
      }, 400);
    } catch (e) {
      console.warn("Audio Context block:", e);
    }
  };

  const stopSiren = () => {
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current);
      sirenIntervalRef.current = null;
    }
    if (oscRef.current) {
      try { oscRef.current.stop(); } catch {}
      oscRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
  };

  // Get active profile from localStorage and update periodically
  useEffect(() => {
    const loadProfile = () => {
      const stored = localStorage.getItem("zensit_user_profiles");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.length > 0) {
            // Check if there is active selection, otherwise first profile
            setActiveProfile(parsed[0]);
          }
        } catch {}
      }
    };
    loadProfile();
    const interval = setInterval(loadProfile, 4000);
    return () => clearInterval(interval);
  }, []);

  // Monitor location tag
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setLocalCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // Listen for firestore emergency alerts
  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, "emergency_alerts"),
      where("resolved", "==", false)
    );

    const unsub = onSnapshot(q, (snap) => {
      const alerts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filter alerts: either matching same profile OR nearby GPS (within 5 km)
      const matches = alerts.filter((alert: any) => {
        // Exclude alert broadcasted by local client
        if (alert.id === myActiveAlertId) return false;
        
        // Match 1: Same profile name
        const sameProfile = activeProfile && alert.profileName === activeProfile.name;
        
        // Match 2: Same GPS location (within 5km)
        let isNearby = false;
        if (localCoords && alert.gps) {
          const dist = getDistance(localCoords.lat, localCoords.lon, alert.gps.lat, alert.gps.lon);
          if (dist <= 5) {
            isNearby = true;
          }
        }
        
        return sameProfile || isNearby;
      });

      setActiveAlerts(matches);
      if (matches.length > 0) {
        startSiren();
      } else {
        stopSiren();
      }
    });

    return () => {
      unsub();
      stopSiren();
    };
  }, [activeProfile, localCoords, myActiveAlertId]);

  // Handle SOS button logic (Touch/Mouse events)
  const handlePressStart = () => {
    setIsPressing(true);
    setPressProgress(0);

    const startTime = Date.now();
    const duration = 2000; // 2 seconds

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setPressProgress(pct);
      if (elapsed >= duration) {
        clearInterval(progressIntervalRef.current);
      }
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
    if (!db) {
      alert("Database connection offline.");
      return;
    }

    let lat = 20.5937;
    let lon = 78.9629;

    if (navigator.geolocation) {
      try {
        const pos: any = await new Promise((res, rej) => {
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 });
        });
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      } catch {}
    }

    const pName = activeProfile?.name || "Anonymous User";
    const pAllergies = activeProfile?.allergies || "Unknown Allergens";

    try {
      const docRef = await addDoc(collection(db, "emergency_alerts"), {
        profileName: pName,
        allergies: pAllergies,
        gps: { lat, lon },
        timestamp: new Date().toISOString(),
        resolved: false
      });
      setMyActiveAlertId(docRef.id);
      alert("🚨 SOS Emergency Alert broadcasted successfully to all nearby devices!");
    } catch (e) {
      console.error(e);
      alert("Failed to broadcast SOS.");
    }
  };

  const cancelMySOS = async () => {
    if (!db || !myActiveAlertId) return;
    try {
      await updateDoc(doc(db, "emergency_alerts", myActiveAlertId), {
        resolved: true
      });
      setMyActiveAlertId(null);
      alert("SOS resolved.");
    } catch (e) {
      console.error(e);
    }
  };

  const resolveExternalAlert = async (alertId: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, "emergency_alerts", alertId), {
        resolved: true
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Render modal overlay if there's an active alert
  return (
    <>
      {/* 🚨 ACTIVE EMERGENCY ALARM OVERLAY */}
      {activeAlerts.map((alert: any) => {
        let distStr = "unknown distance";
        if (localCoords && alert.gps) {
          const d = getDistance(localCoords.lat, localCoords.lon, alert.gps.lat, alert.gps.lon);
          distStr = `~${d.toFixed(2)} km away`;
        }
        return (
          <div key={alert.id} style={{
            position: "fixed",
            inset: 0,
            background: "rgba(127, 29, 29, 0.96)",
            backdropFilter: "blur(10px)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            textAlign: "center",
            color: "#fff",
            animation: "alert-flash 1s infinite alternate"
          }}>
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes alert-flash {
                from { background: rgba(127, 29, 29, 0.96); }
                to { background: rgba(185, 28, 28, 0.98); }
              }
              @keyframes pulse-sos-glow {
                0% { transform: scale(1); box-shadow: 0 0 10px rgba(239, 68, 68, 0.5); }
                50% { transform: scale(1.08); box-shadow: 0 0 25px rgba(239, 68, 68, 0.8); }
                100% { transform: scale(1); box-shadow: 0 0 10px rgba(239, 68, 68, 0.5); }
              }
            `}} />

            <div style={{
              width: 100, height: 100, borderRadius: "50%", background: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "3rem",
              marginBottom: 24, animation: "pulse-sos-glow 1.5s infinite"
            }}>
              🚨
            </div>

            <h1 style={{ fontSize: "2.1rem", fontWeight: 900, marginBottom: 12, textTransform: "uppercase", letterSpacing: "1px" }}>
              Emergency Help Request
            </h1>

            <p style={{ fontSize: "1.2rem", fontWeight: 700, background: "rgba(0,0,0,0.3)", padding: "12px 24px", borderRadius: 12, marginBottom: 16 }}>
              👤 Profile: {alert.profileName}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 500, marginBottom: 32 }}>
              <div style={{ fontSize: "1rem", opacity: 0.9 }}>
                <strong>📍 GPS Proximity:</strong> {distStr}
              </div>
              <div style={{ fontSize: "1rem", opacity: 0.9 }}>
                <strong>⚠️ Known Allergies:</strong> {alert.allergies}
              </div>
              <div style={{ fontSize: "0.85rem", opacity: 0.7, fontStyle: "italic" }}>
                Sent at: {new Date(alert.timestamp).toLocaleTimeString()}
              </div>
            </div>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${alert.gps?.lat},${alert.gps?.lon}`}
                target="_blank"
                rel="noreferrer"
                className="btn"
                style={{ background: "#22c55e", color: "#fff", padding: "14px 28px", fontWeight: 800, fontSize: "1rem" }}
              >
                🗺️ Open Directions Map
              </a>

              <button
                type="button"
                onClick={() => resolveExternalAlert(alert.id)}
                className="btn"
                style={{ background: "rgba(255,255,255,0.2)", color: "#fff", padding: "14px 28px", border: "1px solid #fff" }}
              >
                ✓ Resolve Alert (Helped)
              </button>

              <button
                type="button"
                onClick={() => stopSiren()}
                className="btn"
                style={{ background: "transparent", color: "rgba(255,255,255,0.7)", padding: "14px 28px" }}
              >
                🔕 Mute Siren
              </button>
            </div>
          </div>
        );
      })}

      {/* 🚨 LOCAL ACTIVE SOS BANNER (SENDER STATUS) */}
      {myActiveAlertId && (
        <div style={{
          position: "fixed",
          top: 80,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(220, 38, 38, 0.95)",
          border: "1.5px solid rgba(255,255,255,0.3)",
          boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
          padding: "16px 24px",
          borderRadius: "16px",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: 16,
          color: "#fff",
          maxWidth: "90%",
          backdropFilter: "blur(10px)"
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>🚨 SOS Broadcast Active</div>
            <div style={{ fontSize: "0.8rem", opacity: 0.9 }}>Broadcasting coordinates to nearby Zensit profiles...</div>
          </div>
          <button
            type="button"
            onClick={cancelMySOS}
            style={{
              background: "#fff", color: "#b91c1c", border: "none",
              padding: "8px 16px", borderRadius: 10, fontWeight: 800, cursor: "pointer", fontSize: "0.8rem"
            }}
          >
            Cancel SOS
          </button>
        </div>
      )}

      {/* 🔴 FLOATING SOS ACTION BUTTON (FAB) */}
      <div style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 999,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end"
      }}>
        {isPressing && (
          <div style={{
            background: "rgba(8, 12, 20, 0.9)",
            border: "1px solid var(--border)",
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: "0.75rem",
            color: "#fb7171",
            marginBottom: 8,
            fontWeight: 700,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
          }}>
            Hold 2s to broadcast SOS: {Math.round(pressProgress)}%
          </div>
        )}
        
        <button
          type="button"
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
          style={{
            width: 58,
            height: 58,
            borderRadius: "50%",
            background: "rgba(220, 38, 38, 0.95)",
            border: "2px solid rgba(255, 255, 255, 0.2)",
            boxShadow: isPressing 
              ? `0 0 ${20 + pressProgress/4}px rgba(220, 38, 38, 0.7)` 
              : "0 4px 15px rgba(220, 38, 38, 0.4)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.3rem",
            color: "#fff",
            fontWeight: 900,
            userSelect: "none",
            transform: isPressing ? `scale(${1 + pressProgress / 300})` : "scale(1)",
            transition: "transform 0.1s ease, box-shadow 0.1s ease",
            animation: "pulse-sos-glow 3s infinite"
          }}
          title="Press & Hold for 2s to broadcast SOS Alert"
        >
          🚨
        </button>
      </div>
    </>
  );
}
