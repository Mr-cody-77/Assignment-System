import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Landing.module.css';
import { centralRequest } from '../../services/api';

const Landing = () => {
  const navigate = useNavigate();

  const handleExit = async () => {
    if (window.confirm("Are you sure you want to shut down the Assignment System? This will stop all background servers.")) {
      try {
        await centralRequest.post('/api/stop_system/');
        alert("System is shutting down. You can now close this window.");
      } catch (err) {
        alert("System is shutting down or has already been stopped.");
      }
    }
  };

  return (
    <div style={{ background: 'var(--clr-bg)', minHeight: '100vh' }}>
      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className={styles.navbar}>
        <div className={styles.navLogo}>
          <div className={styles.navLogoIcon}>⚡</div>
          <span className={styles.navLogoText}>CodeMesh</span>
        </div>
        <div className={styles.navActions}>
          <button className="btn btn-error btn-sm" onClick={handleExit} style={{ backgroundColor: 'var(--clr-danger)', color: 'white' }}>
            Exit System
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/nodes')}>
            Nodes
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')}>
            Sign In →
          </button>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className={styles.hero}>
        {/* Animated background blobs */}
        <div className={styles.heroBg} aria-hidden>
          <div className={`${styles.blob} ${styles.blob1}`} />
          <div className={`${styles.blob} ${styles.blob2}`} />
          <div className={`${styles.blob} ${styles.blob3}`} />
        </div>
        {/* Grid overlay */}
        <div className={styles.gridOverlay} aria-hidden />

        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>✨ Distributed Code Evaluation Platform</div>
          <h1 className={styles.heroTitle}>
            Welcome to<br />
            <span className={styles.gradientText}>CodeMesh</span>
          </h1>
          <p className={styles.heroSubtitle}>
            A distributed, real-time code evaluation platform built for modern
            education. Submit code, track execution, and get results instantly.
          </p>
          <div className={styles.heroActions}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')}>
              Get Started
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => navigate('/nodes')}>
              View Connected Nodes
            </button>
          </div>

          <div className={styles.statsRow}>
            <div className={styles.statItem}>⚡ <strong>4+</strong> Languages</div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>🔄 <strong>Real-time</strong> Evaluation</div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>🖥️ <strong>Distributed</strong> Nodes</div>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>Powerful Features for Modern Education</h2>
        <p className={styles.sectionSubtitle}>
          Everything you need to run a distributed code evaluation system
        </p>
        <div className={styles.featuresGrid}>
          {[
            {
              icon: '⚡',
              title: 'Distributed Evaluation',
              desc: 'Submit code and have it evaluated across multiple computing nodes for fast, parallel processing.',
              color: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            },
            {
              icon: '🖥️',
              title: 'Node Monitoring',
              desc: 'Real-time visibility into connected computing nodes — load, CPU, memory, and worker status at a glance.',
              color: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
            },
            {
              icon: '⏱️',
              title: 'Real-Time Processing',
              desc: 'Track submission status in real time — from queued to running to completed — with live updates.',
              color: 'linear-gradient(135deg, #10b981, #06b6d4)',
            },
          ].map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <div
                className={styles.featureIcon}
                style={{ background: f.color }}
              >
                {f.icon}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--clr-text-2)', lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────── */}
      <section className={styles.howItWorks}>
        <h2 className={styles.sectionTitle}>How It Works</h2>
        <p className={styles.sectionSubtitle}>Three simple steps to evaluate code at scale</p>
        <div className={styles.stepsRow}>
          {[
            { n: '1', title: 'Submit Code', desc: 'Students select a problem, write their solution, and submit to the system.' },
            { n: '2', title: 'Distribute Tasks', desc: 'The backend distributes the task across available computing nodes for parallel execution.' },
            { n: '3', title: 'Get Results', desc: 'Results are returned in real time with detailed feedback on test cases.' },
          ].map((s, i) => (
            <React.Fragment key={s.n}>
              <div className={styles.step}>
                <div className={styles.stepNumber}>{s.n}</div>
                <h3 style={{ fontWeight: 700, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--clr-text-2)', lineHeight: 1.6 }}>{s.desc}</p>
              </div>
              {i < 2 && <div className={styles.stepArrow}>→</div>}
            </React.Fragment>
          ))}
        </div>
      </section>

        {/* =========================================================================
          Footer 
        ========================================================================= */}
        <footer className={styles.footer}>
          &copy; personal project 2026 CodeMesh
        </footer>
      </div>
  );
};

export default Landing;
