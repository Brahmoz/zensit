"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

export default function Admin() {
  const [authed, setAuthed]   = useState(false);
  const [pw, setPw]           = useState("");
  const [pwErr, setPwErr]     = useState("");
  const [logs, setLogs]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<"overview" | "feed">("overview");
  const [selectedPatient, setSelectedPatient] = useState<string>("all");

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

  const exportJSON = () => {
    if (!logs.length) return;
    const sorted = [...logs].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const base = new Date(sorted[0].timestamp).getTime();
    const out  = sorted.map((l, i) => ({
      log_index: i + 1,
      relative_day: Math.floor((new Date(l.timestamp).getTime() - base) / 86400000),
      location: l.profile?.location || l.profile?.locationTag || "—",
      climate: { temp: l.exposure?.temperature, humidity: l.exposure?.humidity },
      symptoms: Object.entries(l.symptoms || {})
        .filter(([, v]: any) => v?.on || v?.active || v === true)
        .map(([k]) => k),
      sneezes: l.sneezing?.count || 0,
      food: l.exposure?.foodIntake || "",
      meds: l.exposure?.medicines || "",
    }));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
    a.download = `zensit_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  // ─── helpers ──────────────────────────────────────────────────────────────
  const parseN = (v: string | undefined) => v ? parseFloat(v.replace(/[^\d.]/g, "")) : null;

  const patients = Array.from(new Set(logs.map(l => l.profile?.name).filter(Boolean))) as string[];
  const filteredLogs = selectedPatient === "all"
    ? logs
    : logs.filter(l => l.profile?.name === selectedPatient);

  const avgTemp = () => {
    const vals = filteredLogs.map(l => parseN(l.exposure?.temperature)).filter(Boolean) as number[];
    return vals.length ? `${Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)}°C` : "—";
  };
  const avgHum = () => {
    const vals = filteredLogs.map(l => parseN(l.exposure?.humidity)).filter(Boolean) as number[];
    return vals.length ? `${Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)}%` : "—";
  };

  const symCounts: Record<string, number> = { itching: 0, headache: 0, redness: 0, mucus: 0, vomiting: 0, sneezing: 0 };
  filteredLogs.forEach(l => {
    Object.entries(l.symptoms || {}).forEach(([k, v]: any) => {
      if ((v?.on || v?.active || v === true) && k in symCounts) symCounts[k]++;
    });
    if ((l.sneezing?.count || 0) > 0) symCounts.sneezing++;
  });
  const maxSym = Math.max(...Object.values(symCounts), 1);

  const latestRisk = (() => {
    if (!filteredLogs[0]) return { score: 0, label: "No data", color: "#64748b" };
    const l = filteredLogs[0];
    const t = parseN(l.exposure?.temperature) ?? 25;
    const h = parseN(l.exposure?.humidity) ?? 50;
    let s = 30;
    if (h > 65 || h < 35) s += 25;
    if (t > 28 || t < 16) s += 20;
    const syms = Object.values(l.symptoms || {}).filter((v: any) => v?.on || v?.active || v === true).length;
    s += syms * 10;
    const score = Math.min(100, s);
    if (score < 40) return { score, label: "Low", color: "#22c55e" };
    if (score < 65) return { score, label: "Moderate", color: "#f59e0b" };
    return { score, label: "High", color: "#ef4444" };
  })();

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
        <div className="container" style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <a href="/wizard" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", fontWeight: 900, fontSize: "1.1rem", color: "#fff",
              letterSpacing: "-0.03em" }}>
              <img src="/icon-192x192.png" alt="Zensit" style={{ width: 22, height: 22, objectFit: "contain" }} />
              Zensit <span style={{ color: "#818cf8" }}>Console</span>
            </a>
            <div className="t-label" style={{ marginTop: 2, fontSize: "0.65rem" }}>
              {selectedPatient === "all" ? `${logs.length} total logs` : `${filteredLogs.length} of ${logs.length} logs for ${selectedPatient}`}
            </div>
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
            <button onClick={exportJSON} className="btn btn-primary btn-sm">⬇ Export JSON</button>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 28 }}>
        {/* Tab bar */}
        <div style={{ display: "flex", gap: 0, marginBottom: 28, background: "var(--surface)",
          border: "1px solid var(--border)", borderRadius: 14, padding: 4, width: "fit-content" }}>
          {(["overview", "feed"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className="btn"
              style={{
                padding: "8px 20px", fontSize: "0.8125rem",
                background: tab === t ? "var(--indigo)" : "transparent",
                color: tab === t ? "#fff" : "var(--muted)",
                borderRadius: 10, border: "none",
              }}>
              {t === "overview" ? "📈 Overview" : "📋 All Logs"}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ──────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Metric cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              {[
                { label: "Total Logs",    value: String(logs.length), icon: "📋", color: "#818cf8" },
                { label: "Avg Temp",      value: avgTemp(),           icon: "🌡️", color: "#fb923c" },
                { label: "Avg Humidity",  value: avgHum(),            icon: "💧", color: "#60a5fa" },
                { label: "Latest Risk",   value: `${latestRisk.score}%`, icon: "⚠️", color: latestRisk.color },
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

            {/* Symptom bars + Chart side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
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

              {/* Mini SVG trend chart */}
              <div className="card" style={{ padding: "24px 20px" }}>
                <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.9375rem", marginBottom: 8,
                  paddingBottom: 14, borderBottom: "1px solid var(--border)", display: "flex",
                  justifyContent: "space-between", alignItems: "center" }}>
                  <span>Temp vs Sneezes</span>
                  <div style={{ display: "flex", gap: 12 }}>
                    <span className="t-label" style={{ color: "#fb923c", fontSize: "0.65rem" }}>● Temp</span>
                    <span className="t-label" style={{ color: "#6366f1", fontSize: "0.65rem" }}>- - Sneezes</span>
                  </div>
                </div>
                {(() => {
                  const sorted = [...filteredLogs].filter(l => l.timestamp)
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                  if (sorted.length < 2) return (
                    <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span className="t-label" style={{ fontStyle: "italic" }}>Need 2+ logs</span>
                    </div>
                  );
                  const pts = sorted.map(l => ({
                    t: parseN(l.exposure?.temperature) ?? 25,
                    s: l.sneezing?.count ?? 0,
                    d: l.profile?.date?.slice(5) ?? "",
                  }));
                  const W=460, H=130, PL=8, PR=8, PT=12, PB=24;
                  const cW=W-PL-PR, cH=H-PT-PB, N=pts.length;
                  const minT=Math.min(...pts.map(p=>p.t))-2, maxT=Math.max(...pts.map(p=>p.t))+2;
                  const maxS=Math.max(...pts.map(p=>p.s),3);
                  const mp = pts.map((p,i) => ({
                    x: PL+(N>1?(i/(N-1))*cW:cW/2),
                    yT: H-PB-((p.t-minT)/(maxT-minT))*cH,
                    yS: H-PB-(p.s/maxS)*cH, ...p,
                  }));
                  const tPath = mp.map((p,i)=>`${i===0?"M":"L"}${p.x.toFixed(1)},${p.yT.toFixed(1)}`).join(" ");
                  const sPath = mp.map((p,i)=>`${i===0?"M":"L"}${p.x.toFixed(1)},${p.yS.toFixed(1)}`).join(" ");
                  return (
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 130, overflow: "visible" }}>
                      <defs>
                        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fb923c" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {[0.25,0.5,0.75,1].map((r,i)=>{
                        const y=PT+r*(H-PT-PB);
                        return <line key={i} x1={PL} y1={y} x2={W-PR} y2={y}
                          stroke="rgba(255,255,255,0.05)" strokeWidth={1} />;
                      })}
                      <path d={`${tPath} L${mp[N-1].x},${H-PB} L${mp[0].x},${H-PB} Z`} fill="url(#tg)" />
                      <path d={tPath} fill="none" stroke="#fb923c" strokeWidth={2.5}
                        strokeLinecap="round" strokeLinejoin="round" />
                      <path d={sPath} fill="none" stroke="#6366f1" strokeWidth={2}
                        strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />
                      {mp.map((p: any,i: number)=>(
                        <g key={i}>
                          <circle cx={p.x} cy={p.yT} r={3.5} fill="var(--bg)" stroke="#fb923c" strokeWidth={2} />
                          <circle cx={p.x} cy={p.yS} r={2.5} fill="var(--bg)" stroke="#6366f1" strokeWidth={1.5} />
                        </g>
                      ))}
                    </svg>
                  );
                })()}
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
          ) : logs.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: 80, color: "var(--muted)" }}>
              <div style={{ fontSize: "3rem", marginBottom: 16 }}>📭</div>
              <p style={{ marginBottom: 20 }}>No logs yet.</p>
              <a href="/wizard" className="btn btn-primary">Open Wizard →</a>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
              {filteredLogs.map(l => {
                const activeSyms = Object.entries(l.symptoms || {}).filter(([, v]: any) => v?.on || v?.active || v === true);
                const sneezes   = l.sneezing?.count || 0;
                const loc       = l.profile?.location || l.profile?.locationTag || "—";
                return (
                  <div key={l.id} className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>
                        {l.profile?.date || "—"} · {l.profile?.time || "—"}
                      </span>
                      <span className="pill pill-indigo" style={{ fontSize: "0.7rem" }}>📍 {loc}</span>
                    </div>

                    {/* climate row */}
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

                    {/* sneezes */}
                    {sneezes > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px",
                        background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 10 }}>
                        <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>😤 Sneezes</span>
                        <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#fbbf24" }}>{sneezes}×</span>
                      </div>
                    )}

                    {/* symptoms */}
                    {activeSyms.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {activeSyms.map(([k]) => (
                          <span key={k} className="pill pill-red" style={{ fontSize: "0.7rem", textTransform: "capitalize" }}>{k}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="t-label" style={{ fontStyle: "italic", fontSize: "0.75rem" }}>No symptoms flagged</span>
                    )}

                    {/* intake */}
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
          )
        )}
      </div>
    </div>
  );
}