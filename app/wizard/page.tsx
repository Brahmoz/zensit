"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc } from "firebase/firestore";

type SymptomKey = "vomiting" | "headache" | "itching" | "redness" | "mucus" | "bleeding" | "eye_itching" | "breathing" | "coughing";
const SYMPTOMS: { key: SymptomKey; icon: string; label: string }[] = [
  { key: "itching",  icon: "😣", label: "Skin Itching" },
  { key: "redness",  icon: "🔴", label: "Skin Redness" },
  { key: "headache", icon: "🤕", label: "Headache" },
  { key: "mucus",    icon: "💧", label: "Excess Mucus" },
  { key: "vomiting", icon: "🤢", label: "Nausea / Vomiting" },
  { key: "bleeding", icon: "🩸", label: "Bleeding" },
  { key: "eye_itching", icon: "👁️", label: "Eye Itching/Watering" },
  { key: "breathing", icon: "😮‍💨", label: "Breathing Difficulty" },
  { key: "coughing", icon: "😷", label: "Dry Coughing" },
];
const LOCS = ["Home", "Hospital", "School", "Work", "Travel", "Other"];

const ALLERGENS = [
  { key: "pollen", icon: "🌳", label: "Pollen" },
  { key: "dust",   icon: "🧹", label: "Dust" },
  { key: "pets",   icon: "🐱", label: "Pets / Dander" },
  { key: "mold",   icon: "🍄", label: "Mold / Dampness" },
  { key: "perfume",icon: "🧴", label: "Perfumes / Chemicals" },
  { key: "smoke",  icon: "🚬", label: "Smoke / Smog" },
];

const EMOTIONS: { key: string; icon: string; label: string; color: string }[] = [
  { key: "happy",       icon: "😊", label: "Happy",       color: "#22c55e" },
  { key: "calm",        icon: "😌", label: "Calm",        color: "#6366f1" },
  { key: "anxious",     icon: "😰", label: "Anxious",     color: "#f59e0b" },
  { key: "irritated",   icon: "😤", label: "Irritated",   color: "#f97316" },
  { key: "fatigued",    icon: "😴", label: "Fatigued",    color: "#60a5fa" },
  { key: "sad",         icon: "😢", label: "Sad",         color: "#818cf8" },
  { key: "overwhelmed", icon: "🤯", label: "Overwhelmed", color: "#ef4444" },
  { key: "hopeful",     icon: "🌟", label: "Hopeful",     color: "#34d399" },
];

const URINE_COLORS: { key: string; label: string; color: string; hex: string }[] = [
  { key: "clear",       label: "Clear",        color: "#e0f2fe", hex: "rgba(224,242,254,0.7)" },
  { key: "light",       label: "Light Yellow", color: "#fef9c3", hex: "rgba(254,249,195,0.7)" },
  { key: "yellow",      label: "Yellow",       color: "#fde047", hex: "rgba(253,224,71,0.7)" },
  { key: "dark",        label: "Dark Yellow",  color: "#ca8a04", hex: "rgba(202,138,4,0.7)" },
  { key: "orange",      label: "Orange",       color: "#ea580c", hex: "rgba(234,88,12,0.7)" },
  { key: "brown",       label: "Brown",        color: "#78350f", hex: "rgba(120,53,15,0.7)" },
];

