"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

export default function AdminDashboard() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'analytics' | 'logs'>('analytics');
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('zensit_admin') === 'true') {
      setUnlocked(true);
    }
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    (async () => {
      if (!db) { setLoading(false); return; }
      try {
        const q = query(collection(db, 'health_logs'), orderBy('timestamp', 'desc'));
        const snap = await getDocs(q);
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [unlocked]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const expected = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'zensit2026';
    if (password === expected) {
      setUnlocked(true);
      sessionStorage.setItem('zensit_admin', 'true');
    } else {
      setAuthError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  const exportLogs = () => {
    if (!logs.length) return alert('No logs to export.');
    const sorted = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const base = new Date(sorted[0].timestamp).getTime();
    const out = sorted.map((l, i) => ({
      log_index: i + 1,
      relative_day: Math.floor((new Date(l.timestamp).getTime() - base) / 86400000),
      location: l.profile?.locationTag || 'unknown',
      environment: { temp: l.exposure?.temperature || 'N/A', humidity: l.exposure?.humidity || 'N/A' },
      symptoms: Object.entries(l.symptoms || {}).filter(([, v]: any) => v?.active || v === true).map(([k]) => k),
      sneezes: l.sneezing?.count || 0,
      food: l.exposure?.foodIntake || '',
      meds: l.exposure?.medicines || '',
    }));
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `zensit_export_${new Date().toISOString().split('T')[0]}.json`; a.click();
  };

  // ─── Analytics helpers ─────────────────────────────────────────────────────
  const parseNum = (v: string | undefined) => v ? parseFloat(v.replace(/[^\d.]/g, '')) : null;

  const avgTemp = () => {
    const vals = logs.map(l => parseNum(l.exposure?.temperature || l.weather?.ambient_temp)).filter(Boolean) as number[];
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : '—';
  };
  const avgHum = () => {
    const vals = logs.map(l => parseNum(l.exposure?.humidity || l.weather?.humidity)).filter(Boolean) as number[];
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : '—';
  };

  const symptomCounts: Record<string, number> = { itching: 0, headache: 0, redness: 0, mucus: 0, vomiting: 0, sneezing: 0 };
  logs.forEach(l => {
    Object.entries(l.symptoms || {}).forEach(([k, v]: any) => {
      if ((v?.active || v === true) && symptomCounts[k] !== undefined) symptomCounts[k]++;
    });
    if ((l.sneezing?.count || 0) > 0) symptomCounts.sneezing++;
  });
  const maxSym = Math.max(...Object.values(symptomCounts), 1);

  const riskInfo = (() => {
    if (!logs.length) return { score: 0, label: 'No Data', color: '#475569' };
    const l = logs[0];
    const t = parseNum(l.exposure?.temperature || l.weather?.ambient_temp) || 25;
    const h = parseNum(l.exposure?.humidity || l.weather?.humidity) || 50;
    let s = 20;
    if (h > 65) s += 25; if (h < 35) s += 15;
    if (t >= 18 && t <= 28) s += 25;
    const syms = l.symptoms ? Object.values(l.symptoms).filter((v: any) => v?.active || v === true).length : 0;
    s += syms * 12;
    const score = Math.min(100, s);
    if (score < 40) return { score, label: 'Low Risk', color: '#22c55e' };
    if (score < 70) return { score, label: 'Moderate', color: '#f59e0b' };
    return { score, label: 'High Risk', color: '#ef4444' };
  })();

  // Chart data
  const chartData = (() => {
    if (logs.length < 2) return null;
    const sorted = [...logs].filter(l => l.timestamp)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const pts = sorted.map(l => ({
      temp: parseNum(l.exposure?.temperature || l.weather?.ambient_temp) || 25,
      sneezes: l.sneezing?.count || 0,
      label: l.profile?.date?.slice(5) || '',
    }));
    const minT = Math.min(...pts.map(p => p.temp)) - 2;
    const maxT = Math.max(...pts.map(p => p.temp)) + 2;
    const maxSn = Math.max(...pts.map(p => p.sneezes), 3);
    const W = 500; const H = 160; const PL = 35; const PR = 15; const PT = 15; const PB = 25;
    const cW = W - PL - PR; const cH = H - PT - PB;
    const N = pts.length;
    const mapped = pts.map((p, i) => ({
      x: PL + (N > 1 ? (i / (N - 1)) * cW : cW / 2),
      yT: H - PB - ((p.temp - minT) / (maxT - minT)) * cH,
      yS: H - PB - (p.sneezes / maxSn) * cH,
      ...p
    }));
    const tempPath = mapped.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.yT.toFixed(1)}`).join(' ');
    const tempArea = `${tempPath} L${mapped[N-1].x},${H-PB} L${mapped[0].x},${H-PB} Z`;
    const sneezePath = mapped.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.yS.toFixed(1)}`).join(' ');
    return { mapped, tempPath, tempArea, sneezePath, W, H, PL, PR, PT, PB, minT, maxT };
  })();

  // ─── Login Gate ────────────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#030712', fontFamily: 'Inter, sans-serif' }}>
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[700px] h-[700px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)' }} />
          <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)' }} />
        </div>

        <div className="w-full max-w-sm relative z-10 text-center">
          <div className="mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl mb-4 animate-float-slow"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', boxShadow: '0 0 30px rgba(99,102,241,0.2)' }}>
              🔐
            </div>
            <h1 className="text-2xl font-black text-white mb-1">Clinical Console</h1>
            <p className="text-slate-500 text-xs font-medium">Authorized personnel only. Enter access password.</p>
          </div>

          <div className="rounded-3xl p-6" style={{ background: 'rgba(10,15,30,0.85)', border: '1px solid rgba(99,102,241,0.15)', backdropFilter: 'blur(20px)', boxShadow: '0 40px 80px -20px rgba(0,0,0,0.7)' }}>
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest text-left mb-2">Password</label>
                <input
                  type="password" value={password} onChange={e => { setPassword(e.target.value); setAuthError(''); }}
                  placeholder="Enter console password..."
                  autoFocus className="input-field w-full px-4 py-3.5 rounded-xl text-sm font-semibold text-center"
                />
              </div>

              {authError && (
                <div className="p-3 rounded-xl text-xs font-bold" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                  ⚠ {authError}
                </div>
              )}

              <button type="submit" className="btn-primary w-full py-3.5 rounded-xl text-sm font-black text-white">
                Unlock Console →
              </button>
            </form>
          </div>

          <a href="/wizard" className="mt-6 inline-block text-xs text-slate-600 hover:text-slate-400 transition-colors font-semibold">
            ← Patient Wizard
          </a>
        </div>
      </div>
    );
  }

  // ─── Main Dashboard ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-10" style={{ background: '#030712', fontFamily: 'Inter, sans-serif', color: '#f1f5f9' }}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)' }} />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <a href="/wizard" className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-100 transition-all"
              style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.5)' }}>
              ←
            </a>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
                📊 Zensit <span style={{ color: '#818cf8' }}>Console</span>
              </h1>
              <p className="text-slate-500 text-xs mt-0.5 font-medium">{logs.length} logs · Clinical telemetry dashboard</p>
            </div>
          </div>
          <button onClick={exportLogs}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #3b82f6)', boxShadow: '0 0 20px rgba(79,70,229,0.3)' }}>
            ⬇ Export MedGemma JSON
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex p-1 rounded-2xl mb-8 max-w-xs" style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.4)' }}>
          {(['analytics', 'logs'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold capitalize transition-all"
              style={{
                background: tab === t ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: tab === t ? '#a5b4fc' : '#475569',
                boxShadow: tab === t ? 'inset 0 0 0 1px rgba(99,102,241,0.35)' : 'none',
              }}>
              {t === 'analytics' ? '📈 Analytics' : '📋 Telemetry Feed'}
            </button>
          ))}
        </div>

        {/* ANALYTICS TAB */}
        {tab === 'analytics' && (
          <div className="space-y-6">

            {/* Metric cards row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Logs', value: logs.length.toString(), icon: '📋', color: '#818cf8' },
                { label: 'Avg Temp', value: `${avgTemp()}°C`, icon: '🌡️', color: '#f97316' },
                { label: 'Avg Humidity', value: `${avgHum()}%`, icon: '💧', color: '#3b82f6' },
                { label: 'Exposure Risk', value: `${riskInfo.score}%`, icon: '⚠️', color: riskInfo.color },
              ].map((m, i) => (
                <div key={i} className="glass glass-hover p-5 rounded-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{m.label}</span>
                    <span className="text-xl">{m.icon}</span>
                  </div>
                  <div className="text-2xl font-black" style={{ color: m.color }}>{m.value}</div>
                  <div className="text-[10px] text-slate-600 mt-1">{i === 3 ? riskInfo.label : 'all-time average'}</div>
                </div>
              ))}
            </div>

            {/* Bottom two panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Symptom distribution */}
              <div className="glass p-6 rounded-2xl">
                <h3 className="text-sm font-bold text-slate-300 mb-5 flex items-center gap-2">
                  <span className="w-1.5 h-4 rounded-full inline-block" style={{ background: '#6366f1' }} />
                  Symptom Distribution
                </h3>
                <div className="space-y-3.5">
                  {Object.entries(symptomCounts).map(([key, count]) => (
                    <div key={key}>
                      <div className="flex justify-between text-[11px] font-semibold mb-1.5">
                        <span className="text-slate-400 capitalize">{key}</span>
                        <span className="text-slate-300">{count} logs</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(15,23,42,0.8)' }}>
                        <div className="h-full rounded-full transition-all duration-1000"
                          style={{
                            width: `${Math.round((count / maxSym) * 100)}%`,
                            background: 'linear-gradient(90deg, #6366f1, #3b82f6)',
                          }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart */}
              <div className="glass p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <span className="w-1.5 h-4 rounded-full inline-block" style={{ background: '#3b82f6' }} />
                    Climate vs Sneezing Trend
                  </h3>
                  <div className="flex gap-3 text-[10px] font-bold text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#f97316' }} />Temp</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#6366f1' }} />Sneezes</span>
                  </div>
                </div>

                {!chartData ? (
                  <div className="h-40 flex items-center justify-center text-slate-600 text-xs italic">
                    Need at least 2 logs to render the trend chart
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <svg viewBox={`0 0 ${chartData.W} ${chartData.H}`} className="w-full min-w-[400px] h-40">
                      <defs>
                        <linearGradient id="tG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {[0.25, 0.5, 0.75, 1].map((r, i) => {
                        const y = chartData.PT + r * (chartData.H - chartData.PT - chartData.PB);
                        return <line key={i} x1={chartData.PL} y1={y} x2={chartData.W - chartData.PR} y2={y}
                          stroke="rgba(51,65,85,0.4)" strokeWidth="1" strokeDasharray="3 4" />;
                      })}
                      <path d={chartData.tempArea} fill="url(#tG)" />
                      <path d={chartData.tempPath} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d={chartData.sneezePath} fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="5 3" strokeLinecap="round" strokeLinejoin="round" />
                      {chartData.mapped.map((p: any, i: number) => (
                        <g key={i}>
                          <circle cx={p.x} cy={p.yT} r="3.5" fill="#0d1117" stroke="#f97316" strokeWidth="2" />
                          <circle cx={p.x} cy={p.yS} r="2.5" fill="#0d1117" stroke="#6366f1" strokeWidth="1.5" />
                        </g>
                      ))}
                      {chartData.mapped.filter((_: any, i: number) => i % Math.ceil(chartData.mapped.length / 5) === 0 || i === chartData.mapped.length - 1).map((p: any, i: number) => (
                        <text key={i} x={p.x} y={chartData.H - 5} textAnchor="middle" fontSize="8" fill="#475569" fontWeight="600">{p.label}</text>
                      ))}
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LOGS TAB */}
        {tab === 'logs' && (
          <div>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                <p className="text-sm font-semibold">Loading telemetry data...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-24" style={{ color: '#475569' }}>
                <div className="text-5xl mb-4">📭</div>
                <p className="text-sm font-semibold">No logs yet. Open the Wizard to record your first entry.</p>
                <a href="/wizard" className="inline-block mt-4 px-5 py-2.5 rounded-xl text-xs font-bold text-white btn-primary">Open Wizard →</a>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {logs.map(log => {
                  const activeSyms = Object.entries(log.symptoms || {}).filter(([, v]: any) => v?.active || v === true);
                  const sneezeCount = log.sneezing?.count || 0;
                  return (
                    <div key={log.id} className="glass glass-hover p-5 rounded-2xl space-y-4">
                      {/* Log header */}
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] text-slate-500 font-semibold">
                          {log.profile?.date || '—'} · {log.profile?.time || '—'}
                        </div>
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
                          📍 {log.profile?.locationTag || 'Unknown'}
                        </span>
                      </div>

                      {/* Climate */}
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { l: 'Temperature', v: log.exposure?.temperature || 'N/A', c: '#f97316' },
                          { l: 'Humidity', v: log.exposure?.humidity || 'N/A', c: '#3b82f6' },
                        ].map((w, i) => (
                          <div key={i} className="p-3 rounded-xl text-center" style={{ background: 'rgba(2,6,23,0.6)' }}>
                            <div className="text-[9px] text-slate-600 uppercase tracking-widest font-bold mb-1">{w.l}</div>
                            <div className="text-lg font-black" style={{ color: w.c }}>{w.v}</div>
                          </div>
                        ))}
                      </div>

                      {/* Sneezing */}
                      {sneezeCount > 0 && (
                        <div className="flex items-center justify-between p-3 rounded-xl text-xs font-bold"
                          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          <span className="text-slate-400">😤 Sneezing incidents</span>
                          <span style={{ color: '#f59e0b' }}>{sneezeCount} counts</span>
                        </div>
                      )}

                      {/* Symptoms */}
                      {activeSyms.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {activeSyms.map(([k]) => (
                            <span key={k} className="text-[10px] font-bold px-2.5 py-1 rounded-full capitalize"
                              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                              {k}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-600 italic">No symptoms flagged</p>
                      )}

                      {/* Intake notes */}
                      {(log.exposure?.foodIntake || log.exposure?.medicines) && (
                        <div className="p-3 rounded-xl text-[11px] space-y-1" style={{ background: 'rgba(2,6,23,0.5)', border: '1px solid rgba(51,65,85,0.3)' }}>
                          {log.exposure?.foodIntake && <p><span className="text-slate-500 font-bold">Food: </span><span className="text-slate-300">{log.exposure.foodIntake}</span></p>}
                          {log.exposure?.medicines && <p><span className="text-slate-500 font-bold">Meds: </span><span className="text-slate-300">{log.exposure.medicines}</span></p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}