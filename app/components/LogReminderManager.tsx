"use client";

import { useEffect, useState } from "react";

interface ReminderSettings {
  enabled: boolean;
  intervalHours: number;
  lastNotified: number;
}

export default function LogReminderManager() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isStandalone, setIsStandalone] = useState(false);
  const [settings, setSettings] = useState<ReminderSettings>({
    enabled: false,
    intervalHours: 4,
    lastNotified: 0
  });
  const [isOpen, setIsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Check notification support
      if (!("Notification" in window)) {
        setPermission("unsupported");
      } else {
        setPermission(Notification.permission);
      }

      // Check if installed as standalone PWA
      const isPWA = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
      setIsStandalone(isPWA);

      // Load saved settings
      try {
        const saved = localStorage.getItem("zensit_reminder_settings");
        if (saved) {
          setSettings(JSON.parse(saved));
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Save settings helper
  const updateSettings = (newSettings: Partial<ReminderSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem("zensit_reminder_settings", JSON.stringify(updated));
      return updated;
    });
  };

  // Request notification permissions
  const requestPermission = async () => {
    if (!("Notification" in window)) {
      alert("Notifications are not supported in this browser.");
      return;
    }

    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      if (res === "granted") {
        updateSettings({ enabled: true });
        showNotification("ZenSit Reminders Activated! 🌿", "You will receive periodic popup reminders to log your allergy symptoms.");
        showToast("Notification permission granted!");
      } else if (res === "denied") {
        updateSettings({ enabled: false });
        alert("Notification permission was denied. Please enable notifications in your browser/device settings.");
      }
    } catch (e) {
      console.error("Error requesting notification permission:", e);
    }
  };

  // Trigger system notification
  const showNotification = (title: string, body: string) => {
    if (typeof window === "undefined" || Notification.permission !== "granted") return;

    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body,
            icon: "/icon-192x192.png",
            badge: "/icon-192x192.png",
            tag: "zensit-reminder",
            vibrate: [200, 100, 200],
            data: { url: "/wizard" }
          } as any);
        });
      } else {
        new Notification(title, {
          body,
          icon: "/icon-192x192.png",
        });
      }
    } catch (e) {
      console.error("Failed to show notification:", e);
      try {
        new Notification(title, { body, icon: "/icon-192x192.png" });
      } catch (err) {
        console.error("Fallback notification failed:", err);
      }
    }
  };

  // Test notification trigger
  const testNotification = () => {
    if (Notification.permission !== "granted") {
      requestPermission();
      return;
    }
    showNotification(
      "ZenSit Allergy Log Reminder 🩺",
      "Time for a quick symptom log! Tracking your environment keeps flare-ups under control."
    );
    showToast("Test notification dispatched!");
  };

  // Toast feedback
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Periodic reminder interval checker
  useEffect(() => {
    if (!settings.enabled || permission !== "granted") return;

    const checkIntervalMs = 60 * 1000; // Check every 60 seconds
    const interval = setInterval(() => {
      const now = Date.now();
      const intervalMs = settings.intervalHours * 60 * 60 * 1000;
      if (now - settings.lastNotified >= intervalMs) {
        showNotification(
          "ZenSit Symptom Check-in 🌿",
          `It's time for your ${settings.intervalHours}-hour symptom & climate log.`
        );
        updateSettings({ lastNotified: now });
      }
    }, checkIntervalMs);

    return () => clearInterval(interval);
  }, [settings.enabled, settings.intervalHours, settings.lastNotified, permission]);

  return (
    <>
      {/* Toast popup */}
      {toastMessage && (
        <div style={{
          position: "fixed",
          bottom: 80,
          right: 20,
          zIndex: 9999,
          background: "rgba(15, 23, 42, 0.95)",
          color: "#818cf8",
          border: "1px solid rgba(129, 140, 248, 0.4)",
          borderRadius: 12,
          padding: "10px 18px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
          fontWeight: 700,
          fontSize: "0.85rem",
          display: "flex",
          alignItems: "center",
          gap: 8,
          backdropFilter: "blur(10px)",
          animation: "fade-in 0.3s ease"
        }}>
          ✨ {toastMessage}
        </div>
      )}

      {/* Floating Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 999,
          background: settings.enabled ? "var(--indigo)" : "rgba(30, 41, 59, 0.85)",
          color: "#fff",
          border: settings.enabled ? "1px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.12)",
          borderRadius: "50%",
          width: 48,
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.2rem",
          cursor: "pointer",
          boxShadow: settings.enabled ? "0 0 20px rgba(99, 102, 241, 0.5)" : "0 4px 12px rgba(0,0,0,0.3)",
          backdropFilter: "blur(10px)",
          transition: "all 0.3s ease"
        }}
        title="Background Reminder Settings"
      >
        🔔
        {settings.enabled && (
          <span style={{
            position: "absolute",
            top: 2,
            right: 2,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#22c55e",
            border: "2px solid #000"
          }} />
        )}
      </button>

      {/* Reminder Settings Modal */}
      {isOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20
        }}>
          <div className="card-hi" style={{
            width: "100%",
            maxWidth: 480,
            padding: 28,
            borderRadius: 20,
            background: "rgba(15, 23, 42, 0.95)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            position: "relative",
            boxShadow: "0 20px 50px rgba(0,0,0,0.6)"
          }}>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                position: "absolute",
                top: 18,
                right: 18,
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                fontSize: "1.2rem",
                cursor: "pointer"
              }}
            >
              ✕
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: "rgba(99, 102, 241, 0.15)",
                border: "1px solid rgba(99, 102, 241, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.3rem"
              }}>
                🔔
              </div>
              <div>
                <h3 style={{ fontWeight: 900, color: "#fff", fontSize: "1.2rem", margin: 0 }}>
                  Background Log Reminders
                </h3>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "2px 0 0" }}>
                  {isStandalone ? "📱 Installed Phone App Mode" : "🌐 Browser PWA Mode"}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Permission Banner */}
              {permission !== "granted" ? (
                <div style={{
                  padding: 16,
                  borderRadius: 14,
                  background: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10
                }}>
                  <div style={{ fontSize: "0.85rem", color: "#fbbf24", fontWeight: 700 }}>
                    ⚠️ Popup Notifications Disabled
                  </div>
                  <div style={{ fontSize: "0.78125rem", color: "var(--text)", lineHeight: 1.5 }}>
                    Enable browser/system popup permissions so ZenSit can alert you when it's time to log allergy symptoms.
                  </div>
                  <button
                    onClick={requestPermission}
                    className="btn btn-primary btn-sm"
                    style={{ width: "100%", marginTop: 4 }}
                  >
                    Enable Popup Notifications
                  </button>
                </div>
              ) : (
                <div style={{
                  padding: 14,
                  borderRadius: 14,
                  background: "rgba(34, 197, 94, 0.1)",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}>
                  <span style={{ fontSize: "0.85rem", color: "#4ade80", fontWeight: 700 }}>
                    ✓ Popup Notifications Allowed
                  </span>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={settings.enabled}
                      onChange={e => updateSettings({ enabled: e.target.checked })}
                      style={{ accentColor: "var(--indigo)", width: 18, height: 18, cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "0.8125rem", color: "#fff", fontWeight: 700 }}>
                      {settings.enabled ? "Active" : "Paused"}
                    </span>
                  </label>
                </div>
              )}

              {/* Interval Selection */}
              <div>
                <label className="t-label" style={{ display: "block", marginBottom: 8, color: "#fff" }}>
                  ⏰ Reminder Frequency:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {[1, 2, 4, 8, 12, 24].map(h => (
                    <button
                      key={h}
                      onClick={() => updateSettings({ intervalHours: h })}
                      style={{
                        padding: "10px 8px",
                        borderRadius: 10,
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        background: settings.intervalHours === h ? "var(--indigo)" : "rgba(255,255,255,0.04)",
                        border: settings.intervalHours === h ? "1px solid rgba(255,255,255,0.4)" : "1px solid var(--border)",
                        color: settings.intervalHours === h ? "#fff" : "var(--muted)",
                        transition: "all 0.2s ease"
                      }}
                    >
                      Every {h}h
                    </button>
                  ))}
                </div>
              </div>

              {/* Test Action */}
              <div style={{
                paddingTop: 16,
                borderTop: "1px solid var(--border)",
                display: "flex",
                gap: 10,
                justifyContent: "flex-end"
              }}>
                <button
                  onClick={testNotification}
                  className="btn btn-ghost btn-sm"
                  style={{ width: "100%" }}
                >
                  ⚡ Send Test Popup Notification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
