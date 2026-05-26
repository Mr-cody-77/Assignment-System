import React, { useState } from 'react';
import styles from './TerminalPanel.module.css';

const TerminalPanel = ({ testCases = [], results = null, isRunning = false, onClear }) => {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = testCases.length > 0 ? testCases : [];

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>⬛ Terminal</span>
        {onClear && results && (
          <button className="btn btn-ghost btn-sm" onClick={onClear}>
            Clear
          </button>
        )}
      </div>

      {/* Tab bar */}
      {tabs.length > 0 && (
        <div className={styles.tabs}>
          {tabs.map((_, i) => (
            <button
              key={i}
              className={`${styles.tab} ${activeTab === i ? styles.active : ''}`}
              onClick={() => setActiveTab(i)}
            >
              Case {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div className={styles.body}>
        {isRunning ? (
          <div className={styles.placeholder}>
            <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 12px' }} />
            <p>Running test cases…</p>
          </div>
        ) : results === null && tabs.length === 0 ? (
          <div className={styles.placeholder}>
            <span style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>▶</span>
            <p>Click <strong>Run</strong> to test against sample cases</p>
            <p style={{ fontSize: 12 }}>Or <strong>Submit</strong> to evaluate against all test cases</p>
          </div>
        ) : tabs.length > 0 ? (
          (() => {
            const tc = tabs[activeTab];
            const result = results?.[activeTab];
            return (
              <div>
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>Input</div>
                  <pre className={styles.codeBlock}>{tc.input_data || '(empty)'}</pre>
                </div>
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>Expected Output</div>
                  <pre className={styles.codeBlock}>{tc.expected_output || '(empty)'}</pre>
                </div>
                {result && (
                  <>
                    <div className={styles.section}>
                      <div className={styles.sectionLabel}>Your Output</div>
                      <pre className={styles.codeBlock}>{result.actual || result.stdout || '—'}</pre>
                    </div>
                    {result.stderr && (
                      <div className={styles.section}>
                        <div className={styles.sectionLabel}>Error</div>
                        <pre className={styles.codeBlock}>{result.stderr}</pre>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <span className="badge badge-neutral">{result.status || 'unknown'}</span>
                      {result.exec_time_ms !== undefined && (
                        <span style={{ fontSize: 12, color: 'var(--clr-text-3)' }}>
                          {result.exec_time_ms}ms
                        </span>
                      )}
                    </div>
                    <div className={result.passed ? styles.pass : styles.fail}>
                      {result.passed ? '✓ Test Passed' : '✕ Test Failed'}
                    </div>
                  </>
                )}
                {!result && results !== null && (
                  <p style={{ color: 'var(--clr-text-3)', fontSize: 13 }}>
                    Submit your code to see results against hidden test cases.
                  </p>
                )}
              </div>
            );
          })()
        ) : (
          <div className={styles.placeholder}>
            <p>No test cases available for this problem.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TerminalPanel;