const SLEEP_QUALITY: { key: string; icon: string; label: string; color: string }[] = [
  { key: "great",  icon: "✨", label: "Great",  color: "#22c55e" },
  { key: "good",   icon: "😊", label: "Good",   color: "#6366f1" },
  { key: "fair",   icon: "😐", label: "Fair",   color: "#f59e0b" },
  { key: "poor",   icon: "😞", label: "Poor",   color: "#ef4444" },
  { key: "none",   icon: "💀", label: "No Sleep",color: "#9f1239" },
];

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
    // Health vitals
    bloodGroup: string;
    weight: string;
    gender: string;
    age: string;
    reminderInterval: string;
  }

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>("default");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: "", allergies: "Pollen", color: "#6366f1", feeling: "Calm 😌",
    bloodGroup: "O+", weight: "", gender: "Prefer not to say", age: "",
    reminderInterval: "none"
  });
  const [newProfile, setNewProfile] = useState({
    name: "", allergies: "Pollen", color: "#6366f1", feeling: "Calm 😌",
    bloodGroup: "O+", weight: "", gender: "Prefer not to say", age: "",
    reminderInterval: "none"
  });

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
            const savedId = localStorage.getItem("zensit_active_profile_id");
            const active = (savedId && parsed.find((p: any) => p.id === savedId)) || parsed[0];
            setActiveProfileId(active.id);
            setProfile(p => ({ ...p, name: active.name }));
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        const seed = [{ id: "default", name: "Nandu", allergies: "Pollen", color: "#6366f1", feeling: "Calm 😌", bloodGroup: "O+", weight: "", gender: "Male", age: "", reminderInterval: "none" }];
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
      bloodGroup: newProfile.bloodGroup,
      weight: newProfile.weight,
      gender: newProfile.gender,
      age: newProfile.age,
      reminderInterval: newProfile.reminderInterval
    };
    const updated = [...profiles, newP];
    setProfiles(updated);
    localStorage.setItem("zensit_user_profiles", JSON.stringify(updated));
    localStorage.setItem("zensit_active_profile_id", newP.id);
    setActiveProfileId(newP.id);
    setProfile(p => ({ ...p, name: newP.name }));
    setShowAddForm(false);
    setNewProfile({ name: "", allergies: "Pollen", color: "#6366f1", feeling: "Calm 😌", bloodGroup: "O+", weight: "", gender: "Prefer not to say", age: "", reminderInterval: "none" });
  };

  const deleteProfile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === "default") return;
    const filtered = profiles.filter(p => p.id !== id);
    setProfiles(filtered);
    localStorage.setItem("zensit_user_profiles", JSON.stringify(filtered));
    if (activeProfileId === id) {
      const fallback = filtered[0] || { id: "default", name: "Nandu", allergies: "Pollen", color: "#6366f1", feeling: "Calm 😌" };
      localStorage.setItem("zensit_active_profile_id", fallback.id);
      setActiveProfileId(fallback.id);
      setProfile(p => ({ ...p, name: fallback.name }));
    }
  };

  const startEdit = (p: UserProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAddForm(false);
    setEditingProfileId(p.id);
    setEditDraft({
      name: p.name,
      allergies: p.allergies,
      color: p.color,
      feeling: p.feeling,
      bloodGroup: p.bloodGroup || "O+",
      weight: p.weight || "",
      gender: p.gender || "Prefer not to say",
      age: p.age || "",
      reminderInterval: p.reminderInterval || "none",
    });
  };

  const saveEdit = () => {
    if (!editDraft.name.trim() || !editingProfileId) return;
    const name = editDraft.name.trim();
    if (name.length > 100) { alert("Name is too long"); return; }
    const updated = profiles.map(p =>
      p.id === editingProfileId
        ? { ...p, ...editDraft, name }
        : p
    );
    setProfiles(updated);
    localStorage.setItem("zensit_user_profiles", JSON.stringify(updated));
    // Sync the log profile name if this is the active profile
    if (activeProfileId === editingProfileId) {
      setProfile(prev => ({ ...prev, name }));
    }
    setEditingProfileId(null);
  };

  const [symptoms, setSymptoms] = useState<Record<SymptomKey, { on: boolean; note: string }>>(
    Object.fromEntries(SYMPTOMS.map(s => [s.key, { on: false, note: "" }])) as any
  );
  const [sneezes, setSneezes] = useState(0);
  const [sneezeNote, setSneezeNote] = useState("");

  // ── Wellness States ──────────────────────────────────────────────────────
  const [emotionKeys, setEmotionKeys] = useState<string[]>([]);

  const [stomachMovement, setStomachMovement] = useState<"constipation" | "normal" | "loose" | "">("");
  const [stomachNote, setStomachNote] = useState("");

  const [urineColor, setUrineColor] = useState("");
  const [urineThickness, setUrineThickness] = useState<"thin" | "normal" | "thick" | "">("");
  const [urineNote, setUrineNote] = useState("");

  const [bloating, setBloating] = useState(false);
  const [bloatingSeverity, setBloatingSeverity] = useState<1 | 2 | 3 | 4 | 5>(3);

  const [sleepHours, setSleepHours] = useState("");
  const [sleepQuality, setSleepQuality] = useState("");

  const [stressLevel, setStressLevel] = useState<number>(3); // 1-10 slider
  const [waterIntake, setWaterIntake] = useState<number>(4); // glasses of water
  const [allergenKeys, setAllergenKeys] = useState<string[]>([]);
  // ─────────────────────────────────────────────────────────────────────────

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
        wellness: {
          emotions: emotionKeys,
          stomach: { movement: stomachMovement, note: stomachNote },
          urine: { color: urineColor, thickness: urineThickness, note: urineNote },
          bloating: { active: bloating, severity: bloating ? bloatingSeverity : null },
          sleep: { hours: sleepHours ? parseFloat(sleepHours) : null, quality: sleepQuality },
          stress: stressLevel,
          water: waterIntake,
          allergens: allergenKeys,
        },
        timestamp: new Date().toISOString(),
      });
      if (typeof window !== "undefined") {
        localStorage.setItem("zensit_last_log_timestamp", new Date().toISOString());
      }
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
    setEmotionKeys([]);
    setStomachMovement(""); setStomachNote("");
    setUrineColor(""); setUrineThickness(""); setUrineNote("");
    setBloating(false); setBloatingSeverity(3);
    setSleepHours(""); setSleepQuality("");
    setStressLevel(3); setWaterIntake(4); setAllergenKeys([]);
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
                        localStorage.setItem("zensit_active_profile_id", p.id);
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
                          
                          {/* Vitals and Reminder chips */}
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                            {p.gender && p.gender !== "Prefer not to say" && (
                              <span style={{ fontSize: "0.6rem", background: "rgba(129,140,248,0.12)", color: "#818cf8", padding: "1.5px 6px", borderRadius: 12, fontWeight: 600 }}>
                                {p.gender === "Male" ? "♂ Male" : p.gender === "Female" ? "♀ Female" : p.gender}
                              </span>
                            )}
                            {p.bloodGroup && p.bloodGroup !== "Unknown" && (
                              <span style={{ fontSize: "0.6rem", background: "rgba(239,68,68,0.12)", color: "#f87171", padding: "1.5px 6px", borderRadius: 12, fontWeight: 600 }}>
                                🩸 {p.bloodGroup}
                              </span>
                            )}
                            {p.age && (
                              <span style={{ fontSize: "0.6rem", background: "rgba(16,185,129,0.1)", color: "#6ee7b7", padding: "1.5px 6px", borderRadius: 12, fontWeight: 600 }}>
                                {p.age}y
                              </span>
                            )}
                            {p.weight && (
                              <span style={{ fontSize: "0.6rem", background: "rgba(245,158,11,0.1)", color: "#fcd34d", padding: "1.5px 6px", borderRadius: 12, fontWeight: 600 }}>
                                {p.weight}kg
                              </span>
                            )}
                            {p.reminderInterval && p.reminderInterval !== "none" && (
                              <span style={{ fontSize: "0.6rem", background: "rgba(168,85,247,0.12)", color: "#c084fc", padding: "1.5px 6px", borderRadius: 12, fontWeight: 600 }}>
                                🔔 {p.reminderInterval === "1m" ? "1 Min" : p.reminderInterval === "1h" ? "1 Hour" : p.reminderInterval === "4h" ? "4 Hours" : p.reminderInterval === "8h" ? "8 Hours" : "24 Hours"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Edit + Delete buttons */}
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={(e) => startEdit(p, e)}
                          style={{
                            background: "none", border: "none",
                            color: editingProfileId === p.id ? "#818cf8" : "rgba(129,140,248,0.6)",
                            cursor: "pointer", fontSize: "1rem", padding: 4,
                            display: "flex", alignItems: "center", justifyContent: "center"
                          }}
                          title="Edit Profile"
                        >
                          ✏️
                        </button>
                        {p.id !== "default" && (
                          <button
                            type="button"
                            onClick={(e) => deleteProfile(p.id, e)}
                            style={{
                              background: "none", border: "none",
                              color: "rgba(239, 68, 68, 0.7)",
                              cursor: "pointer", fontSize: "1rem", padding: 4,
                              display: "flex", alignItems: "center", justifyContent: "center"
                            }}
                            title="Delete Profile"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
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

              {/* Edit Profile Form */}
              {editingProfileId && (() => {
                const editTarget = profiles.find(p => p.id === editingProfileId);
                return (
                  <div className="card-hi" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16, border: "1.5px solid rgba(129,140,248,0.4)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3 style={{ fontWeight: 800, fontSize: "1rem", color: "#fff" }}>✏️ Edit Profile — {editTarget?.name}</h3>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "4px 8px" }} onClick={() => setEditingProfileId(null)}>✕</button>
                    </div>

                    <div>
                      <label className="t-label" style={{ display: "block", marginBottom: 6 }}>Full Name</label>
                      <input className="input" placeholder="e.g. Brahman..." value={editDraft.name}
                        onChange={e => setEditDraft(prev => ({ ...prev, name: e.target.value }))} />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
                      <div>
                        <label className="t-label" style={{ display: "block", marginBottom: 6 }}>Primary Allergen</label>
                        <select className="input" value={editDraft.allergies}
                          onChange={e => setEditDraft(prev => ({ ...prev, allergies: e.target.value }))}
                          style={{ background: "rgba(8,12,20,0.9)", color: "var(--text)" }}>
                          {["Pollen", "Dust", "Pets", "Food", "Air Quality", "Other"].map(a => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="t-label" style={{ display: "block", marginBottom: 6 }}>General Feeling</label>
                        <select className="input" value={editDraft.feeling}
                          onChange={e => setEditDraft(prev => ({ ...prev, feeling: e.target.value }))}
                          style={{ background: "rgba(8,12,20,0.9)", color: "var(--text)" }}>
                          {["Calm 😌", "Energetic ⚡", "Fatigued 😴", "Anxious 😰", "Irritated 🤧"].map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Health Vitals */}
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                      <div className="t-label" style={{ marginBottom: 10, color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        🩺 Health Vitals (optional)
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label className="t-label" style={{ display: "block", marginBottom: 5 }}>Gender</label>
                          <select className="input" value={editDraft.gender}
                            onChange={e => setEditDraft(prev => ({ ...prev, gender: e.target.value }))}
                            style={{ background: "rgba(8,12,20,0.9)", color: "var(--text)" }}>
                            {["Male", "Female", "Non-binary", "Prefer not to say"].map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="t-label" style={{ display: "block", marginBottom: 5 }}>Blood Group</label>
                          <select className="input" value={editDraft.bloodGroup}
                            onChange={e => setEditDraft(prev => ({ ...prev, bloodGroup: e.target.value }))}
                            style={{ background: "rgba(8,12,20,0.9)", color: "var(--text)" }}>
                            {["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-", "Unknown"].map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="t-label" style={{ display: "block", marginBottom: 5 }}>Age (years)</label>
                          <input className="input" type="number" min="1" max="120" placeholder="e.g. 28"
                            value={editDraft.age}
                            onChange={e => setEditDraft(prev => ({ ...prev, age: e.target.value }))} />
                        </div>
                        <div>
                          <label className="t-label" style={{ display: "block", marginBottom: 5 }}>Weight (kg)</label>
                          <input className="input" type="number" min="1" max="300" placeholder="e.g. 65"
                            value={editDraft.weight}
                            onChange={e => setEditDraft(prev => ({ ...prev, weight: e.target.value }))} />
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <label className="t-label" style={{ display: "block", marginBottom: 5 }}>Logging Reminders</label>
                          <select className="input" value={editDraft.reminderInterval}
                            onChange={e => {
                              const val = e.target.value;
                              setEditDraft(prev => ({ ...prev, reminderInterval: val }));
                              if (val !== "none" && typeof window !== "undefined" && "Notification" in window) {
                                Notification.requestPermission().then(permission => {
                                  if (permission === "granted") {
                                    new Notification("Zensit Reminders", {
                                      body: "Reminders updated! You will be notified to log data.",
                                      icon: "/icon-192x192.png"
                                    });
                                  }
                                });
                              }
                            }}
                            style={{ background: "rgba(8,12,20,0.9)", color: "var(--text)" }}>
                            <option value="none">No reminders (Off)</option>
                            <option value="1m">Every Minute (for Testing 🧪)</option>
                            <option value="1h">Every Hour 🔔</option>
                            <option value="4h">Every 4 Hours 🕐</option>
                            <option value="8h">Every 8 Hours 🕦</option>
                            <option value="24h">Daily (Every 24 Hours) 📅</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Theme Accent */}
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
                            onClick={() => setEditDraft(prev => ({ ...prev, color: color.val }))}
                            style={{
                              width: 24, height: 24, borderRadius: "50%", background: color.val,
                              border: editDraft.color === color.val ? "2px solid #fff" : "none",
                              cursor: "pointer",
                              boxShadow: editDraft.color === color.val ? `0 0 10px ${color.val}` : "none",
                              transition: "transform 0.1s"
                            }}
                            title={color.label}
                          />
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingProfileId(null)}>Cancel</button>
                      <button type="button" className="btn btn-primary btn-sm" onClick={saveEdit}>✓ Save Changes</button>
                    </div>
                  </div>
                );
              })()}

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
                  </div>

                  {/* ── Health Vitals ─────────────────────────────────── */}
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                    <div className="t-label" style={{ marginBottom: 10, color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      🩺 Health Vitals (optional)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label className="t-label" style={{ display: "block", marginBottom: 5 }}>Gender</label>
                        <select
                          className="input"
                          value={newProfile.gender}
                          onChange={e => setNewProfile(prev => ({ ...prev, gender: e.target.value }))}
                          style={{ background: "rgba(8,12,20,0.9)", color: "var(--text)" }}
                        >
                          {["Male", "Female", "Non-binary", "Prefer not to say"].map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="t-label" style={{ display: "block", marginBottom: 5 }}>Blood Group</label>
                        <select
                          className="input"
                          value={newProfile.bloodGroup}
                          onChange={e => setNewProfile(prev => ({ ...prev, bloodGroup: e.target.value }))}
                          style={{ background: "rgba(8,12,20,0.9)", color: "var(--text)" }}
                        >
                          {["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-", "Unknown"].map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="t-label" style={{ display: "block", marginBottom: 5 }}>Age (years)</label>
                        <input
                          className="input" type="number" min="1" max="120" placeholder="e.g. 28"
                          value={newProfile.age}
                          onChange={e => setNewProfile(prev => ({ ...prev, age: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="t-label" style={{ display: "block", marginBottom: 5 }}>Weight (kg)</label>
                        <input
                          className="input" type="number" min="1" max="300" placeholder="e.g. 65"
                          value={newProfile.weight}
                          onChange={e => setNewProfile(prev => ({ ...prev, weight: e.target.value }))}
                        />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label className="t-label" style={{ display: "block", marginBottom: 5 }}>Logging Reminders</label>
                        <select
                          className="input"
                          value={newProfile.reminderInterval}
                          onChange={e => {
                            const val = e.target.value;
                            setNewProfile(prev => ({ ...prev, reminderInterval: val }));
                            if (val !== "none" && typeof window !== "undefined" && "Notification" in window) {
                              Notification.requestPermission().then(permission => {
                                if (permission === "granted") {
                                  new Notification("Zensit Reminders", {
                                    body: "Reminders enabled! You will be notified to log data.",
                                    icon: "/icon-192x192.png"
                                  });
                                }
                              });
                            }
                          }}
                          style={{ background: "rgba(8,12,20,0.9)", color: "var(--text)" }}
                        >
                          <option value="none">No reminders (Off)</option>
                          <option value="1m">Every Minute (for Testing 🧪)</option>
                          <option value="1h">Every Hour 🔔</option>
                          <option value="4h">Every 4 Hours 🕐</option>
                          <option value="8h">Every 8 Hours 🕦</option>
                          <option value="24h">Daily (Every 24 Hours) 📅</option>
                        </select>
                      </div>
                    </div>
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
                            width: 24, height: 24, borderRadius: "50%", background: color.val,
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
            <div className="anim-fadeup" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.2rem", color: "#fff" }}>🩺 Symptom & Wellness Log</h2>

              {/* ── Emotional State ─────────────────────────────────── */}
              <div className="card" style={{ padding: "20px" }}>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.9375rem", marginBottom: 4 }}>💭 Emotional State</div>
                  <div className="t-label" style={{ fontSize: "0.75rem" }}>Select all that apply right now</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {EMOTIONS.map(em => {
                    const active = emotionKeys.includes(em.key);
                    return (
                      <button
                        key={em.key}
                        type="button"
                        onClick={() => setEmotionKeys(prev =>
                          prev.includes(em.key) ? prev.filter(k => k !== em.key) : [...prev, em.key]
                        )}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                          padding: "10px 4px", borderRadius: 12, cursor: "pointer",
                          background: active ? `${em.color}22` : "var(--surface-2)",
                          border: active ? `1.5px solid ${em.color}` : "1px solid var(--border)",
                          boxShadow: active ? `0 0 12px ${em.color}30` : "none",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span style={{ fontSize: "1.4rem" }}>{em.icon}</span>
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: active ? em.color : "var(--muted)", whiteSpace: "nowrap" }}>
                          {em.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Sneeze counter ──────────────────────────────────── */}
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

              {/* ── Active Allergy Symptoms ──────────────────────────── */}
              <div>
                <label className="t-label" style={{ marginBottom: 10, display: "block" }}>⚠️ Active Allergy Symptoms</label>
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

              {/* ── Allergen Exposure ──────────────────────────────────── */}
              <div className="card" style={{ padding: "20px" }}>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.9375rem", marginBottom: 4 }}>🐾 Allergen Exposure</div>
                  <div className="t-label" style={{ fontSize: "0.75rem" }}>Select allergens encountered today</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {ALLERGENS.map(all => {
                    const active = allergenKeys.includes(all.key);
                    return (
                      <button
                        key={all.key}
                        type="button"
                        onClick={() => setAllergenKeys(prev =>
                          prev.includes(all.key) ? prev.filter(k => k !== all.key) : [...prev, all.key]
                        )}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                          padding: "10px 4px", borderRadius: 12, cursor: "pointer",
                          background: active ? "rgba(99, 102, 241, 0.15)" : "var(--surface-2)",
                          border: active ? "1.5px solid #6366f1" : "1px solid var(--border)",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span style={{ fontSize: "1.4rem" }}>{all.icon}</span>
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: active ? "#818cf8" : "var(--muted)", whiteSpace: "nowrap" }}>
                          {all.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Stomach Movement ─────────────────────────────────── */}
              <div className="card" style={{ padding: "20px" }}>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.9375rem", marginBottom: 4 }}>🫁 Stomach Movement</div>
                  <div className="t-label" style={{ fontSize: "0.75rem" }}>Bowel movement status today</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                  {([
                    { key: "constipation", icon: "🟤", label: "Constipation", color: "#92400e", bg: "rgba(146,64,14,0.15)" },
                    { key: "normal",       icon: "✅", label: "Normal",       color: "#16a34a", bg: "rgba(22,163,74,0.12)" },
                    { key: "loose",        icon: "💧", label: "Loose",        color: "#0284c7", bg: "rgba(2,132,199,0.12)" },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setStomachMovement(prev => prev === opt.key ? "" : opt.key)}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                        padding: "14px 8px", borderRadius: 12, cursor: "pointer",
                        background: stomachMovement === opt.key ? opt.bg : "var(--surface-2)",
                        border: stomachMovement === opt.key ? `1.5px solid ${opt.color}` : "1px solid var(--border)",
                        boxShadow: stomachMovement === opt.key ? `0 0 12px ${opt.color}30` : "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ fontSize: "1.5rem" }}>{opt.icon}</span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: stomachMovement === opt.key ? opt.color : "var(--muted)" }}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
                {stomachMovement && stomachMovement !== "normal" && (
                  <input
                    className="input"
                    value={stomachNote}
                    onChange={e => setStomachNote(e.target.value)}
                    placeholder="Any notes (pain, frequency, etc.)…"
                    style={{ fontSize: "0.875rem" }}
                  />
                )}
              </div>

              {/* ── Urine Status ──────────────────────────────────────── */}
              <div className="card" style={{ padding: "20px" }}>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.9375rem", marginBottom: 4 }}>💛 Urine Status</div>
                  <div className="t-label" style={{ fontSize: "0.75rem" }}>Color, clarity and notes</div>
                </div>

                {/* Color selector */}
                <div className="t-label" style={{ marginBottom: 8, fontSize: "0.7rem" }}>COLOR</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                  {URINE_COLORS.map(uc => (
                    <button
                      key={uc.key}
                      type="button"
                      onClick={() => setUrineColor(prev => prev === uc.key ? "" : uc.key)}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                        padding: "8px 10px", borderRadius: 10, cursor: "pointer", flex: "0 0 auto",
                        background: urineColor === uc.key ? `${uc.color}33` : "var(--surface-2)",
                        border: urineColor === uc.key ? `2px solid ${uc.color}` : "1px solid var(--border)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%",
                        background: uc.hex,
                        border: "1px solid rgba(255,255,255,0.2)",
                        boxShadow: urineColor === uc.key ? `0 0 8px ${uc.color}60` : "none",
                      }} />
                      <span style={{ fontSize: "0.62rem", fontWeight: 700, color: urineColor === uc.key ? "#fff" : "var(--muted)", whiteSpace: "nowrap" }}>
                        {uc.label}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Thickness / Clarity */}
                <div className="t-label" style={{ marginBottom: 8, fontSize: "0.7rem" }}>CLARITY / THICKNESS</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                  {([
                    { key: "thin",   icon: "💎", label: "Clear/Thin",  color: "#38bdf8" },
                    { key: "normal", icon: "🔵", label: "Normal",       color: "#6366f1" },
                    { key: "thick",  icon: "🟡", label: "Cloudy/Thick", color: "#f59e0b" },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setUrineThickness(prev => prev === opt.key ? "" : opt.key)}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                        padding: "12px 6px", borderRadius: 10, cursor: "pointer",
                        background: urineThickness === opt.key ? `${opt.color}22` : "var(--surface-2)",
                        border: urineThickness === opt.key ? `1.5px solid ${opt.color}` : "1px solid var(--border)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ fontSize: "1.2rem" }}>{opt.icon}</span>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: urineThickness === opt.key ? opt.color : "var(--muted)" }}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>

                <input
                  className="input"
                  value={urineNote}
                  onChange={e => setUrineNote(e.target.value)}
                  placeholder="Notes (odor, pain, frequency, etc.)…"
                  style={{ fontSize: "0.875rem" }}
                />
              </div>

              {/* ── Bloating ─────────────────────────────────────────── */}
              <div className="card" style={{ padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: bloating ? 16 : 0 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.9375rem", marginBottom: 4 }}>🫃 Bloating</div>
                    <div className="t-label" style={{ fontSize: "0.75rem" }}>Abdominal swelling or discomfort</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBloating(p => !p)}
                    style={{
                      width: 52, height: 28, borderRadius: 14, cursor: "pointer", border: "none",
                      background: bloating ? "#6366f1" : "var(--surface-2)",
                      position: "relative", transition: "background 0.2s ease",
                      boxShadow: bloating ? "0 0 10px rgba(99,102,241,0.4)" : "none",
                    }}
                  >
                    <div style={{
                      position: "absolute", top: 4, width: 20, height: 20, borderRadius: "50%", background: "#fff",
                      left: bloating ? 28 : 4, transition: "left 0.2s ease",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                    }} />
                  </button>
                </div>
                {bloating && (
                  <div>
                    <div className="t-label" style={{ marginBottom: 10, fontSize: "0.7rem" }}>SEVERITY (1 = mild, 5 = severe)</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {([1, 2, 3, 4, 5] as const).map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setBloatingSeverity(n)}
                          style={{
                            flex: 1, height: 40, borderRadius: 10, cursor: "pointer",
                            fontWeight: 800, fontSize: "0.875rem",
                            background: bloatingSeverity === n
                              ? n <= 2 ? "rgba(34,197,94,0.2)" : n === 3 ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)"
                              : "var(--surface-2)",
                            border: bloatingSeverity === n
                              ? `1.5px solid ${n <= 2 ? "#22c55e" : n === 3 ? "#f59e0b" : "#ef4444"}`
                              : "1px solid var(--border)",
                            color: bloatingSeverity === n
                              ? n <= 2 ? "#22c55e" : n === 3 ? "#f59e0b" : "#ef4444"
                              : "var(--muted)",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Sleep Status ─────────────────────────────────────── */}
              <div className="card" style={{ padding: "20px" }}>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.9375rem", marginBottom: 4 }}>🌙 Sleep Status</div>
                  <div className="t-label" style={{ fontSize: "0.75rem" }}>Last night&apos;s sleep</div>
                </div>

                {/* Hours slider + input */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <label className="t-label" style={{ fontSize: "0.7rem" }}>HOURS SLEPT</label>
                    <span style={{ fontWeight: 900, fontSize: "1.1rem", color: "#818cf8", letterSpacing: "-0.03em" }}>
                      {sleepHours ? `${sleepHours}h` : "—"}
                    </span>
                  </div>
                  <input
                    type="range" min="0" max="12" step="0.5"
                    value={sleepHours || "0"}
                    onChange={e => setSleepHours(e.target.value)}
                    style={{ width: "100%", accentColor: "#6366f1" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="t-label" style={{ fontSize: "0.6rem" }}>0h</span>
                    <span className="t-label" style={{ fontSize: "0.6rem" }}>6h</span>
                    <span className="t-label" style={{ fontSize: "0.6rem" }}>12h</span>
                  </div>
                </div>

                {/* Quality buttons */}
                <div className="t-label" style={{ marginBottom: 8, fontSize: "0.7rem" }}>QUALITY</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SLEEP_QUALITY.map(sq => (
                    <button
                      key={sq.key}
                      type="button"
                      onClick={() => setSleepQuality(prev => prev === sq.key ? "" : sq.key)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "8px 14px", borderRadius: 10, cursor: "pointer",
                        background: sleepQuality === sq.key ? `${sq.color}22` : "var(--surface-2)",
                        border: sleepQuality === sq.key ? `1.5px solid ${sq.color}` : "1px solid var(--border)",
                        boxShadow: sleepQuality === sq.key ? `0 0 10px ${sq.color}30` : "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ fontSize: "1rem" }}>{sq.icon}</span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: sleepQuality === sq.key ? sq.color : "var(--muted)" }}>
                        {sq.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Stress & Water Intake ──────────────────────────────── */}
              <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.9375rem" }}>🧠 Stress Level</div>
                      <div className="t-label" style={{ marginTop: 2 }}>1 = Relaxed, 10 = High Anxiety</div>
                    </div>
                    <span style={{ fontWeight: 900, fontSize: "1.1rem", color: stressLevel > 7 ? "#ef4444" : stressLevel > 4 ? "#fb923c" : "#22c55e", letterSpacing: "-0.03em" }}>
                      {stressLevel}/10
                    </span>
                  </div>
                  <input
                    type="range" min="1" max="10" step="1"
                    value={stressLevel}
                    onChange={e => setStressLevel(parseInt(e.target.value))}
                    style={{ width: "100%", accentColor: stressLevel > 7 ? "#ef4444" : stressLevel > 4 ? "#fb923c" : "#6366f1" }}
                  />
                </div>

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.9375rem" }}>💧 Daily Water Intake</div>
                    <div className="t-label" style={{ marginTop: 2 }}>Recommended: 8–10 glasses</div>
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 0,
                    background: "var(--surface-2)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)"
                  }}>
                    <button type="button" onClick={() => setWaterIntake(n => Math.max(0, n - 1))}
                      style={{
                        width: 40, height: 40, background: "none", border: "none", color: "var(--muted)",
                        cursor: "pointer", fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center"
                      }}>−</button>
                    <span style={{
                      minWidth: 44, textAlign: "center", fontWeight: 900, fontSize: "1.1rem",
                      color: "#60a5fa", letterSpacing: "-0.04em"
                    }}>{waterIntake} 🥛</span>
                    <button type="button" onClick={() => setWaterIntake(n => Math.min(20, n + 1))}
                      style={{
                        width: 40, height: 40, background: "none", border: "none", color: "var(--muted)",
                        cursor: "pointer", fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center"
                      }}>+</button>
                  </div>
                </div>
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