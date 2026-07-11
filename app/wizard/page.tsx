"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc } from "firebase/firestore";

type SymptomKey = "vomiting" | "headache" | "itching" | "redness" | "mucus";
const SYMPTOMS: { key: SymptomKey; icon: string; label: string }[] = [
  { key: "itching", icon: "😣", label: "Skin Itching" },
  { key: "redness", icon: "🔴", label: "Skin Redness" },
  { key: "headache", icon: "🤕", label: "Headache" },
  { key: "mucus", icon: "💧", label: "Excess Mucus" },
  { key: "vomiting", icon: "🤢", label: "Nausea / Vomiting" },
];
const LOCS = ["Home", "Hospital", "School", "Work", "Travel", "Other"];

const STEPS = [
  { label: "Profile", icon: "👤" },
  { label: "Symptoms", icon: "🩺" },
  { label: "Climate", icon: "🌡️" },
];

export default function Wizard() {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSavedState] = useState(false);

  interface UserProfile {
    id: string;
    name: string;
    allergies: string;
    color: string;
    feeling: string;
  }

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>("default");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: "", allergies: "Pollen", color: "#6366f1", feeling: "Calm 😌" });

  const [profile, setProfile] = useState({
    name: "Nandu",
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    location: "Home",
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("zensit_user_profiles");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setProfiles(parsed);
          if (parsed.length > 0) {
            // Find active profile
            const active = parsed.find((p: any) => p.id === activeProfileId) || parsed[0];
            setActiveProfileId(active.id);
            setProfile(p => ({ ...p, name: active.name }));
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        const seed = [{ id: "default", name: "Nandu", allergies: "Pollen", color: "#6366f1", feeling: "Calm 😌" }];
        localStorage.setItem("zensit_user_profiles", JSON.stringify(seed));
        setProfiles(seed);
        setActiveProfileId("default");
      }
    }
  }, []);

  const addProfile = () => {
    if (!newProfile.name.trim()) return;
    const name = newProfile.name.trim();
    if (name.length > 100) {
      alert("Name is too long");
      return;
    }
    const newP: UserProfile = {
      id: Math.random().toString(36).slice(2, 9),
      name,
      allergies: newProfile.allergies,
      color: newProfile.color,
      feeling: newProfile.feeling,
    };
    const updated = [...profiles, newP];
    setProfiles(updated);
    localStorage.setItem("zensit_user_profiles", JSON.stringify(updated));
    setActiveProfileId(newP.id);
    setProfile(p => ({ ...p, name: newP.name }));
    setShowAddForm(false);
    setNewProfile({ name: "", allergies: "Pollen", color: "#6366f1", feeling: "Calm 😌" });
  };

  const deleteProfile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === "default") return;
    const filtered = profiles.filter(p => p.id !== id);
    setProfiles(filtered);
    localStorage.setItem("zensit_user_profiles", JSON.stringify(filtered));
    if (activeProfileId === id) {
      const fallback = filtered[0] || { id: "default", name: "Nand", allergies: "Pollen", color: "#6366f1" };
      setActiveProfileId(fallback.id);
      setProfile(p => ({ ...p, name: fallback.name }));
    }
  };

  const [symptoms, setSymptoms] = useState<Record<SymptomKey, { on: boolean; note: string }>>(
    Object.fromEntries(SYMPTOMS.map(s => [s.key, { on: false, note: "" }])) as any
  );
  const [sneezes, setSneezes] = useState(0);
  const [sneezeNote, setSneezeNote] = useState("");

  const [wx, setWx] = useState({ temp: "—", hum: "—", score: 0, label: "Fetching…", color: "#6366f1" });
  const [food, setFood] = useState("");
  const [meds, setMeds] = useState("");

  useEffect(() => {
    if (step !== 2) return;
    (async () => {
      try {
        let lat = "20.5937", lon = "78.9629";
        if (navigator.geolocation) {
          await new Promise<void>(r =>
            navigator.geolocation.getCurrentPosition(
              p => { lat = String(p.coords.latitude); lon = String(p.coords.longitude); r(); },
              () => r(), { timeout: 5000 }
            )
          );
        }
        const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
        if (!res.ok) throw new Error();
        const d = await res.json();
        const t = Math.round(d.ambient_temp), h = d.humidity;
        let score = 100;
        if (h > 65 || h < 35) score -= 35;
        if (t > 28 || t < 16) score -= 30;
        const s = Math.max(10, score);
        setWx({
          temp: `${t}°C`, hum: `${h}%`, score: s,
          label: s >= 75 ? "Good" : s >= 50 ? "Moderate" : "Poor — Risk",
          color: s >= 75 ? "#22c55e" : s >= 50 ? "#f59e0b" : "#ef4444",
        });
      } catch {
        setWx({ temp: "25°C", hum: "55%", score: 60, label: "Estimated", color: "#f59e0b" });
      }
    })();
  }, [step]);

  const toggle = (k: SymptomKey) =>
    setSymptoms(p => ({ ...p, [k]: { ...p[k], on: !p[k].on } }));

  const handleSave = async () => {
    if (!db) { alert("Database not configured"); return; }
    setSaving(true);
    try {
      const active = profiles.find(p => p.id === activeProfileId) || { feeling: "Calm 😌" };
      await addDoc(collection(db, "health_logs"), {
        profile: {
          ...profile,
          feeling: active.feeling || "Calm 😌",
          locationTag: profile.location // Satisfy firestore.rules check for 'locationTag'
        },
        symptoms,
        sneezing: { count: sneezes, note: sneezeNote },
        exposure: { temperature: wx.temp, humidity: wx.hum, foodIntake: food, medicines: meds },
        timestamp: new Date().toISOString(),
      });
      setSavedState(true);
    } catch (e) {
      console.error(e);
      alert("Save failed — check console");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setSavedState(false); setStep(0);
    setSymptoms(Object.fromEntries(SYMPTOMS.map(s => [s.key, { on: false, note: "" }])) as any);
    setSneezes(0); setSneezeNote(""); setFood(""); setMeds("");
  };

  // ─── Success screen ───────────────────────────────────────────────────────
  if (saved) return (
    <div style={{
      minHeight: "100svh", background: "var(--bg)", display: "flex", alignItems: "center",
      justifyContent: "center", padding: 24, fontFamily: "var(--font)"
    }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <div style={{ fontSize: "4rem", marginBottom: 20 }}>✅</div>
        <h2 style={{ fontWeight: 900, fontSize: "1.5rem", color: "#fff", marginBottom: 10 }}>Log saved!</h2>
        <p className="t-body" style={{ marginBottom: 32, fontSize: "0.9rem" }}>
          Your allergy telemetry has been recorded in Firebase.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={reset} className="btn btn-primary">Log another</button>
          <a href="/admin" className="btn btn-ghost">View Dashboard</a>
        </div>
      </div>
    </div>
  );

  // ─── Main layout ──────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100svh", background: "var(--bg)", fontFamily: "var(--font)",
      display: "flex", flexDirection: "column"
    }}>

      {/* Background glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: "-20%", right: "-10%", width: 500, height: 500,
          borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)"
        }} />
      </div>

      {/* Top bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50, background: "rgba(8,12,20,0.9)",
        backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border)"
      }}>
        <div className="container" style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900, fontSize: "1.05rem", color: "#fff", textDecoration: "none", letterSpacing: "-0.03em" }}>
            <img src="/icon-192x192.png" alt="Zensit" style={{ width: 24, height: 24, objectFit: "contain" }} />
            Zen<span style={{ color: "#818cf8" }}>sit</span>
          </a>
          <a href="/admin" className="btn btn-ghost btn-sm">Dashboard →</a>
        </div>
      </div>

      {/* Step progress */}
      <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "16px 0" }}>
        <div className="container">
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className={`step-dot ${i < step ? "done" : i === step ? "active" : "pending"}`}>
                    {i < step ? "✓" : i + 1}
                  </div>
                  <span style={{
                    fontSize: "0.8125rem", fontWeight: 600,
                    color: i === step ? "#a5b4fc" : i < step ? "#818cf8" : "var(--dim)",
                    display: "none"
                  }} className="sm-label">{s.label}</span>
                  <span style={{
                    fontSize: "0.8125rem", fontWeight: 600, whiteSpace: "nowrap",
                    color: i === step ? "#a5b4fc" : i < step ? "#818cf8" : "var(--dim)"
                  }}>
                    {s.icon} {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`step-line ${i < step ? "done" : "pending"}`}
                    style={{ margin: "0 12px" }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form area */}
      <div style={{ flex: 1, padding: "28px 0 100px" }}>
        <div className="container" style={{ maxWidth: 560 }}>

          {/* ── STEP 0 – Profile ───────────────────────────────────────── */}
          {step === 0 && (
            <div className="anim-fadeup" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ fontWeight: 800, fontSize: "1.2rem", color: "#fff" }}>👤 Patient Profile</h2>
                <span className="pill pill-indigo">Select or Create</span>
              </div>

              {/* Profiles Selector Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                {profiles.map(p => {
                  const initials = p.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                  const active = activeProfileId === p.id;
                  return (
                    <div key={p.id}
                      onClick={() => {
                        setActiveProfileId(p.id);
                        setProfile(prev => ({ ...prev, name: p.name }));
                      }}
                      className="card"
                      style={{
                        padding: "16px",
                        cursor: "pointer",
                        border: active ? `1.5px solid ${p.color}` : "1px solid var(--border)",
                        background: active ? "rgba(99, 102, 241, 0.05)" : "var(--surface)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        position: "relative"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: p.color,
                          color: "#fff",
                          fontWeight: 800,
                          fontSize: "0.85rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}>
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#fff" }}>{p.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "capitalize" }}>
                            {p.allergies} Triggers • {p.feeling || "Calm 😌"}
                          </div>
                        </div>
                      </div>

                      {p.id !== "default" && (
                        <button
                          type="button"
                          onClick={(e) => deleteProfile(p.id, e)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "rgba(239, 68, 68, 0.7)",
                            cursor: "pointer",
                            fontSize: "1.05rem",
                            padding: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                          title="Delete Profile"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Add Profile Card */}
                {!showAddForm && (
                  <div
                    onClick={() => setShowAddForm(true)}
                    className="card"
                    style={{
                      padding: "16px",
                      cursor: "pointer",
                      border: "1px dashed var(--border-hi)",
                      background: "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      minHeight: 70
                    }}
                  >
                    <span style={{ fontSize: "1.2rem", color: "#818cf8" }}>+</span>
                    <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#818cf8" }}>Add User Profile</span>
                  </div>
                )}
              </div>

              {/* Add Profile Form */}
              {showAddForm && (
                <div className="card-hi" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontWeight: 800, fontSize: "1rem", color: "#fff" }}>👤 Create User Profile</h3>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "4px 8px" }} onClick={() => setShowAddForm(false)}>✕</button>
                  </div>

                  <div>
                    <label className="t-label" style={{ display: "block", marginBottom: 6 }}>Full Name</label>
                    <input className="input" placeholder="e.g. Brahman..." value={newProfile.name}
                      onChange={e => setNewProfile(prev => ({ ...prev, name: e.target.value }))} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
                    <div>
                      <label className="t-label" style={{ display: "block", marginBottom: 6 }}>Primary Allergen</label>
                      <select
                        className="input"
                        value={newProfile.allergies}
                        onChange={e => setNewProfile(prev => ({ ...prev, allergies: e.target.value }))}
                        style={{ background: "rgba(8,12,20,0.9)", color: "var(--text)" }}
                      >
                        {["Pollen", "Dust", "Pets", "Food", "Air Quality", "Other"].map(a => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="t-label" style={{ display: "block", marginBottom: 6 }}>General Feeling</label>
                      <select
                        className="input"
                        value={newProfile.feeling}
                        onChange={e => setNewProfile(prev => ({ ...prev, feeling: e.target.value }))}
                        style={{ background: "rgba(8,12,20,0.9)", color: "var(--text)" }}
                      >
                        {["Calm 😌", "Energetic ⚡", "Fatigued 😴", "Anxious 😰", "Irritated 🤧"].map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="t-label" style={{ display: "block", marginBottom: 6 }}>Theme Accent</label>
                      <div style={{ display: "flex", gap: 8, height: 44, alignItems: "center" }}>
                        {[
                          { val: "#6366f1", label: "Indigo" },
                          { val: "#ec4899", label: "Rose" },
                          { val: "#10b981", label: "Emerald" },
                          { val: "#f59e0b", label: "Amber" },
                          { val: "#3b82f6", label: "Blue" }
                        ].map(color => (
                          <button
                            key={color.val}
                            type="button"
                            onClick={() => setNewProfile(prev => ({ ...prev, color: color.val }))}
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              background: color.val,
                              border: newProfile.color === color.val ? "2px solid #fff" : "none",
                              cursor: "pointer",
                              boxShadow: newProfile.color === color.val ? `0 0 10px ${color.val}` : "none",
                              transition: "transform 0.1s"
                            }}
                            title={color.label}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}>Cancel</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={addProfile}>Create Profile</button>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="t-label" style={{ display: "block", marginBottom: 8 }}>Date</label>
                  <input className="input" type="date" value={profile.date}
                    onChange={e => setProfile(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <label className="t-label" style={{ display: "block", marginBottom: 8 }}>Time</label>
                  <input className="input" type="time" value={profile.time}
                    onChange={e => setProfile(p => ({ ...p, time: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="t-label" style={{ display: "block", marginBottom: 10 }}>Location</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {LOCS.map(l => (
                    <button key={l} type="button"
                      className={`loc-tag${profile.location === l ? " active" : ""}`}
                      onClick={() => setProfile(p => ({ ...p, location: l }))}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 1 – Symptoms ──────────────────────────────────────── */}
          {step === 1 && (
            <div className="anim-fadeup" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.2rem", color: "#fff" }}>🩺 Symptom Log</h2>

              {/* Sneeze counter */}
              <div className="card" style={{ padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.9375rem" }}>😤 Sneezing</div>
                    <div className="t-label" style={{ marginTop: 3 }}>Count in 10 seconds</div>
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 0,
                    background: "var(--surface-2)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)"
                  }}>
                    <button type="button" onClick={() => setSneezes(n => Math.max(0, n - 1))}
                      style={{
                        width: 44, height: 44, background: "none", border: "none", color: "var(--muted)",
                        cursor: "pointer", fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center"
                      }}>−</button>
                    <span style={{
                      minWidth: 40, textAlign: "center", fontWeight: 900, fontSize: "1.25rem",
                      color: "#818cf8", letterSpacing: "-0.04em"
                    }}>{sneezes}</span>
                    <button type="button" onClick={() => setSneezes(n => n + 1)}
                      style={{
                        width: 44, height: 44, background: "none", border: "none", color: "var(--muted)",
                        cursor: "pointer", fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center"
                      }}>+</button>
                  </div>
                </div>
                {sneezes > 0 && (
                  <input className="input" value={sneezeNote} onChange={e => setSneezeNote(e.target.value)}
                    placeholder="Trigger or context (optional)…" style={{ fontSize: "0.875rem" }} />
                )}
              </div>

              {/* Symptoms */}
              <label className="t-label">Active symptoms</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {SYMPTOMS.map(s => {
                  const on = symptoms[s.key].on;
                  return (
                    <div key={s.key}>
                      <div className={`sym-row${on ? " active" : ""}`} onClick={() => toggle(s.key)}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: "1.25rem" }}>{s.icon}</span>
                          <span style={{ fontWeight: 600, color: on ? "#fff" : "var(--text)", fontSize: "0.9375rem" }}>{s.label}</span>
                        </div>
                        <div className={`btn btn-sm ${on ? "btn-danger-active" : "btn-ghost"}`}
                          style={{ minWidth: 80, pointerEvents: "none" }}>
                          {on ? "● Active" : "○ Clear"}
                        </div>
                      </div>
                      {on && (
                        <div style={{ paddingTop: 8 }}>
                          <input className="input" value={symptoms[s.key].note}
                            onChange={e => setSymptoms(p => ({ ...p, [s.key]: { ...p[s.key], note: e.target.value } }))}
                            onClick={e => e.stopPropagation()}
                            placeholder={`Describe ${s.label.toLowerCase()} severity…`}
                            style={{ fontSize: "0.875rem" }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STEP 2 – Climate ──────────────────────────────────────── */}
          {step === 2 && (
            <div className="anim-fadeup" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.2rem", color: "#fff" }}>🌡️ Climate & Intake</h2>

              {/* Comfort ring */}
              <div className="card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <svg viewBox="0 0 88 88" style={{ width: 72, height: 72 }}>
                    <circle cx="44" cy="44" r="36" fill="none" strokeWidth="8" stroke="var(--surface-2)" />
                    <circle cx="44" cy="44" r="36" fill="none" strokeWidth="8"
                      stroke={wx.color} strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 36}`}
                      strokeDashoffset={`${2 * Math.PI * 36 * (1 - wx.score / 100)}`}
                      transform="rotate(-90 44 44)"
                      className="ring-fill" />
                  </svg>
                  <div style={{
                    position: "absolute", inset: 0, display: "flex", alignItems: "center",
                    justifyContent: "center", fontWeight: 900, fontSize: "0.9rem", color: "#fff"
                  }}>
                    {wx.score}%
                  </div>
                </div>
                <div>
                  <div className="t-label" style={{ marginBottom: 4 }}>Climate Comfort</div>
                  <div style={{ fontWeight: 800, fontSize: "1rem", color: wx.color }}>{wx.label}</div>
                  <div className="t-label" style={{ marginTop: 4, fontSize: "0.65rem" }}>Based on GPS weather</div>
                </div>
              </div>

              {/* Temp / Hum */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="wx-tile">
                  <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>🌡️</div>
                  <div className="t-label" style={{ marginBottom: 6 }}>Temperature</div>
                  <div style={{ fontWeight: 900, fontSize: "1.4rem", color: "#fb923c", letterSpacing: "-0.04em" }}>{wx.temp}</div>
                </div>
                <div className="wx-tile">
                  <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>💧</div>
                  <div className="t-label" style={{ marginBottom: 6 }}>Humidity</div>
                  <div style={{ fontWeight: 900, fontSize: "1.4rem", color: "#60a5fa", letterSpacing: "-0.04em" }}>{wx.hum}</div>
                </div>
              </div>

              {/* Food intake */}
              <div>
                <label className="t-label" style={{ display: "block", marginBottom: 8 }}>Recent food intake</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="input" value={food} onChange={e => setFood(e.target.value)}
                    placeholder="e.g. rice, dairy, wheat…" style={{ flex: 1, fontSize: "0.9rem" }} />
                </div>
              </div>

              {/* Meds */}
              <div>
                <label className="t-label" style={{ display: "block", marginBottom: 8 }}>Medications today</label>
                <textarea className="input" value={meds} onChange={e => setMeds(e.target.value)}
                  placeholder="Antihistamines, inhalers, eye drops…" rows={2}
                  style={{ fontSize: "0.9rem" }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed bottom navigation */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(8,12,20,0.95)", backdropFilter: "blur(20px)",
        borderTop: "1px solid var(--border)", padding: "14px 0"
      }}>
        <div className="container" style={{ maxWidth: 560, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)} disabled={step === 0}
            style={{ opacity: step === 0 ? 0 : 1, pointerEvents: step === 0 ? "none" : "auto" }}>
            ← Back
          </button>

          {/* Dot indicators */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                height: 6, borderRadius: 999,
                background: i === step ? "#6366f1" : i < step ? "#818cf8" : "var(--border)",
                width: i === step ? 24 : 6,
                transition: "all 0.2s",
              }} />
            ))}
          </div>

          {step < 2 ? (
            <button className="btn btn-primary" onClick={() => setStep(s => s + 1)}>
              Continue →
            </button>
          ) : (
            <button className="btn" onClick={handleSave} disabled={saving}
              style={{
                background: saving ? "var(--surface-2)" : "#22c55e", color: "#fff",
                boxShadow: saving ? "none" : "0 0 20px rgba(34,197,94,0.3)", opacity: saving ? 0.7 : 1
              }}>
              {saving ? "Saving…" : "✓ Save Log"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}