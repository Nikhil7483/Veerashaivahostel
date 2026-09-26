import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import basavannaImg from '../../assets/basavanna.png';
import swamijiImg from '../../assets/swamiji.jpg';
import shadakshariImg from '../../assets/shadakshari.jpg';

/* ─────────────────────────────────────────────────────────
   LANDING PAGE — Veerashaiva Lingayath Boys Hostel
   Premium cinematic institutional design  •  Phase 35
   ONE continuous background · Basavanna right · No login form
───────────────────────────────────────────────────────── */

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700;800;900&family=Noto+Sans+Kannada:wght@400;500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }

  @keyframes lp-fadeIn    { from { opacity: 0 } to { opacity: 1 } }
  @keyframes lp-fadeUp    { from { opacity: 0; transform: translateY(32px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes lp-basavanna { from { opacity: 0; transform: translateX(50px) scale(.96) } to { opacity: 1; transform: translateX(0) scale(1) } }
  @keyframes lp-shimmer   { 0% { background-position: -300% center } 100% { background-position: 300% center } }
  @keyframes lp-glow      {
    0%,100% { text-shadow: 0 0 22px rgba(251,191,36,.55), 0 0 44px rgba(251,191,36,.2) }
    50%      { text-shadow: 0 0 38px rgba(251,191,36,.9),  0 0 80px rgba(251,191,36,.4) }
  }
  @keyframes lp-bgPulse   { 0%,100% { opacity: .55 } 50% { opacity: .7 } }
  @keyframes lp-divider   { from { width: 0; opacity: 0 } to { width: 80px; opacity: 1 } }

  .lp-fade  { animation: lp-fadeIn    1s  .05s ease both }
  .lp-1     { animation: lp-fadeUp   .85s .15s ease both }
  .lp-2     { animation: lp-fadeUp   .85s .30s ease both }
  .lp-3     { animation: lp-fadeUp   .85s .45s ease both }
  .lp-4     { animation: lp-fadeUp   .85s .60s ease both }
  .lp-5     { animation: lp-fadeUp   .85s .75s ease both }
  .lp-6     { animation: lp-fadeUp   .85s .90s ease both }
  .lp-img   { animation: lp-basavanna 1.1s .2s  ease both }

  .lp-gold {
    background: linear-gradient(90deg,#fbbf24 0%,#fde68a 22%,#f59e0b 44%,#fffbeb 55%,#f59e0b 70%,#fbbf24 100%);
    background-size: 300% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: lp-shimmer 6s linear infinite;
  }
  .lp-kannada-glow { animation: lp-glow 3.5s ease-in-out infinite }

  .lp-login-pill {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 22px; border-radius: 999px;
    background: rgba(251,191,36,.12);
    color: #fbbf24; font-weight: 700; font-size: .78rem;
    letter-spacing: .12em; text-transform: uppercase; text-decoration: none;
    border: 1.5px solid rgba(251,191,36,.4);
    backdrop-filter: blur(8px);
    transition: background .25s, border-color .25s, box-shadow .25s, transform .2s;
  }
  .lp-login-pill:hover {
    background: rgba(251,191,36,.24);
    border-color: rgba(251,191,36,.75);
    box-shadow: 0 0 22px rgba(251,191,36,.35);
    transform: translateY(-2px);
  }

  .lp-cta {
    display: inline-flex; align-items: center; gap: 12px;
    padding: 16px 52px; border-radius: 999px;
    background: linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 40%,#2563eb 70%,#3b82f6 100%);
    color: #fff; font-weight: 800; font-size: 1rem;
    letter-spacing: .06em; text-decoration: none;
    border: 1.5px solid rgba(255,255,255,.2);
    box-shadow: 0 8px 36px rgba(29,78,216,.6);
    transition: transform .25s, box-shadow .25s, background .25s;
  }
  .lp-cta:hover {
    transform: translateY(-4px) scale(1.03);
    box-shadow: 0 16px 52px rgba(29,78,216,.75), 0 0 24px rgba(251,191,36,.22);
    background: linear-gradient(135deg,#1e40af 0%,#2563eb 40%,#3b82f6 70%,#60a5fa 100%);
  }
  .lp-cta-arrow {
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 50%;
    background: rgba(255,255,255,.18);
    transition: transform .25s, background .25s;
  }
  .lp-cta:hover .lp-cta-arrow { transform: translateX(4px); background: rgba(255,255,255,.28); }

  .lp-feat {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 14px 16px; border-radius: 14px;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.1);
    backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    flex: 1; min-width: 110px;
    transition: background .25s, border-color .25s, transform .25s;
    cursor: default;
  }
  .lp-feat:hover {
    background: rgba(251,191,36,.1);
    border-color: rgba(251,191,36,.32);
    transform: translateY(-4px);
  }

  .lp-divider {
    height: 2px; border-radius: 2px;
    background: linear-gradient(90deg,transparent,#fbbf24 40%,#f59e0b 60%,transparent);
    animation: lp-divider .9s .55s ease both;
    width: 80px;
  }

  .lp-dot {
    display: inline-block; width: 4px; height: 4px; border-radius: 50%;
    background: rgba(251,191,36,.5); vertical-align: middle; margin: 0 8px;
  }

  /* ── Hostel Leadership Section ── */
  .lp-leadership-section {
    position: relative;
    z-index: 1;
    padding: clamp(52px, 7vw, 84px) clamp(16px, 5vw, 60px);
    border-top: 1px solid rgba(251, 191, 36, 0.12);
    background: linear-gradient(180deg, rgba(2, 8, 23, 0.35) 0%, rgba(5, 12, 30, 0.6) 100%);
  }

  .lp-leadership-container {
    max-width: 1000px;
    margin: 0 auto;
    width: 100%;
  }

  .lp-leadership-header {
    text-align: center;
    margin-bottom: clamp(32px, 4.5vw, 44px);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .lp-leadership-sublabel {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 18px;
    border-radius: 999px;
    background: rgba(251, 191, 36, 0.09);
    border: 1px solid rgba(251, 191, 36, 0.28);
    font-size: clamp(0.7rem, 1.5vw, 0.78rem);
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #fbbf24;
    margin-bottom: 12px;
  }

  .lp-leadership-title {
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: clamp(1.8rem, 4vw, 2.5rem);
    font-weight: 800;
    letter-spacing: -0.01em;
    color: #f8fafc;
    margin-bottom: 14px;
    line-height: 1.2;
  }

  .lp-leadership-divider {
    height: 2px;
    border-radius: 2px;
    background: linear-gradient(90deg, transparent, #fbbf24 35%, #f59e0b 65%, transparent);
    width: 80px;
    margin: 0 auto;
  }

  .lp-leadership-cards {
    display: flex;
    flex-direction: column;
    gap: clamp(28px, 4vw, 42px);
  }

  .lp-leader-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 14px;
    border-radius: 999px;
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.3);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #fbbf24;
    margin-bottom: 8px;
  }

  .lp-leader-card {
    display: flex;
    align-items: center;
    gap: clamp(28px, 4.5vw, 48px);
    padding: clamp(28px, 4.5vw, 44px);
    border-radius: 22px;
    background: rgba(8, 16, 36, 0.72);
    border: 1px solid rgba(251, 191, 36, 0.22);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 20px 48px -10px rgba(0, 0, 0, 0.55), 0 0 30px rgba(251, 191, 36, 0.06);
    transition: border-color 0.3s ease, box-shadow 0.3s ease;
  }

  .lp-leader-card:hover {
    border-color: rgba(251, 191, 36, 0.38);
    box-shadow: 0 24px 56px -10px rgba(0, 0, 0, 0.65), 0 0 36px rgba(251, 191, 36, 0.1);
  }

  .lp-leader-photo-wrap {
    flex: 0 0 clamp(220px, 26vw, 290px);
    position: relative;
    border-radius: 18px;
    padding: 5px;
    background: linear-gradient(145deg, rgba(251, 191, 36, 0.38) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(245, 158, 11, 0.25) 100%);
    box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.5), 0 0 24px rgba(251, 191, 36, 0.12);
  }

  .lp-leader-img {
    width: 100%;
    height: auto;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    object-position: center top;
    border-radius: 14px;
    display: block;
  }

  .lp-leader-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
  }

  .lp-leader-name {
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: clamp(1.5rem, 2.8vw, 2.1rem);
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.01em;
    line-height: 1.25;
    margin-bottom: 8px;
  }

  .lp-leader-designation {
    font-size: clamp(0.92rem, 1.8vw, 1.05rem);
    line-height: 1.45;
    margin-bottom: 20px;
    letter-spacing: 0.01em;
  }

  .lp-leader-designation-title {
    color: #fbbf24;
    font-weight: 800;
  }

  .lp-leader-designation-sep {
    color: rgba(251, 191, 36, 0.6);
    margin: 0 2px;
  }

  .lp-leader-designation-inst {
    color: #e2e8f0;
    font-weight: 600;
  }

  .lp-leader-desc {
    font-size: clamp(0.92rem, 1.6vw, 1.02rem);
    line-height: 1.78;
    color: #cbd5e1;
    font-weight: 400;
    letter-spacing: 0.01em;
    border-left: 2.5px solid rgba(251, 191, 36, 0.45);
    padding-left: 18px;
    margin-top: 4px;
  }

  @media (max-width: 767px) {
    .lp-hero-grid { flex-direction: column !important; align-items: center !important; }
    .lp-hero-img-col { order: -1 !important; width: 100% !important; max-width: 240px !important; margin: 0 auto !important; }
    .lp-hero-text-col { text-align: center !important; align-items: center !important; }
    .lp-feat-strip { flex-wrap: wrap !important; }
    .lp-feat { min-width: calc(50% - 8px) !important; }
    .lp-tagline { justify-content: center !important; }

    .lp-leader-card {
      flex-direction: column !important;
      text-align: center !important;
      padding: clamp(20px, 5vw, 32px) !important;
      gap: 20px !important;
    }
    .lp-leader-photo-wrap {
      flex: 0 0 auto !important;
      width: 100% !important;
      max-width: 240px !important;
      margin: 0 auto 4px auto !important;
    }
    .lp-leader-content {
      align-items: center !important;
      text-align: center !important;
    }
    .lp-leader-designation {
      text-align: center !important;
      margin-bottom: 16px !important;
    }
    .lp-leader-desc {
      border-left: none !important;
      border-top: 1px solid rgba(251, 191, 36, 0.2) !important;
      padding-left: 0 !important;
      padding-top: 16px !important;
      text-align: center !important;
    }
  }
  @media (max-width: 480px) {
    .lp-feat { min-width: calc(50% - 6px) !important; }
  }
`;



/* ═══════════════════════════════════════════════════════ */

const FeaturePill = ({ icon, label, sub }) => (
  <div className="lp-feat">
    <span style={{ fontSize: '1.55rem', lineHeight: 1 }}>{icon}</span>
    <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#f1f5f9', letterSpacing: '.04em', textAlign: 'center' }}>{label}</span>
    {sub && <span style={{ fontSize: '.6rem', color: '#94a3b8', fontWeight: 500, textAlign: 'center' }}>{sub}</span>}
  </div>
);

/* ═══════════════════════════════════════════════════════ */

const LandingPage = () => {
  const imgRef = useRef(null);

  /* Subtle parallax on mouse move — desktop only */
  useEffect(() => {
    const handleMove = (e) => {
      if (!imgRef.current || window.innerWidth < 768) return;
      const xPct = (e.clientX / window.innerWidth  - 0.5) * 7;
      const yPct = (e.clientY / window.innerHeight - 0.5) * 4;
      imgRef.current.style.transform = `translate(${xPct}px, ${yPct}px) scale(1.02)`;
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  return (
    <>
      <style>{STYLES}</style>

      <div style={{
        minHeight: '100vh', position: 'relative',
        fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
        color: '#f1f5f9', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* ══ FULL-PAGE BACKGROUND — deep navy + warm gold glow ══ */}
        <div className="lp-fade" style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
          {/* Base deep navy/midnight */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#020817 0%,#050d1f 25%,#07122a 45%,#0a1628 65%,#060e1f 85%,#030a18 100%)' }} />
          {/* Warm amber glow — right side (Basavanna) */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 80% at 78% 58%, rgba(180,100,10,.2) 0%, transparent 65%)', animation: 'lp-bgPulse 6s ease-in-out infinite' }} />
          {/* Cool blue glow — left */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 65% at 18% 42%, rgba(29,78,216,.15) 0%, transparent 58%)' }} />
          {/* Top/bottom vignette */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,rgba(2,8,23,.65) 0%,transparent 16%,transparent 76%,rgba(2,8,23,.85) 100%)' }} />
          {/* Subtle horizontal gold accent lines */}
          <div style={{ position: 'absolute', top: '17%', left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg,transparent 0%,rgba(251,191,36,.07) 30%,rgba(251,191,36,.12) 50%,rgba(251,191,36,.07) 70%,transparent 100%)' }} />
          <div style={{ position: 'absolute', top: '83%', left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg,transparent 0%,rgba(251,191,36,.07) 30%,rgba(251,191,36,.12) 50%,rgba(251,191,36,.07) 70%,transparent 100%)' }} />
        </div>

        {/* ══ TOP NAVIGATION ══ */}
        <header style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'clamp(10px,2vw,16px) clamp(16px,4vw,40px)',
          background: 'rgba(2,8,23,.6)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(251,191,36,.1)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.35 }}>
            <span style={{ fontWeight: 800, fontSize: 'clamp(.72rem,2vw,.9rem)', color: '#f1f5f9', letterSpacing: '-.01em' }}>
              Veerashaiva Lingayath Boys Hostel
            </span>
            <span style={{ fontSize: 'clamp(.58rem,1.4vw,.68rem)', color: '#fbbf24', fontWeight: 600, letterSpacing: '.03em' }}>
              📍 Krushi Nagar, Shivamogga, Karnataka
            </span>
          </div>
          <Link to="/login" className="lp-login-pill" id="top-nav-login-btn" aria-label="Login to Hostel Portal">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            LOGIN
          </Link>
        </header>

        {/* ══ MAIN HERO ══ */}
        <main style={{ flex: 1, position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingTop: 'clamp(70px,10vh,90px)' }}>

          {/* Hero grid: LEFT text · RIGHT Basavanna */}
          <div
            className="lp-hero-grid"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 'clamp(20px,4vw,60px)',
              padding: 'clamp(28px,5vw,60px) clamp(16px,5vw,60px) clamp(16px,3vw,32px)',
              maxWidth: '1280px', margin: '0 auto', width: '100%',
            }}
          >
            {/* ── LEFT: Text content ── */}
            <div
              className="lp-hero-text-col"
              style={{ flex: '1 1 460px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}
            >
              {/* Kannada label */}
              <div className="lp-1" style={{ marginBottom: '14px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '6px 18px', borderRadius: '999px',
                  background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.28)',
                  fontSize: 'clamp(.72rem,1.8vw,.85rem)', fontFamily: "'Noto Sans Kannada',serif",
                  fontWeight: 700, color: '#fde68a', letterSpacing: '.05em',
                }}>
                  ✦&nbsp;ವಿಶ್ವಗುರು&nbsp;✦
                </span>
              </div>

              {/* H1 — Hostel name with gold shimmer */}
              <h1 className="lp-2 lp-gold" style={{
                fontFamily: "'Cinzel','Georgia',serif",
                fontSize: 'clamp(1.8rem,5.5vw,3.8rem)',
                fontWeight: 900, lineHeight: 1.1,
                letterSpacing: '-.02em', marginBottom: '10px', maxWidth: '560px',
              }}>
                Veerashaiva Lingayath<br />Boys Hostel
              </h1>

              {/* Location */}
              <div className="lp-2" style={{ marginBottom: '22px' }}>
                <p style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'clamp(.78rem,2vw,.9rem)', fontWeight: 600, color: '#fbbf24', letterSpacing: '.03em' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  Krushi Nagar, Shivamogga, Karnataka
                </p>
              </div>

              {/* Gold divider */}
              <div className="lp-divider" style={{ marginBottom: '22px' }} />

              {/* Welcome text */}
              <div className="lp-3" style={{ marginBottom: '10px' }}>
                <p style={{ fontSize: 'clamp(.92rem,2.4vw,1.1rem)', fontWeight: 700, color: '#e2e8f0', letterSpacing: '.01em', lineHeight: 1.5 }}>
                  Welcome to the Smart Hostel Management Portal
                </p>
              </div>

              {/* Tagline */}
              <div className="lp-3 lp-tagline" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0, marginBottom: '32px' }}>
                {['Discipline', 'Service', 'Knowledge', 'Better Tomorrow'].map((w, i, a) => (
                  <React.Fragment key={w}>
                    <span style={{ fontSize: 'clamp(.7rem,1.8vw,.8rem)', fontWeight: 600, color: '#94a3b8', letterSpacing: '.04em', textTransform: 'uppercase' }}>{w}</span>
                    {i < a.length - 1 && <span className="lp-dot" />}
                  </React.Fragment>
                ))}
              </div>

              {/* CTA */}
              <div className="lp-4">
                <Link to="/login" className="lp-cta" id="enter-hostel-portal-btn" aria-label="Enter Hostel Portal">
                  <span className="lp-cta-arrow">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="13 17 18 12 13 7" /><line x1="6" y1="12" x2="18" y2="12" />
                    </svg>
                  </span>
                  Enter Hostel Portal
                </Link>
              </div>

              {/* Sub-hint */}
              <div className="lp-5" style={{ marginTop: '14px' }}>
                <p style={{ fontSize: '.68rem', color: '#475569', fontWeight: 500, letterSpacing: '.04em' }}>
                  🔒 Secure portal for Admin &amp; Student access
                </p>
              </div>
            </div>

            {/* ── RIGHT: Basavanna ── */}
            <div
              className="lp-hero-img-col"
              style={{ flex: '0 0 auto', width: 'clamp(200px,34vw,410px)', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              {/* Atmospheric glow behind image */}
              <div style={{
                position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
                width: '90%', height: '75%', borderRadius: '50%',
                background: 'radial-gradient(ellipse,rgba(180,90,10,.3) 0%,rgba(251,191,36,.12) 35%,transparent 70%)',
                filter: 'blur(36px)', zIndex: 0, animation: 'lp-bgPulse 5s ease-in-out infinite',
              }} />

              {/* Basavanna — blends via mix-blend-mode:lighten + mask */}
              <div className="lp-img" ref={imgRef} style={{ position: 'relative', zIndex: 1, width: '100%', transition: 'transform .6s cubic-bezier(.25,.46,.45,.94)' }}>
                <img
                  src={basavannaImg}
                  alt="Basavanna"
                  style={{
                    width: '100%', height: 'auto', display: 'block', objectFit: 'contain',
                    mixBlendMode: 'lighten',
                    WebkitMaskImage: 'linear-gradient(to bottom,black 0%,black 55%,rgba(0,0,0,.55) 78%,transparent 100%)',
                    maskImage: 'linear-gradient(to bottom,black 0%,black 55%,rgba(0,0,0,.55) 78%,transparent 100%)',
                    filter: 'brightness(1.06) contrast(1.04) drop-shadow(0 0 36px rgba(251,191,36,.28))',
                    borderRadius: '12px',
                  }}
                />
              </div>

              {/* Quote card */}
              <div className="lp-5" style={{
                position: 'relative', zIndex: 2, marginTop: '-28px',
                padding: '12px 20px', borderRadius: '14px',
                background: 'rgba(2,8,23,.75)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid rgba(251,191,36,.22)', textAlign: 'center', maxWidth: '270px',
                boxShadow: '0 8px 32px rgba(0,0,0,.55)',
              }}>
                <p className="lp-kannada-glow" style={{ fontFamily: "'Noto Sans Kannada',serif", fontSize: 'clamp(.9rem,2.2vw,1.05rem)', fontWeight: 700, color: '#fde68a', marginBottom: '4px', letterSpacing: '.02em' }}>
                  ಕಾಯಕವೇ ಕೈಲಾಸ
                </p>
                <p style={{ fontSize: '.68rem', color: '#94a3b8', fontStyle: 'italic', fontWeight: 500, lineHeight: 1.5 }}>
                  "Kayakave Kailasa" — Work is divine
                </p>
                <p style={{ fontSize: '.62rem', color: '#64748b', fontWeight: 600, marginTop: '4px', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  — Basavanna
                </p>
              </div>
            </div>
          </div>{/* end hero grid */}

          {/* ══ HOSTEL LEADERSHIP SECTION ══ */}
          <section
            id="hostel-leadership"
            className="lp-leadership-section"
            aria-labelledby="hostel-leadership-heading"
          >
            <div className="lp-leadership-container">
              {/* Subtle label above the profile & Section Title */}
              <div className="lp-leadership-header">
                <span className="lp-leadership-sublabel">HOSTEL LEADERSHIP</span>
                <h2 id="hostel-leadership-heading" className="lp-leadership-title">
                  Hostel Leadership
                </h2>
                <div className="lp-leadership-divider" />
              </div>

              <div className="lp-leadership-cards">
                {/* ── 1ST PROFILE: Divine Inspiration & Blessings (First Pic) ── */}
                <div className="lp-leader-card">
                  <div className="lp-leader-photo-wrap">
                    <img
                      src={swamijiImg}
                      alt="His Holiness Dr. Sri Sri Sri Shivakumara Mahaswamiji, Siddaganga Mutt"
                      className="lp-leader-img"
                      style={{ aspectRatio: '1 / 1' }}
                    />
                  </div>

                  <div className="lp-leader-content">
                    <span className="lp-leader-tag">DIVINE BLESSINGS &amp; INSPIRATION</span>
                    <h3 style={{ fontFamily: "'Noto Sans Kannada',serif", fontSize: 'clamp(1.35rem, 2.5vw, 1.85rem)', fontWeight: 800, color: '#fde68a', letterSpacing: '0.01em', lineHeight: 1.35, marginBottom: '6px' }}>
                      ಪರಮಪೂಜ್ಯ ಡಾ. ಶ್ರೀ ಶ್ರೀ ಶ್ರೀ ಶಿವಕುಮಾರ ಮಹಾಸ್ವಾಮೀಜಿಗಳು
                    </h3>
                    <p style={{ fontFamily: "'Cinzel','Georgia',serif", fontSize: 'clamp(1.05rem, 2vw, 1.25rem)', fontWeight: 700, color: '#ffffff', letterSpacing: '0.02em', marginBottom: '8px' }}>
                      Dr. Sri Sri Sri Shivakumara Mahaswamiji
                    </p>
                    <p className="lp-leader-designation">
                      <span className="lp-leader-designation-title">Divine Inspiration</span>
                      <span className="lp-leader-designation-sep"> — </span>
                      <span className="lp-leader-designation-inst">Siddaganga Mutt, Tumakuru</span>
                    </p>
                    <p className="lp-leader-desc">
                      Revered universally as "Trividha Dasohi" (provider of food, education, and shelter) and the "Walking God", His Holiness dedicated his life to selfless service and the empowerment of students. His divine blessings, spiritual wisdom, and ideals of "Kayakave Kailasa" remain the eternal guiding light for our hostel.
                    </p>
                  </div>
                </div>

                {/* ── 2ND PROFILE: Hostel President ── */}
                <div className="lp-leader-card">
                  <div className="lp-leader-photo-wrap">
                    <img
                      src={shadakshariImg}
                      alt="C. S. Shadakshari, President of Veerashiva Lingayath Boys Hostel"
                      className="lp-leader-img"
                    />
                  </div>

                  <div className="lp-leader-content">
                    <span className="lp-leader-tag">HOSTEL LEADERSHIP</span>
                    <h3 style={{ fontFamily: "'Noto Sans Kannada',serif", fontSize: 'clamp(1.35rem, 2.5vw, 1.85rem)', fontWeight: 800, color: '#fde68a', letterSpacing: '0.01em', lineHeight: 1.35, marginBottom: '6px' }}>
                      ಶ್ರೀ ಸಿ. ಎಸ್. ಷಡಕ್ಷರಿ
                    </h3>
                    <p style={{ fontFamily: "'Cinzel','Georgia',serif", fontSize: 'clamp(1.05rem, 2vw, 1.25rem)', fontWeight: 700, color: '#ffffff', letterSpacing: '0.02em', marginBottom: '12px' }}>
                      Sri C. S. Shadakshari
                    </p>

                    <div style={{ marginBottom: '18px' }}>
                      <p style={{ fontSize: 'clamp(0.95rem, 1.8vw, 1.08rem)', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.02em', marginBottom: '6px' }}>
                        Hostel President
                      </p>
                      <p style={{ fontFamily: "'Noto Sans Kannada',serif", fontSize: 'clamp(0.86rem, 1.7vw, 0.98rem)', color: '#cbd5e1', fontWeight: 600, lineHeight: 1.45 }}>
                        ಅಧ್ಯಕ್ಷರು — ಶ್ರೀ ಶಿವಕುಮಾರ ಸ್ವಾಮೀಜಿಗಳ ನೌಕರರ ಸಂಘ, ಶಿವಮೊಗ್ಗ
                      </p>
                    </div>

                    <p className="lp-leader-desc">
                      Sri C. S. Shadakshari serves as the President of the Veerashiva Lingayath Boys Hostel, Shivamogga. Under his guidance, the hostel strives to provide students with a disciplined, supportive and respectful living environment, while encouraging education, community values and personal development.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ══ FEATURE STRIP (After Pics) ══ */}
          <div className="lp-6" style={{
            position: 'relative', zIndex: 1,
            padding: 'clamp(20px,3.5vw,28px) clamp(16px,5vw,60px)',
            borderTop: '1px solid rgba(251,191,36,.12)',
            background: 'rgba(2,8,23,.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          }}>
            <div className="lp-feat-strip" style={{ display: 'flex', gap: 'clamp(8px,2vw,16px)', maxWidth: '1000px', margin: '0 auto', flexWrap: 'nowrap' }}>
              <FeaturePill icon="🎓" label="Student Services"       sub="Academic & Welfare" />
              <FeaturePill icon="🛏" label="Stay Management"        sub="Rooms & Facilities" />
              <FeaturePill icon="👥" label="Community & Discipline" sub="House Rules & Culture" />
              <FeaturePill icon="🛡" label="Safe & Secure"          sub="24/7 Environment" />
            </div>
          </div>

        </main>

        {/* ══ FOOTER ══ */}
        <footer style={{
          position: 'relative', zIndex: 1,
          borderTop: '1px solid rgba(251,191,36,.08)',
          background: 'rgba(2,8,23,.8)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          padding: 'clamp(10px,2vw,14px) clamp(16px,4vw,40px)',
          textAlign: 'center', fontSize: 'clamp(.58rem,1.4vw,.68rem)',
          color: '#475569', letterSpacing: '.03em', fontWeight: 500,
        }}>
          © 2026 Veerashaiva Lingayath Boys Hostel, Shivamogga. All rights reserved.
          &nbsp;•&nbsp;Developed by Nikhilharsha{' '}
          <span style={{ color: '#f43f5e' }}>❤️</span>
        </footer>

      </div>
    </>
  );
};

export default LandingPage;
