"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function ZensitLandingPage() {
  const [flareups, setFlareups] = useState(8);
  const [recoveryDays, setRecoveryDays] = useState(3);
  const [scrolled, setScrolled] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const totalDaysLost = flareups * recoveryDays;
  const projected = Math.max(1, Math.round(totalDaysLost * 0.22 * 10) / 10);
  const saved = Math.round((totalDaysLost - projected) * 10) / 10;
  const savePct = Math.round((saved / totalDaysLost) * 100);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Particle canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: {x: number; y: number; vx: number; vy: number; r: number; a: number}[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
        a: Math.random() * 0.4 + 0.1,
      });
    }

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,102,241,${p.a})`;
        ctx.fill();
      });
      // draw lines between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(99,102,241,${0.08 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  const stats = [
    { value: '78%', label: 'Flare-up reduction', color: '#6366f1' },
    { value: '10s', label: 'Sneeze count timer', color: '#3b82f6' },
    { value: '24/7', label: 'Climate tracking', color: '#8b5cf6' },
    { value: '100%', label: 'MedGemma ready', color: '#06b6d4' },
  ];

  const steps = [
    {
      n: '01',
      color: '#6366f1',
      title: 'Demographic Profile',
      desc: 'Capture patient name, date/time stamps, and location context (Home, Hospital, School) to build a precise environmental timeline.',
      icon: '👤',
    },
    {
      n: '02',
      color: '#ef4444',
      title: 'Symptom Logging',
      desc: 'Toggle active symptom indicators—itching, redness, mucus, headache, vomiting—and use the 10-second sneeze counter for quantified severity.',
      icon: '🩺',
    },
    {
      n: '03',
      color: '#3b82f6',
      title: 'Climate Correlation',
      desc: 'Real-time weather telemetry via GPS location. Logs ambient temperature, humidity %, and your food/medication intake vectors automatically.',
      icon: '🌡️',
    },
  ];

  return (
    <div className="min-h-screen text-slate-100 font-[Inter,sans-serif] overflow-x-hidden" style={{ background: '#030712' }}>

      {/* Particle Canvas */}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />

      {/* Mesh gradient orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] rounded-full animate-float-slow"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)', animationDelay: '3s' }} />
        <div className="absolute top-[40%] right-[20%] w-[400px] h-[400px] rounded-full animate-float-slow"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', animationDelay: '6s' }} />
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'backdrop-blur-xl border-b border-white/5' : ''}`}
        style={{ background: scrolled ? 'rgba(3,7,18,0.85)' : 'transparent' }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-[70px] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>
              💠
            </div>
            <span className="font-black text-xl tracking-tight text-white">Zen<span style={{ color: '#818cf8' }}>sit</span></span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full ml-1 uppercase tracking-widest"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc' }}>PWA</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {['#challenge', '#process', '#impact'].map((href, i) => (
              <a key={i} href={href} className="text-xs font-semibold text-slate-400 hover:text-slate-100 transition-colors uppercase tracking-wider">
                {['Challenge', 'Process', 'Impact'][i]}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/admin" className="hidden sm:flex btn-ghost items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-300">
              Console
            </Link>
            <Link href="/wizard" className="btn-primary flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white">
              Start Logging ✦
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 px-5 z-10">
        <div className="max-w-5xl mx-auto text-center">

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-xs font-semibold animate-fade-up"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc', animationDelay: '0.1s' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Live Allergy Telemetry Platform — Mobile-First Clinical PWA
          </div>

          <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tight leading-none mb-6 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <span className="text-white">Allergy</span>
            <br />
            <span className="shimmer-text">Intelligence.</span>
          </h1>

          <p className="text-base sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed font-medium animate-fade-up" style={{ animationDelay: '0.35s' }}>
            Pair real-time climate telemetry with tactile symptom logs to build a rich allergy timeline.
            Export structured JSON for MedGemma LLM clinical analysis.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up" style={{ animationDelay: '0.5s' }}>
            <Link href="/wizard" className="btn-primary inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-sm font-black text-white">
              🩺 Log Symptoms Now
            </Link>
            <Link href="/admin" className="btn-ghost inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-sm font-semibold text-slate-300">
              📊 View Analytics Console
            </Link>
          </div>

          {/* Stats row */}
          <div className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto animate-fade-up" style={{ animationDelay: '0.7s' }}>
            {stats.map((s, i) => (
              <div key={i} className="glass glass-hover p-4 rounded-2xl text-center">
                <div className="text-2xl font-black mb-1" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Scroll cue */}
          <div className="mt-16 flex flex-col items-center gap-2 text-slate-600 animate-fade-up" style={{ animationDelay: '1s' }}>
            <span className="text-[10px] uppercase tracking-widest font-bold">Scroll to explore</span>
            <div className="w-5 h-9 border border-slate-700 rounded-full flex items-start justify-center pt-1.5">
              <div className="w-1 h-2 rounded-full bg-indigo-400 animate-bounce" />
            </div>
          </div>
        </div>
      </section>

      {/* THE CHALLENGE */}
      <section id="challenge" className="relative py-28 px-5 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-4"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8' }}>
              The Problem
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white mb-4 tracking-tight">The Chronic Allergy Gap</h2>
            <div className="w-16 h-1 rounded-full mx-auto mb-4" style={{ background: 'linear-gradient(90deg, #6366f1, #3b82f6)' }} />
            <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
              Allergic flare-ups are complex, invisible, and extremely hard to track retrospectively without structured telemetry.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: '🧠', title: 'Subjective Recall', body: 'Patients struggle to recall exact flare-up timings, meal vectors, and environmental context during doctor consultations.' },
              { icon: '🌫️', title: 'Invisible Climate', body: 'Micro-climate shifts — humidity spikes, temperature drops, pollen peaks — silently trigger reactions and go unlogged.' },
              { icon: '📂', title: 'Fragmented Data', body: 'Without structured JSON output, AI clinical models like MedGemma cannot identify correlations across hundreds of logs.' },
            ].map((c, i) => (
              <div key={i} className="glass glass-hover p-7 rounded-3xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)' }} />
                <div className="text-3xl mb-4">{c.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{c.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* THE PROCESS */}
      <section id="process" className="relative py-28 px-5 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-4"
              style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}>
              How It Works
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white mb-4 tracking-tight">Closed-Loop Telemetry</h2>
            <div className="w-16 h-1 rounded-full mx-auto" style={{ background: 'linear-gradient(90deg, #3b82f6, #06b6d4)' }} />
          </div>

          <div className="space-y-10">
            {steps.map((s, i) => (
              <div key={i} className={`grid grid-cols-1 lg:grid-cols-2 gap-10 items-center ${i % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}>
                <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest mb-4"
                    style={{ background: `${s.color}15`, border: `1px solid ${s.color}40`, color: s.color }}>
                    Step {s.n}
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white mb-4 leading-tight">{s.icon} {s.title}</h3>
                  <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-6">{s.desc}</p>
                  <Link href="/wizard" className="inline-flex items-center gap-2 text-xs font-bold px-5 py-3 rounded-xl transition-all"
                    style={{ background: `${s.color}18`, border: `1px solid ${s.color}35`, color: s.color }}>
                    Try This Step →
                  </Link>
                </div>

                <div className={`glass p-6 rounded-3xl ${i % 2 === 1 ? 'lg:order-1' : ''}`}
                  style={{ borderColor: `${s.color}20`, boxShadow: `0 0 40px -10px ${s.color}20` }}>
                  <div className="text-[10px] font-black uppercase tracking-widest mb-4"
                    style={{ color: s.color, borderBottom: `1px solid ${s.color}20`, paddingBottom: '12px' }}>
                    ◆ Data Preview
                  </div>
                  {i === 0 && (
                    <div className="space-y-3 text-sm">
                      {[['Patient ID', 'Nand ∙ Adult'], ['Date', new Date().toLocaleDateString('en-IN')], ['Location', '📍 Home'], ['Session', '#24 of 2026']].map(([k, v], j) => (
                        <div key={j} className="flex justify-between items-center p-3 rounded-xl" style={{ background: 'rgba(2,6,23,0.6)' }}>
                          <span className="text-slate-500 font-medium">{k}</span>
                          <span className="text-white font-bold">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {i === 1 && (
                    <div className="space-y-3 text-sm">
                      {[['Itching', '🔴 Active', '#ef4444'], ['Sneezing', '7 / 10s', '#f59e0b'], ['Headache', '🟡 Mild', '#eab308'], ['Redness', '⚪ Clear', '#64748b']].map(([k, v, c], j) => (
                        <div key={j} className="flex justify-between items-center p-3 rounded-xl" style={{ background: 'rgba(2,6,23,0.6)' }}>
                          <span className="text-slate-500 font-medium">{k}</span>
                          <span className="font-bold text-xs" style={{ color: c }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {i === 2 && (
                    <div className="space-y-3 text-sm">
                      {[['Temperature', '🌡️ 28°C', '#f97316'], ['Humidity', '💧 72%', '#3b82f6'], ['Comfort Index', '⚠️ Poor', '#ef4444'], ['Meals', '🍚 Rice, Dal', '#a3e635']].map(([k, v, c], j) => (
                        <div key={j} className="flex justify-between items-center p-3 rounded-xl" style={{ background: 'rgba(2,6,23,0.6)' }}>
                          <span className="text-slate-500 font-medium">{k}</span>
                          <span className="font-bold text-xs" style={{ color: c }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IMPACT CALCULATOR */}
      <section id="impact" className="relative py-28 px-5 z-10">
        <div className="max-w-5xl mx-auto">
          <div className="glass rounded-3xl p-8 sm:p-12" style={{ boxShadow: '0 0 80px -20px rgba(99,102,241,0.2)' }}>
            <div className="text-center mb-10">
              <div className="text-3xl mb-3">📈</div>
              <h2 className="text-2xl sm:text-4xl font-black text-white mb-3">Wellness Impact Calculator</h2>
              <p className="text-slate-400 text-sm">Estimate how much quality-time Zensit's early intervention can recover monthly</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
              <div className="space-y-8">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monthly flare-up episodes</label>
                    <span className="badge text-xs font-black px-3 py-1 rounded-full">{flareups} eps</span>
                  </div>
                  <input type="range" min="1" max="20" value={flareups} onChange={e => setFlareups(+e.target.value)} className="w-full" />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1 font-semibold">
                    <span>1</span><span>20 episodes</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recovery days per episode</label>
                    <span className="badge text-xs font-black px-3 py-1 rounded-full">{recoveryDays}d each</span>
                  </div>
                  <input type="range" min="1" max="7" value={recoveryDays} onChange={e => setRecoveryDays(+e.target.value)} className="w-full" />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1 font-semibold">
                    <span>1 day</span><span>7 days</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-center space-y-5">
                <div className="p-5 rounded-2xl space-y-2" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">Without Zensit</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-red-400">{totalDaysLost}</span>
                    <span className="text-slate-500 font-semibold">days compromised / mo</span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl space-y-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">With Zensit Tracking</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black" style={{ color: '#818cf8' }}>{projected}</span>
                    <span className="text-slate-500 font-semibold">days projected / mo</span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(59,130,246,0.08) 100%)', border: '1px solid rgba(99,102,241,0.25)' }}>
                  <div className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-2">Recovery time reclaimed</div>
                  <div className="text-4xl font-black mb-1" style={{ color: '#6366f1' }}>{saved} <span className="text-xl text-slate-400">days</span></div>
                  <div className="text-xs font-bold" style={{ color: '#818cf8' }}>~{savePct}% improvement projected</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative py-28 px-5 z-10 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-6 tracking-tight">
            Start Your Telemetry<br />
            <span className="shimmer-text">Log Today</span>
          </h2>
          <p className="text-slate-400 text-sm sm:text-base mb-8 leading-relaxed">
            Free. Works offline as a PWA. Exports structured data for MedGemma analysis.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/wizard" className="btn-primary inline-flex items-center justify-center gap-2 px-10 py-4 rounded-2xl text-sm font-black text-white">
              🚀 Open Patient Wizard
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-5 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(3,7,18,0.8)' }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-slate-600 font-medium">
          <span>💠 <strong className="text-slate-400">Zensit</strong> — Personal Allergy Telemetry Suite</span>
          <span>© 2026 · MedGemma Compatible · PWA Ready</span>
        </div>
      </footer>
    </div>
  );
}
