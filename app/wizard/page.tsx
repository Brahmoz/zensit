"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc } from "firebase/firestore";

const LOCATION_TAGS = ['Home', 'Hospital', 'School', 'Work', 'Travel', 'Other'];
const SYMPTOMS_LIST = ['vomiting', 'headache', 'itching', 'redness', 'mucus'] as const;
type SymptomKey = typeof SYMPTOMS_LIST[number];

const SYMPTOM_META: Record<SymptomKey, { icon: string; label: string }> = {
  vomiting: { icon: '🤢', label: 'Vomiting / Nausea' },
  headache: { icon: '🤕', label: 'Headache' },
  itching: { icon: '😣', label: 'Skin Itching' },
  redness: { icon: '🔴', label: 'Skin Redness' },
  mucus: { icon: '💧', label: 'Excess Mucus' },
};

export default function WizardForm() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [profile, setProfile] = useState({
    name: 'Nand',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    locationTag: 'Home',
  });

  const [symptoms, setSymptoms] = useState<Record<SymptomKey, { active: boolean; remark: string }>>(
    Object.fromEntries(SYMPTOMS_LIST.map(k => [k, { active: false, remark: '' }])) as any
  );
  const [sneezing, setSneezing] = useState({ count: 0, remark: '' });

  const [exposure, setExposure] = useState({
    temperature: '—', humidity: '—',
    foodIntake: '', foodTiming: '', medicines: '',
  });

  const [comfort, setComfort] = useState({ score: 0, label: 'Fetching...', color: '#6366f1', stroke: '#6366f1' });

  useEffect(() => {
    (async () => {
      try {
        let lat = '20.5937', lon = '78.9629';
        if (navigator.geolocation) {
          await new Promise<void>(resolve => {
            navigator.geolocation.getCurrentPosition(
              pos => { lat = String(pos.coords.latitude); lon = String(pos.coords.longitude); resolve(); },
              () => resolve(),
              { timeout: 5000 }
            );
          });
        }
        const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
        if (!res.ok) throw new Error();
        const d = await res.json();
        const temp = Math.round(d.ambient_temp);
        const hum = d.humidity;
        setExposure(prev => ({ ...prev, temperature: `${temp}°C`, humidity: `${hum}%` }));
        let score = 100;
        if (hum > 65 || hum < 35) score -= 35;
        if (temp > 28 || temp < 16) score -= 30;
        const final = Math.max(10, score);
        setComfort(
          final >= 75 ? { score: final, label: 'Excellent Climate', color: '#22c55e', stroke: '#22c55e' }
          : final >= 50 ? { score: final, label: 'Moderate Discomfort', color: '#f59e0b', stroke: '#f59e0b' }
          : { score: final, label: 'Poor — Allergy Risk', color: '#ef4444', stroke: '#ef4444' }
        );
      } catch {
        setExposure(prev => ({ ...prev, temperature: '25°C', humidity: '55%' }));
        setComfort({ score: 65, label: 'Estimated', color: '#f59e0b', stroke: '#f59e0b' });
      }
    })();
  }, []);

  const toggleSym = (k: SymptomKey) => setSymptoms(p => ({ ...p, [k]: { ...p[k], active: !p[k].active } }));
  const setRemark = (k: SymptomKey, r: string) => setSymptoms(p => ({ ...p, [k]: { ...p[k], remark: r } }));

  const handleSubmit = async () => {
    if (!db) { alert('Database not configured. Check your .env.local file.'); return; }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'health_logs'), { profile, symptoms, sneezing, exposure, timestamp: new Date().toISOString() });
      alert('✅ Log saved successfully!');
      setStep(1);
      setSymptoms(Object.fromEntries(SYMPTOMS_LIST.map(k => [k, { active: false, remark: '' }])) as any);
      setSneezing({ count: 0, remark: '' });
      setExposure(p => ({ ...p, foodIntake: '', foodTiming: '', medicines: '' }));
    } catch (e) {
      console.error('Save error:', e);
      alert('❌ Error saving log. Check console for details.');
    } finally {
      setSubmitting(false);
    }
  };

  const progress = ((step - 1) / 2) * 100;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden"
      style={{ background: '#030712', fontFamily: 'Inter, sans-serif' }}>

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-30%] left-[-20%] w-[700px] h-[700px] rounded-full animate-float-slow"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-20%] right-[-15%] w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)' }} />
      </div>

      {/* Back link */}
      <div className="w-full max-w-lg mb-4 relative z-10">
        <a href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors">
          ← Back to Home
        </a>
      </div>

      {/* Card */}
      <div className="w-full max-w-lg relative z-10 rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(10, 15, 30, 0.85)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(99, 102, 241, 0.15)',
          boxShadow: '0 0 0 1px rgba(99,102,241,0.08), 0 40px 80px -20px rgba(0,0,0,0.7)',
        }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-0 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-lg">💠</span>
              <span className="font-black text-lg text-white">Zensit <span style={{ color: '#818cf8' }}>Wizard</span></span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Allergy Telemetry Logger · Step {step} of 3</p>
          </div>
          <a href="/admin" className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
            Console →
          </a>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4 pb-1">
          <div className="flex items-center gap-2 mb-2">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black transition-all ${s <= step ? 'text-white' : 'text-slate-600'}`}
                  style={{
                    background: s < step ? '#6366f1' : s === step ? 'rgba(99,102,241,0.25)' : 'rgba(30,41,59,0.6)',
                    border: s === step ? '1.5px solid rgba(99,102,241,0.7)' : '1px solid rgba(51,65,85,0.5)',
                  }}>
                  {s < step ? '✓' : s}
                </div>
                {s < 3 && <div className="h-px flex-1 transition-all" style={{ background: s < step ? '#6366f1' : 'rgba(51,65,85,0.5)' }} />}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[9px] font-bold text-slate-600 uppercase tracking-wider">
            <span>Profile</span><span className="ml-4">Symptoms</span><span>Climate</span>
          </div>
        </div>

        <div className="h-px mx-6 mt-4" style={{ background: 'rgba(99,102,241,0.1)' }} />

        {/* Form body */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-up">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Patient Name</label>
                <input
                  value={profile.name}
                  onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                  placeholder="Enter name..."
                  className="input-field w-full px-4 py-3.5 rounded-xl text-sm font-semibold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Date</label>
                  <input type="date" value={profile.date} onChange={e => setProfile(p => ({ ...p, date: e.target.value }))}
                    className="input-field w-full px-4 py-3.5 rounded-xl text-sm font-semibold" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Time</label>
                  <input type="time" value={profile.time} onChange={e => setProfile(p => ({ ...p, time: e.target.value }))}
                    className="input-field w-full px-4 py-3.5 rounded-xl text-sm font-semibold" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Location</label>
                <div className="grid grid-cols-3 gap-2">
                  {LOCATION_TAGS.map(tag => (
                    <button key={tag} type="button" onClick={() => setProfile(p => ({ ...p, locationTag: tag }))}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all ${profile.locationTag === tag ? 'loc-active' : ''}`}
                      style={{
                        background: profile.locationTag === tag ? 'rgba(99,102,241,0.12)' : 'rgba(15,23,42,0.6)',
                        border: profile.locationTag === tag ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(51,65,85,0.6)',
                        color: profile.locationTag === tag ? '#a5b4fc' : '#64748b',
                      }}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-up">
              {/* Sneeze Counter */}
              <div className="p-4 rounded-2xl" style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.5)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-white">😤 Sneezing Frequency</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">10-second count window</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(51,65,85,0.6)' }}>
                    <button onClick={() => setSneezing(p => ({ ...p, count: Math.max(0, p.count - 1) }))} type="button"
                      className="px-3 py-2.5 text-slate-400 hover:text-white hover:bg-white/5 transition-all font-bold text-sm">−</button>
                    <span className="px-3 text-lg font-black min-w-[40px] text-center" style={{ color: '#818cf8' }}>{sneezing.count}</span>
                    <button onClick={() => setSneezing(p => ({ ...p, count: p.count + 1 }))} type="button"
                      className="px-3 py-2.5 text-slate-400 hover:text-white hover:bg-white/5 transition-all font-bold text-sm">+</button>
                  </div>
                </div>
                {sneezing.count > 0 && (
                  <input value={sneezing.remark} onChange={e => setSneezing(p => ({ ...p, remark: e.target.value }))}
                    placeholder="Any trigger context noted..." className="input-field w-full px-3.5 py-3 rounded-xl text-xs font-semibold" />
                )}
              </div>

              {/* Symptom Cards */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Symptom Indicators</label>
                <div className="space-y-2">
                  {SYMPTOMS_LIST.map(k => {
                    const m = SYMPTOM_META[k];
                    const isOn = symptoms[k].active;
                    return (
                      <div key={k} className="rounded-2xl overflow-hidden transition-all duration-300"
                        style={{
                          background: isOn ? 'rgba(239,68,68,0.05)' : 'rgba(15,23,42,0.6)',
                          border: isOn ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(51,65,85,0.5)',
                        }}>
                        <div className="flex items-center justify-between p-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="text-base">{m.icon}</span>
                            <span className="text-sm font-semibold text-slate-200">{m.label}</span>
                          </div>
                          <button type="button" onClick={() => toggleSym(k)}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
                            style={{
                              background: isOn ? 'rgba(239,68,68,0.2)' : 'rgba(30,41,59,0.8)',
                              border: isOn ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(51,65,85,0.6)',
                              color: isOn ? '#fca5a5' : '#64748b',
                            }}>
                            {isOn ? '● Active' : '○ Clear'}
                          </button>
                        </div>
                        {isOn && (
                          <div className="px-3.5 pb-3.5">
                            <input value={symptoms[k].remark} onChange={e => setRemark(k, e.target.value)}
                              placeholder={`Describe ${k} severity or trigger...`}
                              className="input-field w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-up">
              {/* Comfort Ring */}
              <div className="p-5 rounded-2xl flex items-center gap-5"
                style={{ background: 'rgba(15,23,42,0.8)', border: `1px solid ${comfort.color}25` }}>
                <div className="relative shrink-0">
                  <svg viewBox="0 0 80 80" className="w-16 h-16">
                    <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(30,41,59,0.8)" strokeWidth="7" />
                    <circle cx="40" cy="40" r="32" fill="none"
                      stroke={comfort.stroke} strokeWidth="7" strokeLinecap="round"
                      strokeDasharray="201" strokeDashoffset={201 - (201 * comfort.score) / 100}
                      transform="rotate(-90 40 40)" className="progress-ring" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black text-white">{comfort.score}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Climate Comfort</p>
                  <p className="text-sm font-black" style={{ color: comfort.color }}>{comfort.label}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Based on live GPS weather data</p>
                </div>
              </div>

              {/* Weather tiles */}
              <div className="grid grid-cols-2 gap-3">
                {[{ label: 'Temperature', value: exposure.temperature, icon: '🌡️', color: '#f97316' },
                  { label: 'Humidity', value: exposure.humidity, icon: '💧', color: '#3b82f6' }].map((w, i) => (
                  <div key={i} className="p-4 rounded-2xl text-center" style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.5)' }}>
                    <div className="text-xl mb-1">{w.icon}</div>
                    <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">{w.label}</div>
                    <div className="text-xl font-black" style={{ color: w.color }}>{w.value}</div>
                  </div>
                ))}
              </div>

              {/* Food & Meds */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Recent Food Intake</label>
                <div className="flex gap-2">
                  <input value={exposure.foodIntake} onChange={e => setExposure(p => ({ ...p, foodIntake: e.target.value }))}
                    placeholder="e.g. wheat, dairy, rice..." className="input-field flex-1 px-4 py-3 rounded-xl text-sm font-semibold" />
                  <input type="time" value={exposure.foodTiming} onChange={e => setExposure(p => ({ ...p, foodTiming: e.target.value }))}
                    className="input-field w-24 px-3 py-3 rounded-xl text-sm font-semibold text-center" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Medications Today</label>
                <textarea value={exposure.medicines} onChange={e => setExposure(p => ({ ...p, medicines: e.target.value }))}
                  placeholder="Antihistamines, steroid puffs, eye drops..." rows={2}
                  className="input-field w-full px-4 py-3 rounded-xl text-sm font-semibold resize-none" />
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(99,102,241,0.1)', background: 'rgba(3,7,18,0.5)' }}>
          <button type="button" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}
            className="text-xs font-bold px-5 py-3 rounded-xl transition-all"
            style={{
              background: step === 1 ? 'transparent' : 'rgba(30,41,59,0.6)',
              border: step === 1 ? '1px solid transparent' : '1px solid rgba(51,65,85,0.5)',
              color: step === 1 ? '#334155' : '#94a3b8',
              cursor: step === 1 ? 'not-allowed' : 'pointer',
            }}>
            ← Back
          </button>

          <div className="flex gap-1.5">
            {[1, 2, 3].map(s => (
              <div key={s} className="h-1.5 rounded-full transition-all duration-300"
                style={{ width: step === s ? '20px' : '6px', background: step === s ? '#6366f1' : 'rgba(51,65,85,0.6)' }} />
            ))}
          </div>

          {step < 3 ? (
            <button type="button" onClick={() => setStep(s => s + 1)}
              className="btn-primary text-xs font-black px-6 py-3 rounded-xl text-white flex items-center gap-1.5">
              Next →
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting}
              className="text-xs font-black px-6 py-3 rounded-xl text-white transition-all flex items-center gap-1.5"
              style={{
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                boxShadow: '0 0 20px rgba(34,197,94,0.3)',
                opacity: submitting ? 0.6 : 1,
              }}>
              {submitting ? '⏳ Saving...' : '✓ Complete Log'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}