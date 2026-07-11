"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// Healthy human Box Breathing: Inhale 4s → Hold 4s → Exhale 4s → Hold 4s = 16s cycle
const BREATH_CYCLE: { phase: string; label: string; duration: number; color: string; bgGlow: string; instruction: string }[] = [
  { phase: "inhale",   label: "Inhale", duration: 4, color: "#818cf8", bgGlow: "rgba(129, 140, 248, 0.2)",  instruction: "Breathe in through your nose..." },
  { phase: "hold-in",  label: "Hold",   duration: 4, color: "#a78bfa", bgGlow: "rgba(167, 139, 250, 0.2)",  instruction: "Hold your breath calmly..." },
  { phase: "exhale",   label: "Exhale", duration: 4, color: "#22d3ee", bgGlow: "rgba(34, 211, 238, 0.2)",  instruction: "Exhale fully through your mouth..." },
  { phase: "hold-out", label: "Hold",   duration: 4, color: "#34d399", bgGlow: "rgba(52, 211, 153, 0.2)",  instruction: "Rest and hold before inhale..." }
];

export default function Home() {
  const [navSolid, setNavSolid] = useState(false);
  const [comfortFeeling, setComfortFeeling] = useState<"sniffling" | "tired" | "anxious">("sniffling");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Breath state
  const [breathPhaseIdx, setBreathPhaseIdx] = useState(0);
  const [breathTick, setBreathTick] = useState(0); // decimal seconds in current phase

  useEffect(() => {
    const fn = () => setNavSolid(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // Breath tick: fires every 50ms for ultra-smooth sub-second rendering
  useEffect(() => {
    const tickMs = 50;
    const id = setInterval(() => {
      setBreathTick(t => {
        const phase = BREATH_CYCLE[breathPhaseIdx];
        const nextTick = t + (tickMs / 1000);
        if (nextTick >= phase.duration) {
          setBreathPhaseIdx(i => (i + 1) % BREATH_CYCLE.length);
          return 0;
        }
        return nextTick;
      });
    }, tickMs);
    return () => clearInterval(id);
  }, [breathPhaseIdx]);

  // Soothing, slow-floating particle background
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const pts = Array.from({ length: 35 }, () => ({
      x: Math.random() * c.width, y: Math.random() * c.height,
      vx: (Math.random() - 0.5) * 0.12, vy: (Math.random() - 0.5) * 0.12,
    }));
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > c.width) p.vx *= -1;
        if (p.y < 0 || p.y > c.height) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(129, 140, 248, 0.25)"; ctx.fill();
      });
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.hypot(dx, dy);
          if (d < 160) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(129, 140, 248, ${0.06 * (1 - d / 160)})`;
            ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  const features = [
    { icon: "🩺", title: "Symptom Logging", body: "Gently catalog symptoms — itching, redness, mucus, headache, and nausea. Includes a real-time sneeze counter." },
    { icon: "🌡️", title: "Climate Telemetry", body: "GPS-powered ambient temperature and humidity tracking logs environmental variables to spot trends." },
    { icon: "🤖", title: "Clinical Export", body: "Structured JSON telemetry export is fully ready for doctor verification or MedGemma LLM analysis." },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Particle bg */}
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: "-30%", left: "-15%", width: 700, height: 700, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)"
        }} className="anim-float" />
        <div style={{
          position: "absolute", bottom: "-25%", right: "-10%", width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)", animationDelay: "3s"
        }} className="anim-float" />
      </div>

      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        transition: "background 0.3s, border-color 0.3s",
        ...(navSolid ? { background: "rgba(8,12,20,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" } : {})
      }}>
        <div className="container" style={{ height: 68, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, background: "var(--indigo-lo)", border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden"
            }}>
              <img src="/icon-192x192.png" alt="Zensit" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <span style={{ fontWeight: 900, fontSize: "1.15rem", letterSpacing: "-0.03em", color: "#fff" }}>
              Zen<span style={{ color: "#818cf8" }}>sit</span>
            </span>
            <span className="pill pill-indigo" style={{ fontSize: "0.6rem", padding: "3px 8px" }}>PWA</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/admin" className="btn btn-ghost btn-sm">Console</Link>
            <Link href="/wizard" className="btn btn-primary btn-sm">Log Symptoms →</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        position: "relative", zIndex: 1, minHeight: "90svh", display: "flex", alignItems: "center",
        justifyContent: "center", paddingTop: 110, paddingBottom: 50, textAlign: "center"
      }}>
        <div className="container" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          
          {/* ── PREMIUM INTERACTIVE BOX BREATHING CIRCLE ── */}
          {(() => {
            const bp = BREATH_CYCLE[breathPhaseIdx];
            const progress = breathTick / bp.duration; // 0 to 1
            const R_R = 70;
            const R_C = 90;
            const circ = 2 * Math.PI * R_R;

            // Logo scale matching breath sequence
            let logoScale = 1.0;
            if (bp.phase === "inhale") {
              logoScale = 1.0 + (0.28 * progress);
            } else if (bp.phase === "hold-in") {
              logoScale = 1.28;
            } else if (bp.phase === "exhale") {
              logoScale = 1.28 - (0.28 * progress);
            } else {
              logoScale = 1.0;
            }

            // circular timeline stroke offset
            const strokeOffset = circ * (1 - progress);

            return (
              <div className="anim-fadeup" style={{ 
                marginBottom: 36,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16
              }}>
                <style dangerouslySetInnerHTML={{ __html: `
                  @keyframes breath-ripple {
                    0% { transform: scale(0.95); opacity: 0.8; }
                    50% { transform: scale(1.22); opacity: 0.15; }
                    100% { transform: scale(1.4); opacity: 0; }
                  }
                `}} />

                <div style={{ position: "relative", width: R_C * 2, height: R_C * 2 }}>
                  {/* Glowing background ripple during Inhale/Hold */}
                  {(bp.phase === "inhale" || bp.phase === "hold-in") && (
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      background: `radial-gradient(circle, ${bp.color}44 0%, transparent 70%)`,
                      animation: "breath-ripple 2.5s infinite linear",
                      pointerEvents: "none"
                    }} />
                  )}

                  {/* SVG progress ring */}
                  <svg width={R_C * 2} height={R_C * 2} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
                    <circle cx={R_C} cy={R_C} r={R_R} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="4" />
                    <circle
                      cx={R_C} cy={R_C} r={R_R}
                      fill="none" stroke={bp.color} strokeWidth="4.5"
                      strokeDasharray={circ}
                      strokeDashoffset={strokeOffset}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dashoffset 0.06s linear, stroke 0.6s ease" }}
                    />
                  </svg>

                  {/* Rounded square logo frame */}
                  <div style={{
                    position: "absolute",
                    inset: 20,
                    borderRadius: "50%",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(10, 15, 30, 0.7)",
                    border: `2px solid ${bp.color}`,
                    boxShadow: `0 0 35px ${bp.color}25`,
                    transform: `scale(${logoScale})`,
                    transition: "transform 0.08s linear, border-color 0.6s ease, box-shadow 0.6s ease"
                  }}>
                    <img 
                      src="/Zen_logo.png" 
                      alt="Zensit Logo" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/icon-192x192.png";
                      }}
                      style={{ 
                        width: "100%", 
                        height: "100%", 
                        objectFit: "cover"
                      }} 
                    />
                  </div>
                </div>

                {/* Breathing instructions HUD */}
                <div style={{ textAlign: "center" }}>
                  <span className="pill" style={{ 
                    background: `${bp.color}15`, 
                    color: bp.color, 
                    border: `1.5px solid ${bp.color}35`,
                    padding: "6px 18px",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    fontSize: "0.8rem",
                    textTransform: "uppercase"
                  }}>
                    {bp.label} · {Math.max(1, Math.ceil(bp.duration - breathTick))}s
                  </span>
                  <div className="t-label" style={{ marginTop: 10, fontSize: "0.85rem", color: "var(--muted)", fontWeight: 500 }}>
                    {bp.instruction}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="anim-fadeup delay-1" style={{ marginBottom: 20 }}>
            <span className="pill pill-indigo">
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", display: "inline-block", marginRight: 6 }} />
              A Calming Sanctuary for Allergy Logging
            </span>
          </div>

          <h1 className="t-hero anim-fadeup delay-2" style={{ marginBottom: 20, fontSize: "clamp(2rem, 5vw, 3.2rem)", lineHeight: 1.15 }}>
            Breathe Easy.<br /><span className="grad-text">Live Mindfully.</span>
          </h1>

          <p className="t-body anim-fadeup delay-3" style={{ maxWidth: 540, margin: "0 auto 36px", fontSize: "1.05rem", color: "var(--muted)", lineHeight: 1.65 }}>
            Healing begins with understanding. By pairing simple climate tracking with daily symptom logs, Zensit helps you find predictability, bringing clarity and calm to allergy management.
          </p>

          <div className="anim-fadeup delay-4" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/wizard" className="btn btn-primary btn-lg">Start Logging</Link>
            <Link href="/admin" className="btn btn-ghost btn-lg">Clinical Console</Link>
          </div>
        </div>
      </section>

      {/* SOOTHING AWARENESS STATS & COMFORTER */}
      <section style={{ position: "relative", zIndex: 1, padding: "64px 0" }}>
        <div className="container">
          
          <div className="card-hi" style={{ padding: "44px 36px", background: "rgba(10, 16, 28, 0.7)", border: "1px solid var(--border)" }}>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div className="pill pill-indigo" style={{ marginBottom: 12 }}>Allergy Awareness Hub</div>
              <h2 className="t-title" style={{ fontSize: "clamp(1.4rem,3vw,2rem)", marginBottom: 10 }}>Empowering Facts for Comfort</h2>
              <p className="t-body" style={{ fontSize: "0.9375rem", color: "var(--muted)", maxWidth: 500, margin: "0 auto" }}>
                You are in control. Let statistics reassure you that relief is structured, predictable, and within reach.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 32 }}>
              
              {/* Comfort Facts Grid */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[
                  { title: "You Are Not Alone", desc: "Over 400 million people globally manage allergic rhinitis. Knowing this normalizes the path to healing." },
                  { title: "Predictable Triggers", desc: "Up to 80% of allergen flare-ups are manageable with proactive logging and climate mapping." },
                  { title: "Serene Environments", desc: "Keeping indoor humidity between 35%-50% naturally reduces airborne dust mites and spores by half." },
                  { title: "Doctor Empowered", desc: "Structured telemetry formats logs directly for clinical review, removing guesswork from doctor appointments." }
                ].map((fact, index) => (
                  <div key={index} style={{
                    padding: "16px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--border-hi)",
                    borderRadius: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6
                  }}>
                    <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#818cf8" }}>✨ {fact.title}</span>
                    <span style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.5 }}>{fact.desc}</span>
                  </div>
                ))}
              </div>

              {/* Soothing Comfort Interactive Selector */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: 20,
                padding: "24px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1.5px solid var(--border)",
                borderRadius: "16px",
                justifyContent: "center"
              }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fff", textAlign: "center" }}>
                  How are you feeling right now?
                </h3>
                
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  {[
                    { key: "sniffling", label: "🤧 Sniffling" },
                    { key: "tired", label: "😴 Fatigued" },
                    { key: "anxious", label: "😰 Anxious" }
                  ].map(btn => (
                    <button
                      key={btn.key}
                      onClick={() => setComfortFeeling(btn.key as any)}
                      className={`loc-tag ${comfortFeeling === btn.key ? "active" : ""}`}
                      style={{ fontSize: "0.85rem", padding: "8px 16px" }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <div style={{
                  padding: "20px",
                  background: comfortFeeling === "sniffling" ? "rgba(99, 102, 241, 0.06)" : 
                             comfortFeeling === "tired" ? "rgba(245, 158, 11, 0.06)" : "rgba(16, 185, 129, 0.06)",
                  border: `1px solid ${
                    comfortFeeling === "sniffling" ? "rgba(99, 102, 241, 0.2)" : 
                    comfortFeeling === "tired" ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)"
                  }`,
                  borderRadius: "12px",
                  minHeight: 120,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  transition: "all 0.3s ease"
                }}>
                  {comfortFeeling === "sniffling" && (
                    <>
                      <strong style={{ color: "#818cf8", fontSize: "0.875rem", marginBottom: 6 }}>💧 Soothing your nasal passages:</strong>
                      <p style={{ fontSize: "0.8125rem", color: "var(--text)", lineHeight: 1.5, margin: 0 }}>
                        Take a slow breath. Sipping warm herbal tea or inhaling steam from a warm shower helps thin mucus and relaxes irritated tissues. You are safe, and this sensation will ease soon.
                      </p>
                    </>
                  )}
                  {comfortFeeling === "tired" && (
                    <>
                      <strong style={{ color: "#fb923c", fontSize: "0.875rem", marginBottom: 6 }}>🌿 Rest is part of recovery:</strong>
                      <p style={{ fontSize: "0.8125rem", color: "var(--text)", lineHeight: 1.5, margin: 0 }}>
                        Allergy flare-ups consume physical energy as your body works to protect itself. Allow yourself to rest without guilt. Close your eyes and keep indoor air clear. You are healing.
                      </p>
                    </>
                  )}
                  {comfortFeeling === "anxious" && (
                    <>
                      <strong style={{ color: "#34d399", fontSize: "0.875rem", marginBottom: 6 }}>🌬️ Calming the nervous system:</strong>
                      <p style={{ fontSize: "0.8125rem", color: "var(--text)", lineHeight: 1.5, margin: 0 }}>
                        The body's natural inflammatory response can mimic heart rate increases and mild anxiety. It is just a physical reaction. Focus on slow, calm breathing. This will pass gently.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* FEATURES */}
      <section style={{ position: "relative", zIndex: 1, padding: "40px 0 80px" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div className="pill pill-indigo" style={{ marginBottom: 16 }}>Clinical Features</div>
            <h2 className="t-title">Carefully Designed Ecosystem</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {features.map((f, i) => (
              <div key={i} className="card" style={{ padding: "28px 24px" }}>
                <div style={{ fontSize: "2rem", marginBottom: 16 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: "1.0625rem", color: "#fff", marginBottom: 10 }}>{f.title}</div>
                <p className="t-body" style={{ fontSize: "0.875rem" }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ position: "relative", zIndex: 1, padding: "0 0 96px" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <h2 className="t-title" style={{ marginBottom: 16 }}>Take a peaceful step today</h2>
          <p className="t-body" style={{ maxWidth: 460, margin: "0 auto 32px" }}>
            Start building your health logs with comforting and simple telemetry monitoring.
          </p>
          <Link href="/wizard" className="btn btn-primary btn-lg">Start Logging</Link>
        </div>
      </section>
    </div>
  );
}
