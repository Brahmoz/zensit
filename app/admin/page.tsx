"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs, orderBy, query, deleteDoc, updateDoc, doc } from "firebase/firestore";

export type ParamKey = "temp" | "humidity" | "sneezes" | "stress" | "sleep" | "water" | "bloating" | "symptoms" | "risk";

interface ParamConfig {
  key: ParamKey;
  label: string;
  unit: string;
  icon: string;
  color: string;
  getValue: (l: any) => number | null;
}

export default function Admin() {
  const [authed, setAuthed]   = useState(false);
  const [pw, setPw]           = useState("");
  const [pwErr, setPwErr]     = useState("");
  const [logs, setLogs]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<"overview" | "timeline" | "feed">("overview");
  const [selectedPatient, setSelectedPatient] = useState<string>("all");
  const [selectedLogs, setSelectedLogs]       = useState<string[]>([]);

  // Timeline parameter comparison states
  const [selectedParams, setSelectedParams] = useState<ParamKey[]>(["temp", "humidity", "sneezes", "risk"]);
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const [pinnedLogId, setPinnedLogId]         = useState<string | null>(null);

  // New Feature States
  const [searchTerm, setSearchTerm]           = useState("");
  const [dateRange, setDateRange]             = useState<"7d" | "30d" | "all">("all");
  const [aggregateDaily, setAggregateDaily]   = useState(false);
  const [onlyHighRiskFilter, setOnlyHighRiskFilter] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [copiedPrompt, setCopiedPrompt]       = useState(false);

  // Correlation Filter States
  const [selectedAllergen, setSelectedAllergen] = useState<string>("all");
  const [selectedSymptom, setSelectedSymptom]   = useState<string>("all");

  // Edit Log States
  const [editingLog, setEditingLog]           = useState<any | null>(null);
  const [showEditModal, setShowEditModal]     = useState(false);
  const [savingEdit, setSavingEdit]           = useState(false);

  const openEditModal = (log: any) => {
    setEditingLog(JSON.parse(JSON.stringify(log)));
    setShowEditModal(true);
  };

  const saveLogEdit = async () => {
    if (!db || !editingLog || !editingLog.id) return;
    setSavingEdit(true);
    try {
      const logRef = doc(db, "health_logs", editingLog.id);
      const updateData = {
        profile: editingLog.profile || {},
        exposure: editingLog.exposure || {},
        sneezing: editingLog.sneezing || { count: 0 },
        symptoms: editingLog.symptoms || {},
        wellness: editingLog.wellness || {},
        updatedAt: new Date().toISOString()
      };
      await updateDoc(logRef, updateData);
      setLogs(prev => prev.map(l => l.id === editingLog.id ? { ...l, ...updateData } : l));
      setShowEditModal(false);
      setEditingLog(null);
    } catch (e) {
      console.error("Error saving log edit:", e);
      alert("Failed to update log entry.");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteSelected = async () => {
    if (!db) return;
    if (selectedLogs.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedLogs.length} selected log(s)?`)) return;
    try {
      for (const id of selectedLogs) {
        await deleteDoc(doc(db, "health_logs", id));
      }
      setLogs(prev => prev.filter(l => !selectedLogs.includes(l.id)));
      setSelectedLogs([]);
    } catch (e) {
      console.error(e);
      alert("Failed to delete some logs.");
    }
  };

  const deleteSingleLog = async (id: string, name?: string, dateStr?: string) => {
    if (!db) return;
    const label = name ? `${name}'s log (${dateStr || "entry"})` : `this log entry`;
    if (!window.confirm(`Are you sure you want to delete ${label}?`)) return;
    try {
      await deleteDoc(doc(db, "health_logs", id));
      setLogs(prev => prev.filter(l => l.id !== id));
      setSelectedLogs(prev => prev.filter(lId => lId !== id));
    } catch (e) {
      console.error(e);
      alert("Failed to delete log entry.");
    }
  };

  const deletePatientProfile = async (patientName: string) => {
    if (!patientName || patientName === "all") return;
    const patientLogs = logs.filter(l => l.profile?.name === patientName);
    const msg = patientLogs.length > 0
      ? `🚨 DANGER ZONE: Are you sure you want to delete patient profile "${patientName}" and ALL ${patientLogs.length} logged entries? This action cannot be undone.`
      : `Are you sure you want to delete profile "${patientName}"?`;
    if (!window.confirm(msg)) return;

    try {
      if (db && patientLogs.length > 0) {
        for (const log of patientLogs) {
          try {
            await deleteDoc(doc(db, "health_logs", log.id));
          } catch (docErr) {
            console.warn(`Could not delete document ${log.id} from Firestore:`, docErr);
          }
        }
      }

      const deletedIds = patientLogs.map(l => l.id);
      setLogs(prev => prev.filter(l => l.profile?.name !== patientName));
      setSelectedLogs(prev => prev.filter(id => !deletedIds.includes(id)));

      // Sync local storage user profiles
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("zensit_user_profiles");
          if (stored) {
            const parsed = JSON.parse(stored);
            const filtered = parsed.filter((p: any) => p.name !== patientName);
            localStorage.setItem("zensit_user_profiles", JSON.stringify(filtered));
          }
        } catch (err) {
          console.error("Failed to sync localStorage profiles:", err);
        }
      }

      setSelectedPatient("all");
      alert(`Patient profile "${patientName}" deleted successfully.`);
    } catch (e) {
      console.error("Error deleting patient profile:", e);
      alert("Failed to delete patient profile.");
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("za") === "1") setAuthed(true);
  }, []);

  useEffect(() => {
    if (!authed || !db) { setLoading(false); return; }
    (async () => {
      try {
        const q = query(collection(db, "health_logs"), orderBy("timestamp", "desc"));
        const snap = await getDocs(q);
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [authed]);

  const login = (e: React.FormEvent) => {
    e.preventDefault();
    const expected = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "zensit2026";
    if (pw === expected) { sessionStorage.setItem("za", "1"); setAuthed(true); }
    else { setPwErr("Wrong password."); setPw(""); }
  };

  const getLogTimestamp = (l: any): number => {
    if (l.timestamp) {
      if (typeof l.timestamp === "string") {
        const t = new Date(l.timestamp).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      if (typeof l.timestamp === "number") return l.timestamp;
      if (l.timestamp?.seconds) return l.timestamp.seconds * 1000;
      if (l.timestamp?.toDate) return l.timestamp.toDate().getTime();
    }
    if (l.profile?.date) {
      const d = new Date(`${l.profile.date} ${l.profile.time || "12:00"}`).getTime();
      if (!isNaN(d) && d > 0) return d;
    }
    if (l.createdAt) {
      const c = new Date(l.createdAt).getTime();
      if (!isNaN(c) && c > 0) return c;
    }
    return 0;
  };

  const getLogSymptomsCount = (l: any): number => {
    if (!l.symptoms) return 0;
    if (Array.isArray(l.symptoms)) return l.symptoms.length;
    return Object.values(l.symptoms || {}).filter((v: any) => v?.on || v?.active || v === true).length;
  };

  const exportJSON = () => {
    if (!logs.length) return;
    const sorted = [...logs].sort((a, b) => getLogTimestamp(a) - getLogTimestamp(b));
    const base = getLogTimestamp(sorted[0]) || Date.now();
    const out  = sorted.map((l, i) => ({
      log_index: i + 1,
      relative_day: Math.floor((getLogTimestamp(l) - base) / 86400000),
      location: l.profile?.location || l.profile?.locationTag || l.location || "—",
      climate: {
        temp: l.exposure?.temperature ?? l.climate?.temp ?? l.temperature ?? l.temp,
        humidity: l.exposure?.humidity ?? l.climate?.humidity ?? l.humidity ?? l.hum
      },
      symptoms: Array.isArray(l.symptoms)
        ? l.symptoms
        : Object.entries(l.symptoms || {})
            .filter(([, v]: any) => v?.on || v?.active || v === true)
            .map(([k]) => k),
      sneezes: l.sneezing?.count ?? l.sneezes ?? l.sneezingCount ?? 0,
      food: l.exposure?.foodIntake || l.foodIntake || l.food || "",
      meds: l.exposure?.medicines || l.medicines || l.meds || "",
      wellness: l.wellness || {},
    }));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
    a.download = `zensit_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  // ─── helpers ──────────────────────────────────────────────────────────────
  const parseN = (v: string | number | undefined | null): number | null => {
    if (v === undefined || v === null || v === "") return null;
    if (typeof v === "number") return isNaN(v) ? null : v;
    const p = parseFloat(String(v).replace(/[^\d.-]/g, ""));
    return isNaN(p) ? null : p;
  };

  const getRiskScore = (l: any) => {
    const t = parseN(l.exposure?.temperature ?? l.climate?.temp ?? l.temperature ?? l.temp) ?? 25;
    const h = parseN(l.exposure?.humidity ?? l.climate?.humidity ?? l.humidity ?? l.hum) ?? 50;
    let s = 30;
    if (h > 65 || h < 35) s += 25;
    if (t > 28 || t < 16) s += 20;
    const syms = getLogSymptomsCount(l);
    s += syms * 10;
    return Math.min(100, s);
  };

  const PARAM_CONFIGS: Record<ParamKey, ParamConfig> = {
    temp:     { key: "temp",     label: "Temperature",  unit: "°C",     icon: "🌡️", color: "#fb923c", getValue: l => parseN(l.exposure?.temperature ?? l.climate?.temp ?? l.temperature ?? l.temp) },
    humidity: { key: "humidity", label: "Humidity",     unit: "%",      icon: "💧", color: "#38bdf8", getValue: l => parseN(l.exposure?.humidity ?? l.climate?.humidity ?? l.humidity ?? l.hum) },
    sneezes:  { key: "sneezes",  label: "Sneezes",      unit: "count",  icon: "😤", color: "#f59e0b", getValue: l => parseN(l.sneezing?.count ?? l.sneezes ?? l.sneezingCount) },
    stress:   { key: "stress",   label: "Stress Level", unit: "/10",    icon: "🧠", color: "#ec4899", getValue: l => parseN(l.wellness?.stress ?? l.stress) },
    sleep:    { key: "sleep",    label: "Sleep Hours",  unit: "hrs",    icon: "🌙", color: "#818cf8", getValue: l => parseN(l.wellness?.sleep?.hours ?? l.sleepHours ?? l.sleep) },
    water:    { key: "water",    label: "Water Intake", unit: "glasses",icon: "🥛", color: "#22d3ee", getValue: l => parseN(l.wellness?.water ?? l.waterIntake ?? l.water) },
    bloating: { key: "bloating", label: "Bloating",     unit: "sev",    icon: "🫃", color: "#a855f7", getValue: l => parseN(l.wellness?.bloating?.severity ?? l.bloatingSeverity ?? l.bloating) },
    symptoms: { key: "symptoms", label: "Active Syms",  unit: "count",  icon: "🩺", color: "#ef4444", getValue: l => getLogSymptomsCount(l) },
    risk:     { key: "risk",     label: "Risk Index",   unit: "%",      icon: "⚠️", color: "#22c55e", getValue: l => getRiskScore(l) },
  };

  const toggleParam = (key: ParamKey) => {
    setSelectedParams(prev => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev;
        return prev.filter(k => k !== key);
      }
      return [...prev, key];
    });
  };

  const patients = Array.from(new Set(logs.map(l => l.profile?.name).filter(Boolean))) as string[];

  // 🔍 Multi-field Search, High-Risk & Date Range Filter
  const filteredLogs = logs.filter(l => {
    if (selectedPatient !== "all" && l.profile?.name !== selectedPatient) return false;
    
    if (onlyHighRiskFilter && getRiskScore(l) < 65 && (l.sneezing?.count || 0) < 8 && (l.wellness?.stress || 0) < 8) return false;

    // 📅 Date Range Filtering
    if (dateRange !== "all") {
      const logTime = getLogTimestamp(l);
      if (logTime > 0) {
        const now = Date.now();
        const allTimestamps = logs.map(lg => getLogTimestamp(lg)).filter(t => t > 0);
        const maxTime = allTimestamps.length > 0 ? Math.max(...allTimestamps) : now;
        const cutoffDays = dateRange === "7d" ? 7 : 30;
        if (logTime < maxTime - cutoffDays * 86400000) return false;
      }
    }

    // 🐾 Allergen Exposure Filter
    if (selectedAllergen !== "all") {
      const algs: string[] = l.wellness?.allergens || [];
      if (!algs.includes(selectedAllergen)) return false;
    }

    // 🩺 Symptom Filter
    if (selectedSymptom !== "all") {
      const syms = l.symptoms || {};
      const val = syms[selectedSymptom];
      const active = val?.on || val?.active || val === true;
      if (!active) return false;
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const name = (l.profile?.name || "").toLowerCase();
      const loc = (l.profile?.location || l.profile?.locationTag || "").toLowerCase();
      const food = (l.exposure?.foodIntake || "").toLowerCase();
      const meds = (l.exposure?.medicines || "").toLowerCase();
      const feel = (l.profile?.feeling || "").toLowerCase();
      const symKeys = Object.entries(l.symptoms || {})
        .filter(([, v]: any) => v?.on || v?.active || v === true)
        .map(([k]) => k.toLowerCase())
        .join(" ");
      const algs = (l.wellness?.allergens || []).join(" ").toLowerCase();

      const matches = name.includes(term) || loc.includes(term) || food.includes(term) || meds.includes(term) || feel.includes(term) || symKeys.includes(term) || algs.includes(term);
      if (!matches) return false;
    }

    return true;
  });

  // 📅 Chronological order for Timeline
  const rawChronoLogs = [...filteredLogs].sort((a, b) => getLogTimestamp(a) - getLogTimestamp(b));

  // Daily Aggregation for Timeline Smoothing
  const chronoLogs = aggregateDaily ? (() => {
    const groups: Record<string, any[]> = {};
    rawChronoLogs.forEach(l => {
      const dayKey = l.profile?.date || (l.timestamp ? l.timestamp.slice(0, 10) : "unknown");
      if (!groups[dayKey]) groups[dayKey] = [];
      groups[dayKey].push(l);
    });

    return Object.entries(groups).map(([dayKey, dayLogs]) => {
      const avgTemp = Math.round(dayLogs.reduce((acc, l) => acc + (parseN(l.exposure?.temperature) ?? 0), 0) / dayLogs.length);
      const avgHum = Math.round(dayLogs.reduce((acc, l) => acc + (parseN(l.exposure?.humidity) ?? 0), 0) / dayLogs.length);
      const avgSneezes = Math.round(dayLogs.reduce((acc, l) => acc + (l.sneezing?.count || 0), 0) / dayLogs.length);
      const avgStress = Math.round(dayLogs.reduce((acc, l) => acc + (l.wellness?.stress || 0), 0) / dayLogs.length);
      const avgSleep = Math.round(dayLogs.reduce((acc, l) => acc + (l.wellness?.sleep?.hours || 0), 0) / dayLogs.length);
      const avgWater = Math.round(dayLogs.reduce((acc, l) => acc + (l.wellness?.water || 0), 0) / dayLogs.length);
      
      const combinedSyms: Record<string, any> = {};
      dayLogs.forEach(l => {
        Object.entries(l.symptoms || {}).forEach(([k, v]: any) => {
          if (v?.on || v?.active || v === true) combinedSyms[k] = { on: true };
        });
      });

      return {
        id: `agg-${dayKey}`,
        isAggregated: true,
        timestamp: dayKey,
        profile: { name: dayLogs[0]?.profile?.name || "Patient", date: dayKey, location: `${dayLogs.length} logs avg` },
        exposure: { temperature: `${avgTemp}°C`, humidity: `${avgHum}%` },
        sneezing: { count: avgSneezes },
        wellness: { stress: avgStress, sleep: { hours: avgSleep }, water: avgWater },
        symptoms: combinedSyms
      };
    });
  })() : rawChronoLogs;

  const avgTemp = () => {
    const vals = filteredLogs.map(l => parseN(l.exposure?.temperature)).filter(v => v !== null) as number[];
    return vals.length ? `${Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)}°C` : "—";
  };
  const avgHum = () => {
    const vals = filteredLogs.map(l => parseN(l.exposure?.humidity)).filter(v => v !== null) as number[];
    return vals.length ? `${Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)}%` : "—";
  };

  const symCounts: Record<string, number> = { itching: 0, headache: 0, redness: 0, mucus: 0, vomiting: 0, bleeding: 0, sneezing: 0 };
  filteredLogs.forEach(l => {
    Object.entries(l.symptoms || {}).forEach(([k, v]: any) => {
      if ((v?.on || v?.active || v === true) && k in symCounts) symCounts[k]++;
    });
    if ((l.sneezing?.count || 0) > 0) symCounts.sneezing++;
  });
  const maxSym = Math.max(...Object.values(symCounts), 1);

  const latestRisk = (() => {
    if (!filteredLogs[0]) return { score: 0, label: "No data", color: "#64748b" };
    const score = getRiskScore(filteredLogs[0]);
    if (score < 40) return { score, label: "Low", color: "#22c55e" };
    if (score < 65) return { score, label: "Moderate", color: "#f59e0b" };
    return { score, label: "High", color: "#ef4444" };
  })();

  // 🔔 Alert Center breaches
  const highRiskBreaches = logs.filter(l => getRiskScore(l) >= 65 || (l.sneezing?.count || 0) >= 8 || (l.wellness?.stress || 0) >= 8);

  // 🐾 Allergen Heatmap Matrix Analysis
  const ALLERGEN_MAP = [
    { id: "pollen", label: "Pollen", icon: "🌳" },
    { id: "dust", label: "Dust", icon: "🧹" },
    { id: "pets", label: "Pets", icon: "🐱" },
    { id: "mold", label: "Mold", icon: "🍄" },
    { id: "perfume", label: "Perfume", icon: "🧴" },
    { id: "smoke", label: "Smoke", icon: "🚬" },
  ];

  const allergenStats = ALLERGEN_MAP.map(alg => {
    const exposed = filteredLogs.filter(l => (l.wellness?.allergens || []).includes(alg.id));
    const unexposed = filteredLogs.filter(l => !(l.wellness?.allergens || []).includes(alg.id));

    const count = exposed.length;
    const avgRiskExp = exposed.length ? Math.round(exposed.reduce((acc, l) => acc + getRiskScore(l), 0) / exposed.length) : 0;
    const avgRiskUnexp = unexposed.length ? Math.round(unexposed.reduce((acc, l) => acc + getRiskScore(l), 0) / unexposed.length) : 0;
    const riskDiff = avgRiskUnexp ? Math.round(((avgRiskExp - avgRiskUnexp) / avgRiskUnexp) * 100) : 0;

    return { ...alg, count, avgRiskExp, avgRiskUnexp, riskDiff };
  });

  // Pearson Correlation calculation
  const computeCorrelation = (pk1: ParamKey, pk2: ParamKey) => {
    const cfg1 = PARAM_CONFIGS[pk1];
    const cfg2 = PARAM_CONFIGS[pk2];
    const pairs: { x: number; y: number }[] = [];
    chronoLogs.forEach(l => {
      const v1 = cfg1.getValue(l);
      const v2 = cfg2.getValue(l);
      if (v1 !== null && v2 !== null) {
        pairs.push({ x: v1, y: v2 });
      }
    });
    if (pairs.length < 3) return null;
    const n = pairs.length;
    const sumX = pairs.reduce((acc, p) => acc + p.x, 0);
    const sumY = pairs.reduce((acc, p) => acc + p.y, 0);
    const sumXY = pairs.reduce((acc, p) => acc + p.x * p.y, 0);
    const sumX2 = pairs.reduce((acc, p) => acc + p.x * p.x, 0);
    const sumY2 = pairs.reduce((acc, p) => acc + p.y * p.y, 0);
    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (den === 0) return 0;
    return num / den;
  };

  // Generate MedGemma Report Markdown Text
  const generateMedGemmaPrompt = () => {
    const patientName = selectedPatient === "all" ? "All Patients Cohort" : selectedPatient;
    const sorted = [...filteredLogs].sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
    const startDate = sorted[0]?.profile?.date || "—";
    const endDate = sorted[sorted.length - 1]?.profile?.date || "—";
    const activeSymptoms = Object.entries(symCounts).filter(([, c]) => c > 0).map(([k, c]) => `${k} (${c}x)`).join(", ");
    const topTriggers = allergenStats.filter(a => a.count > 0).map(a => `${a.icon} ${a.label} (${a.count} logs, Risk ${a.avgRiskExp}%)`).join(", ");

    return `### ZenSit Clinical Telemetry Summary Report
**Patient Profile:** ${patientName}
**Observation Window:** ${startDate} to ${endDate} (${filteredLogs.length} total logs)
**Environmental Baseline:** Avg Temp ${avgTemp()}, Avg Humidity ${avgHum()}
**Symptom Occurrences:** ${activeSymptoms || "None"}
**Identified Trigger Exposures:** ${topTriggers || "None"}
**Latest Risk Index:** ${latestRisk.score}% (${latestRisk.label})

**Clinical Objective for MedGemma:**
Analyze the above longitudinal telemetry data for potential environmental allergy flare triggers, nocturnal symptom aggravation, and recommend non-pharmacological ambient modifications or clinical evaluation steps.`;
  };

  // ─── Login gate ────────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={{ minHeight: "100svh", background: "var(--bg)", display: "flex", alignItems: "center",
      justifyContent: "center", padding: 24, fontFamily: "var(--font)" }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, background: "var(--indigo-lo)", border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px", overflow: "hidden" }}>
            <img src="/icon-192x192.png" alt="Zensit Logo" style={{ width: "70%", height: "70%", objectFit: "contain" }} />
          </div>
          <h1 style={{ fontWeight: 900, fontSize: "1.4rem", color: "#fff", marginBottom: 6 }}>Clinical Console</h1>
          <p className="t-body" style={{ fontSize: "0.875rem" }}>Enter your admin password to continue</p>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <form onSubmit={login} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label className="t-label" style={{ display: "block", marginBottom: 8 }}>Password</label>
              <input className="input" type="password" value={pw} autoFocus
                onChange={e => { setPw(e.target.value); setPwErr(""); }}
                placeholder="Enter password…" />
            </div>
            {pwErr && (
              <div className="pill pill-red" style={{ borderRadius: 10, padding: "10px 14px", fontSize: "0.8125rem" }}>
                ⚠ {pwErr}
              </div>
            )}
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>Unlock →</button>
          </form>
        </div>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <a href="/wizard" className="t-label" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "0.75rem" }}>
            ← Back to Wizard
          </a>
        </div>
      </div>
    </div>
  );

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100svh", background: "var(--bg)", fontFamily: "var(--font)", paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 50 }}>
        <div className="container" style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <a href="/wizard" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", fontWeight: 900, fontSize: "1.1rem", color: "#fff",
              letterSpacing: "-0.03em" }}>
              <img src="/icon-192x192.png" alt="Zensit" style={{ width: 22, height: 22, objectFit: "contain" }} />
              Zensit <span style={{ color: "#818cf8" }}>Console</span>
            </a>
            <div className="t-label" style={{ marginTop: 2, fontSize: "0.65rem" }}>
              {selectedPatient === "all" ? `${filteredLogs.length} total logs` : `${filteredLogs.length} of ${logs.length} logs for ${selectedPatient}`}
            </div>
          </div>

          {/* 🔍 Search Input Bar */}
          <div style={{ flex: 1, maxWidth: 280, minWidth: 180 }}>
            <input
              type="text"
              className="input"
              placeholder="🔍 Search symptoms, meds, food, location…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                padding: "6px 12px",
                fontSize: "0.8125rem",
                width: "100%",
                background: "var(--bg)",
                color: "#fff",
                border: "1px solid var(--border)",
                borderRadius: "10px"
              }}
            />
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {patients.length > 0 && (
              <select
                value={selectedPatient}
                onChange={e => setSelectedPatient(e.target.value)}
                className="input"
                style={{ 
                  padding: "6px 12px", 
                  fontSize: "0.8125rem", 
                  width: "auto", 
                  background: "var(--bg)", 
                  color: "var(--text)", 
                  border: "1px solid var(--border)",
                  borderRadius: "10px"
                }}
              >
                <option value="all">👥 All Patients</option>
                {patients.map(p => (
                  <option key={p} value={p}>👤 {p}</option>
                ))}
              </select>
            )}
            {selectedPatient !== "all" && (
              <button
                onClick={() => deletePatientProfile(selectedPatient)}
                className="btn btn-danger btn-sm"
                title={`Delete profile and all ${filteredLogs.length} logs for ${selectedPatient}`}
                style={{ background: "rgba(239, 68, 68, 0.2)", color: "#fca5a5", border: "1px solid rgba(239, 68, 68, 0.4)", display: "flex", alignItems: "center", gap: 4 }}
              >
                🗑️ Profile
              </button>
            )}
            <button onClick={() => setShowReportModal(true)} className="btn btn-ghost btn-sm" style={{ background: "var(--indigo-lo)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8" }}>
              📄 Clinical Report
            </button>
            <button onClick={exportJSON} className="btn btn-primary btn-sm">⬇ Export JSON</button>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 24 }}>
        {/* 🔔 High-Risk Alert Center Banner */}
        {highRiskBreaches.length > 0 && (
          <div style={{
            marginBottom: 20,
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: 14,
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "1.2rem" }}>🚨</span>
              <div>
                <div style={{ fontWeight: 800, color: "#fca5a5", fontSize: "0.875rem" }}>
                  Clinical Threshold Alert: {highRiskBreaches.length} High-Risk Incidents Detected
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Logs containing Risk $\ge 65\%$, Sneezes $\ge 8$, or Stress $\ge 8/10$ requiring attention.
                </div>
              </div>
            </div>

            <button
              onClick={() => setOnlyHighRiskFilter(prev => !prev)}
              className="btn btn-sm"
              style={{
                background: onlyHighRiskFilter ? "#ef4444" : "rgba(239, 68, 68, 0.2)",
                color: "#fff",
                border: "1px solid rgba(239, 68, 68, 0.5)"
              }}
            >
              {onlyHighRiskFilter ? "✓ Showing High Risk Only" : "⚡ Filter High Risk Incidents"}
            </button>
          </div>
        )}

        {/* Tab bar + Date Range Selector */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 0, background: "var(--surface)",
            border: "1px solid var(--border)", borderRadius: 14, padding: 4, width: "fit-content" }}>
            {(["overview", "timeline", "feed"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className="btn"
                style={{
                  padding: "8px 20px", fontSize: "0.8125rem",
                  background: tab === t ? "var(--indigo)" : "transparent",
                  color: tab === t ? "#fff" : "var(--muted)",
                  borderRadius: 10, border: "none",
                }}>
                {t === "overview" ? "📈 Overview" : t === "timeline" ? "⏱️ Timeline & Trends" : "📋 All Logs"}
              </button>
            ))}
          </div>

          {/* 📅 Date Range Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="t-label" style={{ fontSize: "0.65rem" }}>Time Window:</span>
            {(["all", "30d", "7d"] as const).map(r => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: dateRange === r ? "var(--surface-2)" : "transparent",
                  border: dateRange === r ? "1px solid var(--indigo)" : "1px solid var(--border)",
                  color: dateRange === r ? "#fff" : "var(--muted)"
                }}
              >
                {r === "all" ? "All Time" : r === "30d" ? "Last 30 Days" : "Last 7 Days"}
              </button>
            ))}
          </div>
        </div>

        {/* 🧪 Correlation Filter Bar: Allergen & Symptom Isolators */}
        <div style={{
          marginBottom: 24,
          padding: "14px 18px",
          background: "rgba(14, 20, 32, 0.75)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 800, color: "#818cf8", display: "flex", alignItems: "center", gap: 6 }}>
              🧪 Correlation Filters:
            </span>

            {/* Allergen Exposure Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="t-label" style={{ fontSize: "0.65rem" }}>Trigger Exposure:</span>
              <select
                value={selectedAllergen}
                onChange={e => setSelectedAllergen(e.target.value)}
                style={{
                  background: "var(--surface)",
                  color: "#fff",
                  border: selectedAllergen !== "all" ? "1px solid var(--indigo)" : "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "5px 10px",
                  fontSize: "0.78125rem",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                <option value="all">🐾 All Triggers</option>
                <option value="pollen">🌳 Pollen</option>
                <option value="dust">🧹 Dust</option>
                <option value="pets">🐱 Pets / Dander</option>
                <option value="mold">🍄 Mold / Dampness</option>
                <option value="perfume">🧴 Perfumes / Chemicals</option>
                <option value="smoke">🚬 Smoke / Smog</option>
              </select>
            </div>

            {/* Symptom Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="t-label" style={{ fontSize: "0.65rem" }}>Target Symptom:</span>
              <select
                value={selectedSymptom}
                onChange={e => setSelectedSymptom(e.target.value)}
                style={{
                  background: "var(--surface)",
                  color: "#fff",
                  border: selectedSymptom !== "all" ? "1px solid var(--indigo)" : "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "5px 10px",
                  fontSize: "0.78125rem",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                <option value="all">🩺 All Symptoms</option>
                <option value="itching">😣 Skin Itching</option>
                <option value="redness">🔴 Skin Redness</option>
                <option value="headache">🤕 Headache</option>
                <option value="mucus">💧 Excess Mucus</option>
                <option value="vomiting">🤢 Nausea / Vomiting</option>
                <option value="bleeding">🩸 Bleeding</option>
                <option value="eye_itching">👁️ Eye Itching</option>
                <option value="breathing">😮‍💨 Breathing Diff.</option>
                <option value="coughing">😷 Dry Coughing</option>
              </select>
            </div>
          </div>

          {(selectedAllergen !== "all" || selectedSymptom !== "all") && (
            <button
              onClick={() => { setSelectedAllergen("all"); setSelectedSymptom("all"); }}
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                color: "#fca5a5",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                borderRadius: 8,
                padding: "5px 12px",
                fontSize: "0.72rem",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              ✕ Reset Correlation Filters
            </button>
          )}
        </div>

        {/* ── OVERVIEW ──────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Metric cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              {[
                { label: "Total Logs",    value: String(filteredLogs.length), icon: "📋", color: "#818cf8" },
                { label: "Avg Temp",      value: avgTemp(),                   icon: "🌡️", color: "#fb923c" },
                { label: "Avg Humidity",  value: avgHum(),                    icon: "💧", color: "#60a5fa" },
                { label: "Latest Risk",   value: `${latestRisk.score}%`,      icon: "⚠️", color: latestRisk.color },
              ].map((m, i) => (
                <div key={i} className="card" style={{ padding: "20px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <span className="t-label" style={{ lineHeight: 1.3 }}>{m.label}</span>
                    <span style={{ fontSize: "1.25rem" }}>{m.icon}</span>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: "1.8rem", letterSpacing: "-0.04em",
                    color: m.color, lineHeight: 1 }}>{m.value}</div>
                  {i === 3 && <div className="t-label" style={{ marginTop: 4, color: latestRisk.color, fontSize: "0.65rem" }}>{latestRisk.label}</div>}
                </div>
              ))}
            </div>

            {/* Allergen Heatmap Matrix + Symptom Frequency */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
              {/* 🐾 Allergen Trigger Heatmap Card */}
              <div className="card" style={{ padding: "24px 20px" }}>
                <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.9375rem", marginBottom: 16,
                  paddingBottom: 12, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>🐾 Allergen Trigger Heatmap</span>
                  <span className="pill pill-indigo" style={{ fontSize: "0.65rem" }}>Exposure Impact</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {allergenStats.map(alg => (
                    <div key={alg.id} style={{ background: "var(--surface-2)", borderRadius: 10, padding: "10px 12px", border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, color: "#fff", fontSize: "0.8125rem" }}>
                          {alg.icon} {alg.label}
                        </span>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{alg.count} logs</span>
                          {alg.count > 0 && (
                            <span style={{
                              fontSize: "0.7rem",
                              fontWeight: 800,
                              padding: "2px 6px",
                              borderRadius: 6,
                              background: alg.riskDiff > 0 ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
                              color: alg.riskDiff > 0 ? "#ef4444" : "#22c55e"
                            }}>
                              {alg.riskDiff > 0 ? `+${alg.riskDiff}% Risk` : `${alg.riskDiff}% Risk`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress meter */}
                      <div style={{ height: 6, background: "var(--surface)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 999,
                          width: `${Math.min(100, (alg.count / Math.max(filteredLogs.length, 1)) * 100)}%`,
                          background: alg.riskDiff > 20 ? "linear-gradient(90deg, #f59e0b, #ef4444)" : "linear-gradient(90deg, #6366f1, #818cf8)",
                          transition: "width 0.8s ease"
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Symptom distribution */}
              <div className="card" style={{ padding: "24px 20px" }}>
                <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.9375rem", marginBottom: 20,
                  paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                  Symptom Frequency
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {Object.entries(symCounts).map(([k, count]) => (
                    <div key={k}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ color: "var(--text)", fontSize: "0.8125rem", fontWeight: 600, textTransform: "capitalize" }}>{k}</span>
                        <span style={{ color: "var(--muted)", fontSize: "0.75rem", fontWeight: 600 }}>{count}</span>
                      </div>
                      <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 999,
                          width: `${Math.round((count / maxSym) * 100)}%`,
                          background: "linear-gradient(90deg, #6366f1, #818cf8)",
                          transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TIMELINE & COMPARATIVE TRENDS ──────────────────────────── */}
        {tab === "timeline" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Header Controls & Parameter Selector */}
            <div className="card-hi" style={{ padding: "24px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
                <div>
                  <h2 style={{ fontWeight: 800, fontSize: "1.2rem", color: "#fff", marginBottom: 4 }}>
                    ⏱️ Parameter Timeline Comparison
                  </h2>
                  <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                    Select parameters below to overlay & compare stats chronologically on the comparative graph.
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={() => setAggregateDaily(prev => !prev)}
                    className="btn btn-sm"
                    style={{
                      background: aggregateDaily ? "var(--indigo)" : "var(--surface-2)",
                      color: aggregateDaily ? "#fff" : "var(--muted)",
                      border: "1px solid var(--border)"
                    }}
                  >
                    {aggregateDaily ? "📊 Daily Aggregated" : "📍 Raw Logs"}
                  </button>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", background: "rgba(255,255,255,0.03)", padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                    {chronoLogs.length} Data Points Logged
                  </div>
                </div>
              </div>

              {/* Parameter Chip Selectors */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(Object.keys(PARAM_CONFIGS) as ParamKey[]).map(pk => {
                  const cfg = PARAM_CONFIGS[pk];
                  const isSelected = selectedParams.includes(pk);
                  const validVals = chronoLogs.map(l => cfg.getValue(l)).filter(v => v !== null) as number[];
                  const avgVal = validVals.length ? Math.round((validVals.reduce((a, b) => a + b, 0) / validVals.length) * 10) / 10 : null;

                  return (
                    <button
                      key={pk}
                      onClick={() => toggleParam(pk)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 12,
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        background: isSelected ? `${cfg.color}18` : "rgba(255,255,255,0.02)",
                        border: isSelected ? `1.5px solid ${cfg.color}` : "1px solid var(--border)",
                        color: isSelected ? "#fff" : "var(--muted)",
                        boxShadow: isSelected ? `0 0 12px ${cfg.color}30` : "none"
                      }}
                    >
                      <span style={{ fontSize: "1rem" }}>{cfg.icon}</span>
                      <span>{cfg.label}</span>
                      {avgVal !== null && (
                        <span style={{
                          fontSize: "0.7rem",
                          background: isSelected ? cfg.color : "var(--surface-2)",
                          color: isSelected ? "#000" : "var(--text)",
                          padding: "2px 6px",
                          borderRadius: 999,
                          fontWeight: 800,
                          marginLeft: 4
                        }}>
                          {avgVal}{cfg.unit}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SVG COMPARATIVE MULTI-LINE TIMELINE GRAPH */}
            <div className="card" style={{ padding: "24px 20px", position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: "1rem", color: "#fff" }}>Normalized Parameter Overlay</span>
                  <span className="t-label" style={{ fontSize: "0.65rem", background: "var(--indigo-lo)", padding: "2px 8px", borderRadius: 6, color: "#818cf8" }}>
                    0% – 100% Scale Normalized
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {selectedParams.map(pk => {
                    const cfg = PARAM_CONFIGS[pk];
                    return (
                      <span key={pk} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.75rem", color: cfg.color, fontWeight: 700 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color }} />
                        {cfg.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              {chronoLogs.length < 2 ? (
                <div style={{ height: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>📊</div>
                  <p style={{ fontSize: "0.875rem" }}>Need at least 2 logs matching filter criteria to generate a timeline chart.</p>
                  <a href="/wizard" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>+ Add Log in Wizard</a>
                </div>
              ) : (
                (() => {
                  const W = 800;
                  const H = 260;
                  const PL = 36;
                  const PR = 20;
                  const PT = 24;
                  const PB = 40;
                  const cW = W - PL - PR;
                  const cH = H - PT - PB;
                  const N = chronoLogs.length;

                  const paramScales = selectedParams.map(pk => {
                    const cfg = PARAM_CONFIGS[pk];
                    const rawVals = chronoLogs.map(l => cfg.getValue(l));
                    const validVals = rawVals.filter(v => v !== null) as number[];
                    let min = validVals.length ? Math.min(...validVals) : 0;
                    let max = validVals.length ? Math.max(...validVals) : 100;
                    if (min === max) { min = min - 1; max = max + 1; }
                    return { pk, cfg, min, max };
                  });

                  const pointsMap = selectedParams.map(pk => {
                    const scale = paramScales.find(s => s.pk === pk)!;
                    const cfg = PARAM_CONFIGS[pk];
                    const pts = chronoLogs.map((l, i) => {
                      const val = cfg.getValue(l);
                      const x = PL + (N > 1 ? (i / (N - 1)) * cW : cW / 2);
                      let y = H - PB - cH / 2;
                      if (val !== null) {
                        const norm = (val - scale.min) / (scale.max - scale.min);
                        y = H - PB - norm * cH;
                      }
                      return { x, y, val, log: l, index: i };
                    });

                    let pathD = "";
                    let isFirst = true;
                    pts.forEach(p => {
                      if (p.val !== null) {
                        pathD += `${isFirst ? "M" : " L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                        isFirst = false;
                      }
                    });

                    return { pk, cfg, pts, pathD };
                  });

                  const activeHoverIndex = hoveredPointIdx !== null ? hoveredPointIdx : null;
                  const hoveredLog = activeHoverIndex !== null ? chronoLogs[activeHoverIndex] : null;

                  return (
                    <div style={{ position: "relative", width: "100%" }}>
                      <svg
                        viewBox={`0 0 ${W} ${H}`}
                        style={{ width: "100%", height: "auto", overflow: "visible" }}
                        onMouseLeave={() => setHoveredPointIdx(null)}
                      >
                        {/* Grid lines */}
                        {[0, 0.25, 0.5, 0.75, 1].map((r, idx) => {
                          const y = PT + r * cH;
                          return (
                            <g key={idx}>
                              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} strokeDasharray={r === 0.5 ? "4 4" : "none"} />
                              <text x={PL - 6} y={y + 3} fill="var(--dim)" fontSize="9" textAnchor="end" fontWeight="600">
                                {Math.round((1 - r) * 100)}%
                              </text>
                            </g>
                          );
                        })}

                        {/* Parameter Paths */}
                        {pointsMap.map(({ pk, cfg, pts, pathD }) => (
                          <g key={pk}>
                            {pathD && (
                              <path
                                d={pathD}
                                fill="none"
                                stroke={cfg.color}
                                strokeWidth={2.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ transition: "d 0.3s ease" }}
                              />
                            )}

                            {pts.map((p, i) => {
                              if (p.val === null) return null;
                              const isHovered = activeHoverIndex === i;
                              const isPinned = pinnedLogId === p.log.id;
                              return (
                                <circle
                                  key={i}
                                  cx={p.x}
                                  cy={p.y}
                                  r={isHovered || isPinned ? 6 : 3.5}
                                  fill="var(--bg)"
                                  stroke={cfg.color}
                                  strokeWidth={isHovered || isPinned ? 3 : 2}
                                  style={{ cursor: "pointer", transition: "all 0.15s ease" }}
                                  onClick={() => setPinnedLogId(p.log.id)}
                                />
                              );
                            })}
                          </g>
                        ))}

                        {/* Hover Vertical Guide Line */}
                        {activeHoverIndex !== null && (() => {
                          const x = PL + (N > 1 ? (activeHoverIndex / (N - 1)) * cW : cW / 2);
                          return (
                            <line
                              x1={x}
                              y1={PT}
                              x2={x}
                              y2={H - PB}
                              stroke="rgba(255,255,255,0.3)"
                              strokeWidth={1.5}
                              strokeDasharray="3 3"
                              pointerEvents="none"
                            />
                          );
                        })()}

                        {/* X-axis date labels */}
                        {chronoLogs.map((l, i) => {
                          const x = PL + (N > 1 ? (i / (N - 1)) * cW : cW / 2);
                          const dateLabel = l.profile?.date ? l.profile.date.slice(5) : `Log #${i+1}`;
                          if (N > 10 && i % Math.ceil(N / 8) !== 0 && i !== N - 1) return null;
                          return (
                            <text
                              key={i}
                              x={x}
                              y={H - 12}
                              fill={activeHoverIndex === i ? "#fff" : "var(--muted)"}
                              fontSize="10"
                              fontWeight={activeHoverIndex === i ? "800" : "500"}
                              textAnchor="middle"
                            >
                              {dateLabel}
                            </text>
                          );
                        })}

                        {/* Transparent Overlay Rects for Easy Mouse Scrubbing */}
                        {chronoLogs.map((l, i) => {
                          const itemW = cW / N;
                          const x = PL + i * itemW - itemW / 2;
                          return (
                            <rect
                              key={i}
                              x={Math.max(PL, x)}
                              y={PT}
                              width={itemW}
                              height={cH}
                              fill="transparent"
                              style={{ cursor: "pointer" }}
                              onMouseEnter={() => setHoveredPointIdx(i)}
                              onClick={() => setPinnedLogId(l.id)}
                            />
                          );
                        })}
                      </svg>

                      {/* Interactive Telemetry Card Tooltip */}
                      {hoveredLog && (
                        <div style={{
                          marginTop: 16,
                          background: "var(--surface-2)",
                          border: "1px solid var(--indigo)",
                          borderRadius: 14,
                          padding: "14px 18px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 12,
                          boxShadow: "0 8px 24px rgba(99,102,241,0.2)"
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--indigo-lo)", border: "1px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#818cf8" }}>
                              #{hoveredPointIdx! + 1}
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, color: "#fff", fontSize: "0.9375rem" }}>
                                👤 {hoveredLog.profile?.name || "Anonymous Patient"}
                              </div>
                              <div className="t-label" style={{ fontSize: "0.6875rem", marginTop: 2 }}>
                                📅 {hoveredLog.profile?.date || "—"} {hoveredLog.profile?.time || ""} · 📍 {hoveredLog.profile?.location || "—"}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                            {selectedParams.map(pk => {
                              const cfg = PARAM_CONFIGS[pk];
                              const val = cfg.getValue(hoveredLog);
                              return (
                                <div key={pk} style={{ textAlign: "center", background: "var(--surface)", padding: "6px 12px", borderRadius: 8, border: `1px solid ${cfg.color}40` }}>
                                  <div style={{ fontSize: "0.65rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                                    {cfg.icon} {cfg.label}
                                  </div>
                                  <div style={{ fontWeight: 900, fontSize: "0.95rem", color: cfg.color }}>
                                    {val !== null ? `${val} ${cfg.unit}` : "—"}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>

            {/* CORRELATION & STATISTICAL COMPARISON MATRIX */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
              {/* Statistical Summary Panel */}
              <div className="card" style={{ padding: "22px 20px" }}>
                <div style={{ fontWeight: 800, color: "#fff", fontSize: "1rem", marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
                  📊 Parameter Statistics Breakdown
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {selectedParams.map(pk => {
                    const cfg = PARAM_CONFIGS[pk];
                    const vals = chronoLogs.map(l => cfg.getValue(l)).filter(v => v !== null) as number[];
                    if (!vals.length) return null;
                    const min = Math.min(...vals);
                    const max = Math.max(...vals);
                    const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
                    
                    const mid = Math.floor(vals.length / 2);
                    const firstHalfAvg = vals.slice(0, mid).length ? vals.slice(0, mid).reduce((a,b)=>a+b,0)/mid : avg;
                    const secondHalfAvg = vals.slice(mid).length ? vals.slice(mid).reduce((a,b)=>a+b,0)/(vals.length - mid) : avg;
                    const diff = secondHalfAvg - firstHalfAvg;
                    const trendIcon = diff > 0.5 ? "📈" : diff < -0.5 ? "📉" : "➡️";

                    return (
                      <div key={pk} style={{ background: "var(--surface-2)", borderRadius: 12, padding: "12px 14px", border: `1px solid ${cfg.color}30` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: cfg.color, fontSize: "0.875rem" }}>
                            <span>{cfg.icon}</span>
                            <span>{cfg.label}</span>
                          </div>
                          <span style={{ fontSize: "0.75rem", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 6, color: "var(--text)", fontWeight: 700 }}>
                            {trendIcon} Trend
                          </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center", fontSize: "0.75rem" }}>
                          <div>
                            <div className="t-label" style={{ fontSize: "0.6rem" }}>MIN</div>
                            <div style={{ fontWeight: 800, color: "#fff", marginTop: 2 }}>{min}{cfg.unit}</div>
                          </div>
                          <div>
                            <div className="t-label" style={{ fontSize: "0.6rem" }}>AVG</div>
                            <div style={{ fontWeight: 900, color: cfg.color, marginTop: 2 }}>{avg}{cfg.unit}</div>
                          </div>
                          <div>
                            <div className="t-label" style={{ fontSize: "0.6rem" }}>MAX</div>
                            <div style={{ fontWeight: 800, color: "#fff", marginTop: 2 }}>{max}{cfg.unit}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Clinical Correlation Engine */}
              <div className="card" style={{ padding: "22px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 800, color: "#fff", fontSize: "1rem", marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>💡 Clinical Correlation Insights</span>
                    <span className="pill pill-indigo" style={{ fontSize: "0.65rem" }}>Pearson Analysis</span>
                  </div>

                  {(() => {
                    const correlations: { p1: ParamKey; p2: ParamKey; r: number }[] = [];
                    for (let i = 0; i < selectedParams.length; i++) {
                      for (let j = i + 1; j < selectedParams.length; j++) {
                        const p1 = selectedParams[i];
                        const p2 = selectedParams[j];
                        const r = computeCorrelation(p1, p2);
                        if (r !== null && !isNaN(r)) {
                          correlations.push({ p1, p2, r });
                        }
                      }
                    }

                    if (correlations.length === 0) {
                      return (
                        <div style={{ padding: "20px 0", color: "var(--muted)", fontStyle: "italic", fontSize: "0.875rem", textAlign: "center" }}>
                          Select 2+ parameters with 3+ matching data points to run correlation analysis.
                        </div>
                      );
                    }

                    correlations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {correlations.slice(0, 4).map(({ p1, p2, r }, idx) => {
                          const cfg1 = PARAM_CONFIGS[p1];
                          const cfg2 = PARAM_CONFIGS[p2];
                          const absR = Math.abs(r);
                          const strength = absR > 0.7 ? "Strong" : absR > 0.4 ? "Moderate" : "Weak";
                          const direction = r > 0 ? "positive (+)" : "inverse (-)";
                          const badgeColor = absR > 0.6 ? "#22c55e" : absR > 0.3 ? "#f59e0b" : "#64748b";

                          return (
                            <div key={idx} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#fff" }}>
                                  {cfg1.icon} {cfg1.label} vs {cfg2.icon} {cfg2.label}
                                </div>
                                <span style={{ fontSize: "0.7rem", fontWeight: 800, color: badgeColor, background: `${badgeColor}15`, padding: "2px 8px", borderRadius: 6 }}>
                                  r = {r > 0 ? `+${r.toFixed(2)}` : r.toFixed(2)}
                                </span>
                              </div>
                              <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>
                                Shows <strong style={{ color: "#fff" }}>{strength} {direction}</strong> relationship across patient logs.
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: "0.75rem", color: "var(--dim)" }}>
                  ⓘ Correlation coefficients measure linear association strength between telemetry variables.
                </div>
              </div>
            </div>

            {/* CHRONOLOGICAL TIMELINE STREAM */}
            <div className="card" style={{ padding: "24px 20px" }}>
              <div style={{ fontWeight: 800, color: "#fff", fontSize: "1rem", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>📜 Chronological Log Stream</span>
                {pinnedLogId && (
                  <button onClick={() => setPinnedLogId(null)} className="btn btn-ghost btn-sm" style={{ fontSize: "0.75rem" }}>
                    ✕ Clear Pinned Highlight
                  </button>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {chronoLogs.map((l, i) => {
                  const isPinned = pinnedLogId === l.id;
                  const activeSyms = Object.entries(l.symptoms || {}).filter(([, v]: any) => v?.on || v?.active || v === true);
                  const sneezes   = l.sneezing?.count || 0;
                  const loc       = l.profile?.location || l.profile?.locationTag || "—";
                  const wellness  = l.wellness || {};
                  const temp      = l.exposure?.temperature || "—";
                  const hum       = l.exposure?.humidity || "—";
                  const risk      = getRiskScore(l);

                  return (
                    <div
                      key={l.id}
                      style={{
                        position: "relative",
                        paddingLeft: 32,
                        transition: "all 0.2s ease"
                      }}
                    >
                      {i < chronoLogs.length - 1 && (
                        <div style={{
                          position: "absolute",
                          left: 11,
                          top: 24,
                          bottom: -20,
                          width: 2,
                          background: isPinned ? "var(--indigo)" : "var(--border)"
                        }} />
                      )}

                      <div style={{
                        position: "absolute",
                        left: 4,
                        top: 14,
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: isPinned ? "var(--indigo)" : "var(--surface-2)",
                        border: isPinned ? "3px solid #818cf8" : "2px solid var(--border)",
                        boxShadow: isPinned ? "0 0 12px rgba(99,102,241,0.5)" : "none",
                        zIndex: 2
                      }} />

                      <div
                        className={isPinned ? "card-hi" : "card"}
                        style={{
                          padding: 16,
                          border: isPinned ? "1px solid var(--indigo)" : "1px solid var(--border)",
                          background: isPinned ? "rgba(99, 102, 241, 0.08)" : "rgba(14, 20, 32, 0.65)"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontWeight: 800, color: "#fff", fontSize: "0.9375rem" }}>
                              👤 {l.profile?.name || "Anonymous Patient"}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                              📅 {l.profile?.date || "—"} {l.profile?.time || ""}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span className="pill pill-indigo" style={{ fontSize: "0.65rem" }}>📍 {loc}</span>
                            <span style={{
                              fontSize: "0.65rem",
                              padding: "3px 8px",
                              borderRadius: 6,
                              fontWeight: 800,
                              background: risk > 65 ? "rgba(239,68,68,0.15)" : risk > 40 ? "rgba(245,158,11,0.15)" : "rgba(34,197,94,0.15)",
                              color: risk > 65 ? "#ef4444" : risk > 40 ? "#fb923c" : "#22c55e"
                            }}>
                              Risk {risk}%
                            </span>
                            {!l.isAggregated && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSingleLog(l.id, l.profile?.name, l.profile?.date);
                                }}
                                style={{
                                  background: "rgba(239, 68, 68, 0.12)",
                                  border: "1px solid rgba(239, 68, 68, 0.3)",
                                  color: "#fca5a5",
                                  borderRadius: 6,
                                  padding: "2px 6px",
                                  fontSize: "0.7rem",
                                  cursor: "pointer"
                                }}
                                title="Delete this log entry"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, background: "var(--surface)", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)" }}>
                          <span style={{ fontSize: "0.75rem", color: "#fb923c", fontWeight: 700 }}>🌡️ {temp}</span>
                          <span style={{ fontSize: "0.75rem", color: "#38bdf8", fontWeight: 700 }}>💧 {hum}</span>
                          {sneezes > 0 && <span style={{ fontSize: "0.75rem", color: "#f59e0b", fontWeight: 700 }}>😤 {sneezes} sneezes</span>}
                          {wellness.stress && <span style={{ fontSize: "0.75rem", color: "#ec4899", fontWeight: 700 }}>🧠 Stress {wellness.stress}/10</span>}
                          {wellness.sleep?.hours && <span style={{ fontSize: "0.75rem", color: "#818cf8", fontWeight: 700 }}>🌙 Sleep {wellness.sleep.hours}h</span>}
                          {activeSyms.length > 0 && (
                            <span style={{ fontSize: "0.75rem", color: "#ef4444", fontWeight: 700 }}>🩺 {activeSyms.length} symptoms</span>
                          )}
                        </div>

                        {activeSyms.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                            {activeSyms.map(([k]) => (
                              <span key={k} className="pill pill-red" style={{ fontSize: "0.65rem", textTransform: "capitalize" }}>
                                {k}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── FEED ─────────────────────────────────────────────────── */}
        {tab === "feed" && (
          loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              paddingTop: 80, color: "var(--muted)" }}>
              <div style={{ width: 20, height: 20, border: "2px solid var(--indigo)", borderTopColor: "transparent",
                borderRadius: "50%", animation: "spinSlow 0.8s linear infinite" }} />
              <span style={{ fontSize: "0.9rem" }}>Loading logs…</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: 80, color: "var(--muted)" }}>
              <div style={{ fontSize: "3rem", marginBottom: 16 }}>📭</div>
              <p style={{ marginBottom: 20 }}>No logs match the current search or filter criteria.</p>
              <button onClick={() => { setSearchTerm(""); setSelectedPatient("all"); setOnlyHighRiskFilter(false); }} className="btn btn-ghost btn-sm">Clear Search Filters</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 16px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={filteredLogs.length > 0 && filteredLogs.every(l => selectedLogs.includes(l.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const allIds = filteredLogs.map(l => l.id);
                        setSelectedLogs(prev => Array.from(new Set([...prev, ...allIds])));
                      } else {
                        const filteredIds = filteredLogs.map(l => l.id);
                        setSelectedLogs(prev => prev.filter(id => !filteredIds.includes(id)));
                      }
                    }}
                    style={{ accentColor: "var(--indigo)", cursor: "pointer" }}
                  />
                  <span>Select All ({filteredLogs.length} logs)</span>
                </label>
                {selectedLogs.length > 0 && (
                  <span style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 600 }}>
                    {selectedLogs.length} selected
                  </span>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                {filteredLogs.map(l => {
                  const activeSyms = Object.entries(l.symptoms || {}).filter(([, v]: any) => v?.on || v?.active || v === true);
                  const sneezes   = l.sneezing?.count || 0;
                  const loc       = l.profile?.location || l.profile?.locationTag || "—";
                  const wellness  = l.wellness || {};
                  const emotions: string[]  = wellness.emotions || [];
                  const stomach = wellness.stomach?.movement || "";
                  const urineColor = wellness.urine?.color || "";
                  const urineThick = wellness.urine?.thickness || "";
                  const bloating   = wellness.bloating?.active || false;
                  const bloatSev   = wellness.bloating?.severity;
                  const sleepH     = wellness.sleep?.hours;
                  const sleepQ     = wellness.sleep?.quality || "";
                  const stress     = wellness.stress;
                  const water      = wellness.water;
                  const allergens: string[] = wellness.allergens || [];

                  const stomachColorMap: Record<string, string> = { constipation: "#92400e", normal: "#16a34a", loose: "#0284c7" };
                  const stomachBgMap:    Record<string, string> = { constipation: "rgba(146,64,14,0.15)", normal: "rgba(22,163,74,0.12)", loose: "rgba(2,132,199,0.12)" };
                  const sleepColorMap:   Record<string, string> = { great: "#22c55e", good: "#6366f1", fair: "#f59e0b", poor: "#ef4444", none: "#9f1239" };
                  const emotionColorMap: Record<string, string> = { happy: "#22c55e", calm: "#6366f1", anxious: "#f59e0b", irritated: "#f97316", fatigued: "#60a5fa", sad: "#818cf8", overwhelmed: "#ef4444", hopeful: "#34d399" };
                  const emotionIconMap:  Record<string, string> = { happy: "😊", calm: "😌", anxious: "😰", irritated: "😤", fatigued: "😴", sad: "😢", overwhelmed: "🤯", hopeful: "🌟" };

                  const isChecked = selectedLogs.includes(l.id);

                  return (
                    <div key={l.id} className="card" style={{
                      padding: 18, display: "flex", flexDirection: "column", gap: 14,
                      border: isChecked ? "1px solid var(--indigo)" : "1px solid var(--border)",
                      background: isChecked ? "rgba(99, 102, 241, 0.05)" : "rgba(14, 20, 32, 0.65)"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedLogs(prev =>
                                prev.includes(l.id) ? prev.filter(id => id !== l.id) : [...prev, l.id]
                              );
                            }}
                            style={{ accentColor: "var(--indigo)", cursor: "pointer" }}
                          />
                          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>
                            {l.profile?.date || "—"} · {l.profile?.time || "—"}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span className="pill pill-indigo" style={{ fontSize: "0.7rem" }}>📍 {loc}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(l);
                            }}
                            style={{
                              background: "rgba(99, 102, 241, 0.15)",
                              border: "1px solid rgba(99, 102, 241, 0.35)",
                              color: "#a5b4fc",
                              borderRadius: 6,
                              padding: "3px 8px",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4
                            }}
                            title="Edit this log entry"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSingleLog(l.id, l.profile?.name, l.profile?.date);
                            }}
                            style={{
                              background: "rgba(239, 68, 68, 0.12)",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              color: "#fca5a5",
                              borderRadius: 6,
                              padding: "3px 6px",
                              fontSize: "0.7rem",
                              cursor: "pointer"
                            }}
                            title="Delete this log entry"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                        <span style={{ fontSize: "0.875rem", fontWeight: 800, color: "#fff" }}>
                          👤 {l.profile?.name || "Anonymous"}
                        </span>
                        {l.profile?.feeling && (
                          <span className="pill pill-indigo" style={{ fontSize: "0.7rem", background: "rgba(99, 102, 241, 0.1)" }}>
                            {l.profile.feeling}
                          </span>
                        )}
                      </div>

                      {emotions.length > 0 && (
                        <div>
                          <div className="t-label" style={{ fontSize: "0.6rem", marginBottom: 5 }}>💭 EMOTIONS</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {emotions.map((em: string) => (
                              <span key={em} style={{
                                fontSize: "0.7rem", padding: "3px 8px", borderRadius: 8, fontWeight: 700,
                                background: `${emotionColorMap[em] || "#6366f1"}20`,
                                border: `1px solid ${emotionColorMap[em] || "#6366f1"}50`,
                                color: emotionColorMap[em] || "#818cf8"
                              }}>
                                {emotionIconMap[em] || ""} {em.charAt(0).toUpperCase() + em.slice(1)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {allergens.length > 0 && (
                        <div>
                          <div className="t-label" style={{ fontSize: "0.6rem", marginBottom: 5 }}>🐾 ALLERGEN EXPOSURE</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {allergens.map((alg: string) => {
                              const algMap: Record<string, { icon: string; label: string }> = {
                                pollen: { icon: "🌳", label: "Pollen" },
                                dust: { icon: "🧹", label: "Dust" },
                                pets: { icon: "🐱", label: "Pets" },
                                mold: { icon: "🍄", label: "Mold" },
                                perfume: { icon: "🧴", label: "Perfume" },
                                smoke: { icon: "🚬", label: "Smoke" },
                              };
                              const info = algMap[alg] || { icon: "🐾", label: alg };
                              return (
                                <span key={alg} style={{
                                  fontSize: "0.7rem", padding: "3px 8px", borderRadius: 8, fontWeight: 700,
                                  background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa"
                                }}>
                                  {info.icon} {info.label}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[
                          { l: "Temp", v: l.exposure?.temperature || "—", c: "#fb923c" },
                          { l: "Hum",  v: l.exposure?.humidity    || "—", c: "#60a5fa" },
                        ].map((w, i) => (
                          <div key={i} style={{ background: "var(--surface-2)", borderRadius: 10, padding: "10px",
                            border: "1px solid var(--border)", textAlign: "center" }}>
                            <div className="t-label" style={{ fontSize: "0.6rem", marginBottom: 4 }}>{w.l}</div>
                            <div style={{ fontWeight: 900, fontSize: "1.1rem", color: w.c, letterSpacing: "-0.04em" }}>{w.v}</div>
                          </div>
                        ))}
                      </div>

                      {(stomach || sleepH !== undefined || sleepH !== null || stress !== undefined || water !== undefined) && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                          {stomach && (
                            <div style={{
                              background: stomachBgMap[stomach] || "var(--surface-2)",
                              border: `1px solid ${stomachColorMap[stomach] || "var(--border)"}50`,
                              borderRadius: 10, padding: "10px", textAlign: "center"
                            }}>
                              <div className="t-label" style={{ fontSize: "0.6rem", marginBottom: 4 }}>🫁 STOMACH</div>
                              <div style={{ fontWeight: 700, fontSize: "0.8rem", color: stomachColorMap[stomach] || "var(--text)", textTransform: "capitalize" }}>
                                {stomach}
                              </div>
                            </div>
                          )}
                          {sleepH !== null && sleepH !== undefined && (
                            <div style={{
                              background: sleepColorMap[sleepQ] ? `${sleepColorMap[sleepQ]}15` : "var(--surface-2)",
                              border: `1px solid ${sleepColorMap[sleepQ] || "var(--border)"}40`,
                              borderRadius: 10, padding: "10px", textAlign: "center"
                            }}>
                              <div className="t-label" style={{ fontSize: "0.6rem", marginBottom: 4 }}>🌙 SLEEP</div>
                              <div style={{ fontWeight: 700, fontSize: "0.8rem", color: sleepColorMap[sleepQ] || "#818cf8" }}>
                                {sleepH}h{sleepQ && ` · ${sleepQ.charAt(0).toUpperCase() + sleepQ.slice(1)}`}
                              </div>
                            </div>
                          )}
                          {stress !== undefined && stress !== null && (
                            <div style={{
                              background: stress > 7 ? "rgba(239,68,68,0.12)" : stress > 4 ? "rgba(245,158,11,0.12)" : "rgba(34,197,94,0.12)",
                              border: `1px solid ${stress > 7 ? "#ef4444" : stress > 4 ? "#f59e0b" : "#22c55e"}40`,
                              borderRadius: 10, padding: "10px", textAlign: "center"
                            }}>
                              <div className="t-label" style={{ fontSize: "0.6rem", marginBottom: 4 }}>🧠 STRESS</div>
                              <div style={{ fontWeight: 700, fontSize: "0.8rem", color: stress > 7 ? "#ef4444" : stress > 4 ? "#fb923c" : "#22c55e" }}>
                                {stress}/10
                              </div>
                            </div>
                          )}
                          {water !== undefined && water !== null && (
                            <div style={{
                              background: "rgba(2,132,199,0.12)",
                              border: "1px solid rgba(2,132,199,0.4)",
                              borderRadius: 10, padding: "10px", textAlign: "center"
                            }}>
                              <div className="t-label" style={{ fontSize: "0.6rem", marginBottom: 4 }}>💧 WATER</div>
                              <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#38bdf8" }}>
                                {water} gls
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {(urineColor || urineThick || bloating) && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {urineColor && (
                            <span style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: 8, fontWeight: 700,
                              background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" }}>
                              💛 {urineColor.charAt(0).toUpperCase() + urineColor.slice(1)}
                            </span>
                          )}
                          {urineThick && (
                            <span style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: 8, fontWeight: 700,
                              background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8" }}>
                              💧 {urineThick.charAt(0).toUpperCase() + urineThick.slice(1)}
                            </span>
                          )}
                          {bloating && (
                            <span style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: 8, fontWeight: 700,
                              background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.3)", color: "#fb923c" }}>
                              🫃 Bloating{bloatSev ? ` · Sev ${bloatSev}` : ""}
                            </span>
                          )}
                        </div>
                      )}

                      {sneezes > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px",
                          background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 10 }}>
                          <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>😤 Sneezes</span>
                          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#fbbf24" }}>{sneezes}×</span>
                        </div>
                      )}

                      {activeSyms.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {activeSyms.map(([k]) => (
                            <span key={k} className="pill pill-red" style={{ fontSize: "0.7rem", textTransform: "capitalize" }}>{k}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="t-label" style={{ fontStyle: "italic", fontSize: "0.75rem" }}>No symptoms flagged</span>
                      )}

                      {(l.exposure?.foodIntake || l.exposure?.medicines) && (
                        <div style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.6,
                          borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                          {l.exposure?.foodIntake && <div><strong style={{ color: "var(--text)" }}>Food:</strong> {l.exposure.foodIntake}</div>}
                          {l.exposure?.medicines  && <div><strong style={{ color: "var(--text)" }}>Meds:</strong> {l.exposure.medicines}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>

      {/* 🏥 CLINICAL SUMMARY & MEDGEMMA REPORT MODAL */}
      {showReportModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20
        }}>
          <div className="card-hi" style={{ width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", padding: 28, position: "relative" }}>
            <button
              onClick={() => setShowReportModal(false)}
              style={{ position: "absolute", top: 20, right: 20, background: "transparent", border: "none", color: "var(--muted)", fontSize: "1.2rem", cursor: "pointer" }}
            >
              ✕
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--indigo-lo)", border: "1px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>
                🏥
              </div>
              <div>
                <h2 style={{ fontWeight: 900, color: "#fff", fontSize: "1.3rem", lineHeight: 1.1 }}>
                  Clinical Summary & MedGemma Report
                </h2>
                <p className="t-label" style={{ fontSize: "0.6875rem", marginTop: 2 }}>
                  Generated for {selectedPatient === "all" ? "All Patient Logs" : `Patient: ${selectedPatient}`}
                </p>
              </div>
            </div>

            {/* Formatted Report Preview Container */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20, fontSize: "0.875rem", lineHeight: 1.6 }}>
              <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, color: "#fff" }}>📋 Telemetry Report Overview</span>
                <span className="pill pill-indigo" style={{ fontSize: "0.65rem" }}>{filteredLogs.length} Records</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div><strong>Baseline Temp:</strong> {avgTemp()}</div>
                <div><strong>Baseline Humidity:</strong> {avgHum()}</div>
                <div><strong>Latest Risk:</strong> {latestRisk.score}% ({latestRisk.label})</div>
                <div><strong>High Risk Breaches:</strong> {highRiskBreaches.length} logs</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>Identified Allergy Triggers:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {allergenStats.filter(a => a.count > 0).map(a => (
                    <span key={a.id} style={{ fontSize: "0.75rem", padding: "3px 10px", borderRadius: 8, background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa", fontWeight: 700 }}>
                      {a.icon} {a.label} ({a.count} logs)
                    </span>
                  ))}
                  {allergenStats.filter(a => a.count > 0).length === 0 && <span style={{ color: "var(--muted)", fontStyle: "italic" }}>No trigger exposures flagged.</span>}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>Structured MedGemma Analysis Prompt:</div>
                <textarea
                  readOnly
                  value={generateMedGemmaPrompt()}
                  rows={6}
                  style={{
                    width: "100%",
                    background: "var(--bg)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: 12,
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    resize: "none"
                  }}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generateMedGemmaPrompt());
                  setCopiedPrompt(true);
                  setTimeout(() => setCopiedPrompt(false), 2500);
                }}
                className="btn btn-ghost"
              >
                {copiedPrompt ? "✓ Copied Prompt!" : "📋 Copy MedGemma Prompt"}
              </button>

              <button
                onClick={() => window.print()}
                className="btn btn-primary"
              >
                🖨️ Print Clinical Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ EDIT LOG ENTRY MODAL */}
      {showEditModal && editingLog && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 300,
          background: "rgba(0,0,0,0.8)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20
        }}>
          <div className="card-hi" style={{
            width: "100%",
            maxWidth: 720,
            maxHeight: "92vh",
            overflowY: "auto",
            padding: 28,
            borderRadius: 20,
            background: "rgba(15, 23, 42, 0.98)",
            border: "1px solid rgba(99, 102, 241, 0.4)",
            position: "relative"
          }}>
            <button
              onClick={() => { setShowEditModal(false); setEditingLog(null); }}
              style={{
                position: "absolute",
                top: 20,
                right: 20,
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
                borderRadius: 12,
                background: "rgba(99, 102, 241, 0.15)",
                border: "1px solid rgba(99, 102, 241, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.3rem"
              }}>
                ✏️
              </div>
              <div>
                <h2 style={{ fontWeight: 900, color: "#fff", fontSize: "1.25rem", margin: 0 }}>
                  Edit Health Log Entry
                </h2>
                <p className="t-label" style={{ fontSize: "0.7rem", marginTop: 2 }}>
                  Log ID: {editingLog.id}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* 1. Profile & Meta */}
              <div style={{ background: "rgba(255,255,255,0.02)", padding: 16, borderRadius: 14, border: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 800, color: "#818cf8", fontSize: "0.85rem", marginBottom: 12 }}>
                  👤 Profile & Context
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                  <div>
                    <label className="t-label" style={{ fontSize: "0.65rem" }}>Patient Name</label>
                    <input
                      type="text"
                      value={editingLog.profile?.name || ""}
                      onChange={e => setEditingLog({
                        ...editingLog,
                        profile: { ...editingLog.profile, name: e.target.value }
                      })}
                      style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: "0.8125rem" }}
                    />
                  </div>
                  <div>
                    <label className="t-label" style={{ fontSize: "0.65rem" }}>Location</label>
                    <input
                      type="text"
                      value={editingLog.profile?.location || editingLog.profile?.locationTag || ""}
                      onChange={e => setEditingLog({
                        ...editingLog,
                        profile: { ...editingLog.profile, location: e.target.value }
                      })}
                      style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: "0.8125rem" }}
                    />
                  </div>
                  <div>
                    <label className="t-label" style={{ fontSize: "0.65rem" }}>Date</label>
                    <input
                      type="date"
                      value={editingLog.profile?.date || ""}
                      onChange={e => setEditingLog({
                        ...editingLog,
                        profile: { ...editingLog.profile, date: e.target.value }
                      })}
                      style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: "0.8125rem" }}
                    />
                  </div>
                  <div>
                    <label className="t-label" style={{ fontSize: "0.65rem" }}>Time</label>
                    <input
                      type="time"
                      value={editingLog.profile?.time || ""}
                      onChange={e => setEditingLog({
                        ...editingLog,
                        profile: { ...editingLog.profile, time: e.target.value }
                      })}
                      style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: "0.8125rem" }}
                    />
                  </div>
                </div>
              </div>

              {/* 2. Climate & Exposure */}
              <div style={{ background: "rgba(255,255,255,0.02)", padding: 16, borderRadius: 14, border: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 800, color: "#fb923c", fontSize: "0.85rem", marginBottom: 12 }}>
                  🌡️ Climate Telemetry & Diet
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                  <div>
                    <label className="t-label" style={{ fontSize: "0.65rem" }}>Temperature</label>
                    <input
                      type="text"
                      value={editingLog.exposure?.temperature || ""}
                      onChange={e => setEditingLog({
                        ...editingLog,
                        exposure: { ...editingLog.exposure, temperature: e.target.value }
                      })}
                      placeholder="e.g. 26°C"
                      style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: "0.8125rem" }}
                    />
                  </div>
                  <div>
                    <label className="t-label" style={{ fontSize: "0.65rem" }}>Humidity</label>
                    <input
                      type="text"
                      value={editingLog.exposure?.humidity || ""}
                      onChange={e => setEditingLog({
                        ...editingLog,
                        exposure: { ...editingLog.exposure, humidity: e.target.value }
                      })}
                      placeholder="e.g. 50%"
                      style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: "0.8125rem" }}
                    />
                  </div>
                  <div>
                    <label className="t-label" style={{ fontSize: "0.65rem" }}>Food Intake</label>
                    <input
                      type="text"
                      value={editingLog.exposure?.foodIntake || ""}
                      onChange={e => setEditingLog({
                        ...editingLog,
                        exposure: { ...editingLog.exposure, foodIntake: e.target.value }
                      })}
                      placeholder="e.g. Tea & Toast"
                      style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: "0.8125rem" }}
                    />
                  </div>
                  <div>
                    <label className="t-label" style={{ fontSize: "0.65rem" }}>Medicines</label>
                    <input
                      type="text"
                      value={editingLog.exposure?.medicines || ""}
                      onChange={e => setEditingLog({
                        ...editingLog,
                        exposure: { ...editingLog.exposure, medicines: e.target.value }
                      })}
                      placeholder="e.g. Cetirizine 10mg"
                      style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: "0.8125rem" }}
                    />
                  </div>
                </div>
              </div>

              {/* 3. Symptoms & Sneezing */}
              <div style={{ background: "rgba(255,255,255,0.02)", padding: 16, borderRadius: 14, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, color: "#ef4444", fontSize: "0.85rem" }}>
                    🩺 Active Symptoms & Sneezes
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="t-label" style={{ fontSize: "0.65rem" }}>Sneezes:</span>
                    <input
                      type="number"
                      min={0}
                      value={editingLog.sneezing?.count ?? 0}
                      onChange={e => setEditingLog({
                        ...editingLog,
                        sneezing: { ...editingLog.sneezing, count: parseInt(e.target.value) || 0 }
                      })}
                      style={{ width: 60, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 8px", color: "#fff", fontSize: "0.8125rem", textAlign: "center" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                  {[
                    { key: "itching", label: "Skin Itching" },
                    { key: "redness", label: "Skin Redness" },
                    { key: "headache", label: "Headache" },
                    { key: "mucus", label: "Excess Mucus" },
                    { key: "vomiting", label: "Nausea" },
                    { key: "bleeding", label: "Bleeding" },
                    { key: "eye_itching", label: "Eye Itching" },
                    { key: "breathing", label: "Breathing Diff." },
                    { key: "coughing", label: "Dry Coughing" },
                  ].map(s => {
                    const currentSyms = editingLog.symptoms || {};
                    const isOn = currentSyms[s.key]?.on || currentSyms[s.key]?.active || currentSyms[s.key] === true;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => {
                          const updated = { ...currentSyms };
                          updated[s.key] = { on: !isOn, note: updated[s.key]?.note || "" };
                          setEditingLog({ ...editingLog, symptoms: updated });
                        }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 10,
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          textAlign: "center",
                          background: isOn ? "rgba(239, 68, 68, 0.2)" : "rgba(255,255,255,0.03)",
                          border: isOn ? "1px solid #ef4444" : "1px solid var(--border)",
                          color: isOn ? "#fca5a5" : "var(--muted)"
                        }}
                      >
                        {isOn ? "✓ " : ""}{s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Wellness Vitals */}
              <div style={{ background: "rgba(255,255,255,0.02)", padding: 16, borderRadius: 14, border: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 800, color: "#34d399", fontSize: "0.85rem", marginBottom: 12 }}>
                  🌿 Wellness Telemetry & Vitals
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                  <div>
                    <label className="t-label" style={{ fontSize: "0.65rem" }}>Stress Level (1-10)</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={editingLog.wellness?.stress ?? 3}
                      onChange={e => setEditingLog({
                        ...editingLog,
                        wellness: { ...editingLog.wellness, stress: parseInt(e.target.value) || 1 }
                      })}
                      style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: "0.8125rem" }}
                    />
                  </div>
                  <div>
                    <label className="t-label" style={{ fontSize: "0.65rem" }}>Sleep (Hours)</label>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={editingLog.wellness?.sleep?.hours ?? ""}
                      onChange={e => setEditingLog({
                        ...editingLog,
                        wellness: {
                          ...editingLog.wellness,
                          sleep: { ...editingLog.wellness?.sleep, hours: parseFloat(e.target.value) || 0 }
                        }
                      })}
                      style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: "0.8125rem" }}
                    />
                  </div>
                  <div>
                    <label className="t-label" style={{ fontSize: "0.65rem" }}>Water Intake (Glasses)</label>
                    <input
                      type="number"
                      min={0}
                      value={editingLog.wellness?.water ?? 4}
                      onChange={e => setEditingLog({
                        ...editingLog,
                        wellness: { ...editingLog.wellness, water: parseInt(e.target.value) || 0 }
                      })}
                      style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: "0.8125rem" }}
                    />
                  </div>
                  <div>
                    <label className="t-label" style={{ fontSize: "0.65rem" }}>Stomach Movement</label>
                    <select
                      value={editingLog.wellness?.stomach?.movement || "normal"}
                      onChange={e => setEditingLog({
                        ...editingLog,
                        wellness: {
                          ...editingLog.wellness,
                          stomach: { ...editingLog.wellness?.stomach, movement: e.target.value }
                        }
                      })}
                      style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: "0.8125rem" }}
                    >
                      <option value="normal">Normal</option>
                      <option value="constipation">Constipation</option>
                      <option value="loose">Loose</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              <button
                onClick={() => { setShowEditModal(false); setEditingLog(null); }}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={saveLogEdit}
                disabled={savingEdit}
                className="btn btn-primary"
              >
                {savingEdit ? "Saving..." : "💾 Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}