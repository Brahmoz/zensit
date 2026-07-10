"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export default function Home() {
  const [flareups, setFlareups]       = useState(8);
  const [recovery, setRecovery]       = useState(3);
  const [navSolid, setNavSolid]       = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const total   = flareups * recovery;
  const with_z  = Math.max(1, Math.round(total * 0.22));
  const saved   = total - with_z;
  const pct     = Math.round((saved / total) * 100);

  useEffect(() => {
    const fn = () => setNavSolid(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // Particle network
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const pts = Array.from({ length: 50 }, () => ({
      x: Math.random() * c.width, y: Math.random() * c.height,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
    }));
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > c.width)  p.vx *= -1;
        if (p.y < 0 || p.y > c.height) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(99,102,241,0.5)"; ctx.fill();
      });
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.hypot(dx, dy);
          if (d < 110) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(99,102,241,${0.07 * (1 - d / 110)})`;
            ctx.lineWidth = 0.8; ctx.stroke();
          }
        }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  const features = [
    { icon: "🩺", title: "Symptom Logging",   body: "Tap to activate symptoms — itching, redness, mucus, headache, nausea. Includes a real-time sneeze frequency counter." },
    { icon: "🌡️", title: "Climate Telemetry", body: "GPS-powered ambient temperature and humidity, logged automatically with every session for correlation analysis." },
    { icon: "🤖", title: "MedGemma Export",   body: "One-tap export of your full telemetry history as structured JSON ready for LLM clinical analysis." },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Particle bg */}
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-30%", left: "-15%", width: 700, height: 700, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)" }} className="anim-float" />
        <div style={{ position: "absolute", bottom: "-25%", right: "-10%", width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)", animationDelay: "3s" }} className="anim-float" />
      </div>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        transition: "background 0.3s, border-color 0.3s",
        ...(navSolid ? { background: "rgba(8,12,20,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" } : {}) }}>
        <div className="container" style={{ height: 68, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, background: "var(--indigo-lo)", border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <img src="/icon-192x192.png" alt="Zensit" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <span style={{ fontWeight: 900, fontSize: "1.15rem", letterSpacing: "-0.03em", color: "#fff" }}>
              Zen<span style={{ color: "#818cf8" }}>sit</span>
            </span>
            <span className="pill pill-indigo" style={{ fontSize: "0.6rem", padding: "3px 8px" }}>PWA</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/admin" className="btn btn-ghost btn-sm" style={{ display: "none" }} id="nav-console">Console</Link>
            <Link href="/admin" className="btn btn-ghost btn-sm">Console</Link>
            <Link href="/wizard" className="btn btn-primary btn-sm">Log Symptoms →</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position: "relative", zIndex: 1, minHeight: "100svh", display: "flex", alignItems: "center",
        justifyContent: "center", paddingTop: 100, paddingBottom: 80, textAlign: "center" }}>
        <div className="container">
          <div className="anim-fadeup" style={{ marginBottom: 24 }}>
            <span className="pill pill-indigo">
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", animation: "pulse-ring 2s infinite", display: "inline-block" }} />
              Live Allergy Telemetry · Mobile-First Clinical PWA
            </span>
          </div>

          <h1 className="t-hero anim-fadeup delay-1" style={{ marginBottom: 20 }}>
            Track your<br /><span className="grad-text">allergy triggers</span><br />in real time.
          </h1>

          <p className="t-body anim-fadeup delay-2" style={{ maxWidth: 520, margin: "0 auto 36px", fontSize: "1rem" }}>
            Pair GPS climate data with symptom logs to build a rich telemetry timeline. Export structured JSON for MedGemma LLM clinical analysis.
          </p>

          <div className="anim-fadeup delay-3" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/wizard" className="btn btn-primary btn-lg">🩺 Start Logging</Link>
            <Link href="/admin" className="btn btn-ghost btn-lg">View Dashboard</Link>
          </div>

          {/* Stats */}
          <div className="anim-fadeup delay-4 stats-grid" style={{ maxWidth: 680, margin: "64px auto 0" }}>
            {[
              { n: "78%",  l: "Flare-up reduction" },
              { n: "10s",  l: "Sneeze timer" },
              { n: "24/7", l: "Climate tracking" },
              { n: "100%", l: "MedGemma ready" },
            ].map((s, i) => (
              <div key={i} className="card" style={{ padding: "18px 12px", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#818cf8", letterSpacing: "-0.04em", marginBottom: 4 }}>{s.n}</div>
                <div className="t-label" style={{ fontSize: "0.65rem", lineHeight: 1.4 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Scroll cue */}
          <div className="anim-fadeup delay-5" style={{ marginTop: 56, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <span className="t-label" style={{ fontSize: "0.6rem" }}>scroll</span>
            <div style={{ width: 22, height: 36, border: "1px solid var(--border)", borderRadius: 999,
              display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 6 }}>
              <div style={{ width: 4, height: 8, background: "#6366f1", borderRadius: 999,
                animation: "fadeUp 1.5s ease-in-out infinite alternate" }} />
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ position: "relative", zIndex: 1, padding: "96px 0" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div className="pill pill-indigo" style={{ marginBottom: 16 }}>How it works</div>
            <h2 className="t-title">Three steps, complete picture</h2>
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

      {/* CALCULATOR */}
      <section style={{ position: "relative", zIndex: 1, padding: "0 0 96px" }}>
        <div className="container">
          <div className="card-hi" style={{ padding: "40px 32px" }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div className="pill pill-indigo" style={{ marginBottom: 16 }}>Wellness calculator</div>
              <h2 className="t-title" style={{ fontSize: "clamp(1.4rem,3vw,2rem)" }}>How many days could you reclaim?</h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 40 }}>
              {/* Sliders */}
              <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <label className="t-label">Monthly flare-ups</label>
                    <span className="pill pill-indigo">{flareups} episodes</span>
                  </div>
                  <input type="range" min={1} max={20} value={flareups} onChange={e => setFlareups(+e.target.value)} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    <span className="t-label" style={{ fontSize: "0.65rem" }}>1</span>
                    <span className="t-label" style={{ fontSize: "0.65rem" }}>20</span>
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <label className="t-label">Recovery days each</label>
                    <span className="pill pill-indigo">{recovery} days</span>
                  </div>
                  <input type="range" min={1} max={7} value={recovery} onChange={e => setRecovery(+e.target.value)} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    <span className="t-label" style={{ fontSize: "0.65rem" }}>1</span>
                    <span className="t-label" style={{ fontSize: "0.65rem" }}>7</span>
                  </div>
                </div>
              </div>

              {/* Results */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ padding: "20px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 14 }}>
                  <div className="t-label" style={{ marginBottom: 8, fontSize: "0.65rem" }}>Without Zensit</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: "2.2rem", fontWeight: 900, color: "#f87171", letterSpacing: "-0.04em" }}>{total}</span>
                    <span className="t-label" style={{ color: "var(--muted)" }}>days compromised / mo</span>
                  </div>
                </div>
                <div style={{ padding: "20px", background: "var(--indigo-lo)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 14 }}>
                  <div className="t-label" style={{ marginBottom: 8, fontSize: "0.65rem" }}>With Zensit</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: "2.2rem", fontWeight: 900, color: "#818cf8", letterSpacing: "-0.04em" }}>{with_z}</span>
                    <span className="t-label" style={{ color: "var(--muted)" }}>days projected / mo</span>
                  </div>
                </div>
                <div style={{ padding: "20px", background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 14 }}>
                  <div className="t-label" style={{ marginBottom: 8, fontSize: "0.65rem" }}>Days reclaimed</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: "2.5rem", fontWeight: 900, color: "#4ade80", letterSpacing: "-0.04em" }}>{saved}</span>
                    <span className="t-label" style={{ color: "#4ade80" }}>≈ {pct}% better</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ position: "relative", zIndex: 1, padding: "0 0 96px", textAlign: "center" }}>
        <div className="container" style={{ maxWidth: 560 }}>
          <h2 className="t-title" style={{ marginBottom: 16 }}>
            Ready to understand<br /><span className="grad-text">your allergies?</span>
          </h2>
          <p className="t-body" style={{ marginBottom: 32 }}>Free. Works offline. Exports to MedGemma.</p>
          <Link href="/wizard" className="btn btn-primary btn-lg">Open Symptom Wizard →</Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ position: "relative", zIndex: 1, borderTop: "1px solid var(--border)", padding: "24px 0" }}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, color: "var(--muted)", fontSize: "0.8125rem" }}>
            <img src="/icon-192x192.png" alt="Zensit" style={{ width: 18, height: 18, objectFit: "contain" }} />
            Zensit · Personal Allergy Telemetry
          </span>
          <span className="t-label" style={{ fontSize: "0.65rem" }}>© 2026 · PWA Ready · MedGemma Compatible</span>
        </div>
      </footer>
    </div>
  );
}
