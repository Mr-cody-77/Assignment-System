import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import { createAssignment } from '../../services/assignmentService';
import styles from './AddAssignment.module.css';

const emptyExample = () => ({ input: '', output: '', explanation: '' });
const emptyTestCase = () => ({ input: '', output: '' });

const AddAssignment = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [inputFormat, setInputFormat] = useState('');
  const [outputFormat, setOutputFormat] = useState('');
  const [constraints, setConstraints] = useState('');
  const [examples, setExamples] = useState([emptyExample()]);
  const [testCases, setTestCases] = useState([emptyTestCase()]);
  const [hiddenTestCases, setHiddenTestCases] = useState([emptyTestCase()]);

  // ── Dynamic list helpers ─────────────────────────────────────
  const updateExample = (i, key, val) =>
    setExamples((prev) => prev.map((e, idx) => (idx === i ? { ...e, [key]: val } : e)));
  const addExample = () => setExamples((prev) => [...prev, emptyExample()]);
  const removeExample = (i) => setExamples((prev) => prev.filter((_, idx) => idx !== i));

  const updateTC = (setter) => (i, key, val) =>
    setter((prev) => prev.map((tc, idx) => (idx === i ? { ...tc, [key]: val } : tc)));
  const updateTestCase = updateTC(setTestCases);
  const updateHiddenTC = updateTC(setHiddenTestCases);
  const addTC = (setter) => () => setter((prev) => [...prev, emptyTestCase()]);
  const removeTC = (setter) => (i) => setter((prev) => prev.filter((_, idx) => idx !== i));

  // ── Submit ──────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      addToast('Title and description are required.', 'warning');
      return;
    }
    setLoading(true);
    try {
      await createAssignment({
        title: title.trim(),
        description: description.trim(),
        input_format: inputFormat.trim(),
        output_format: outputFormat.trim(),
        constraints: constraints.trim(),
        examples,
        test_cases: testCases.filter((tc) => tc.input.trim()),
        hidden_test_cases: hiddenTestCases.filter((tc) => tc.input.trim()),
      });
      addToast('Assignment created successfully!', 'success');
      // Reset
      setTitle(''); setDescription(''); setInputFormat(''); setOutputFormat(''); setConstraints('');
      setExamples([emptyExample()]);
      setTestCases([emptyTestCase()]);
      setHiddenTestCases([emptyTestCase()]);
    } catch (err) {
      addToast(err?.response?.data?.message || 'Failed to create assignment.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar role="teacher" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title="Add Assignment"
          subtitle="Create a new coding problem for students"
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          actions={
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPreview((p) => !p)}
            >
              {preview ? '✎ Edit' : '👁️ Preview'}
            </button>
          }
        />
        <div className="page-body">
          {preview ? (
            <div className={styles.previewBox}>
              <h2>{title || '(No title)'}</h2>
              <hr style={{ borderColor: 'var(--clr-border)', margin: '16px 0' }} />
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{description || '(No description)'}</p>
              {inputFormat && (
                <>
                  <h3 style={{ marginTop: 20 }}>Input Format</h3>
                  <p style={{ whiteSpace: 'pre-wrap', color: 'var(--clr-text-2)' }}>{inputFormat}</p>
                </>
              )}
              {outputFormat && (
                <>
                  <h3 style={{ marginTop: 20 }}>Output Format</h3>
                  <p style={{ whiteSpace: 'pre-wrap', color: 'var(--clr-text-2)' }}>{outputFormat}</p>
                </>
              )}
              {constraints && (
                <>
                  <h3 style={{ marginTop: 20 }}>Constraints</h3>
                  <p style={{ whiteSpace: 'pre-wrap', color: 'var(--clr-text-2)' }}>{constraints}</p>
                </>
              )}
              {examples.filter((e) => e.input).length > 0 && (
                <>
                  <h3 style={{ marginTop: 20 }}>Examples</h3>
                  {examples.filter((e) => e.input).map((ex, i) => (
                    <div key={i} className={styles.previewExample}>
                      <div><strong>Input:</strong> <code>{ex.input}</code></div>
                      <div><strong>Output:</strong> <code>{ex.output}</code></div>
                      {ex.explanation && <div><strong>Explanation:</strong> {ex.explanation}</div>}
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Title */}
              <div className={`card ${styles.formSection}`}>
                <h3 className={styles.sectionTitle}>Problem Title *</h3>
                <div className="form-group">
                  <input
                    type="text"
                    className="form-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Two Sum"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div className={`card ${styles.formSection}`}>
                <h3 className={styles.sectionTitle}>Problem Description *</h3>
                <div className="form-group">
                  <textarea
                    className="form-textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the problem clearly…"
                    rows={8}
                    required
                  />
                </div>
              </div>

              {/* Input Format */}
              <div className={`card ${styles.formSection}`}>
                <h3 className={styles.sectionTitle}>Input Format</h3>
                <div className="form-group">
                  <textarea
                    className="form-textarea"
                    value={inputFormat}
                    onChange={(e) => setInputFormat(e.target.value)}
                    placeholder="Describe how the input is supplied (e.g. A single line containing two space-separated integers)…"
                    rows={3}
                  />
                </div>
              </div>

              {/* Output Format */}
              <div className={`card ${styles.formSection}`}>
                <h3 className={styles.sectionTitle}>Output Format</h3>
                <div className="form-group">
                  <textarea
                    className="form-textarea"
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value)}
                    placeholder="Describe how the output should be formatted (e.g. Print a single integer representing the sum)…"
                    rows={3}
                  />
                </div>
              </div>

              {/* Constraints */}
              <div className={`card ${styles.formSection}`}>
                <h3 className={styles.sectionTitle}>Constraints</h3>
                <div className="form-group">
                  <textarea
                    className="form-textarea"
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                    placeholder="e.g. 1 ≤ n ≤ 10^5"
                    rows={3}
                  />
                </div>
              </div>

              {/* Examples */}
              <div className={`card ${styles.formSection}`}>
                <h3 className={styles.sectionTitle}>Examples</h3>
                {examples.map((ex, i) => (
                  <div key={i} className={styles.exampleRow}>
                    <div className={styles.tcGrid3}>
                      <div className="form-group">
                        <label className="form-label">Input</label>
                        <textarea className="form-textarea" rows={2} value={ex.input}
                          onChange={(e) => updateExample(i, 'input', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Output</label>
                        <textarea className="form-textarea" rows={2} value={ex.output}
                          onChange={(e) => updateExample(i, 'output', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Explanation</label>
                        <textarea className="form-textarea" rows={2} value={ex.explanation}
                          onChange={(e) => updateExample(i, 'explanation', e.target.value)} />
                      </div>
                    </div>
                    {examples.length > 1 && (
                      <button type="button" className={`btn btn-danger btn-sm ${styles.removeBtn}`}
                        onClick={() => removeExample(i)}>✕ Remove</button>
                    )}
                  </div>
                ))}
                <button type="button" className={styles.addBtn} onClick={addExample}>
                  + Add Example
                </button>
              </div>

              {/* Visible Test Cases */}
              <div className={`card ${styles.formSection}`}>
                <h3 className={styles.sectionTitle}>Visible Test Cases</h3>
                <p className={styles.noteText}>Shown to students in the terminal panel.</p>
                {testCases.map((tc, i) => (
                  <div key={i} className={styles.tcRow}>
                    <div className={styles.tcGrid2}>
                      <div className="form-group">
                        <label className="form-label">Input</label>
                        <textarea className="form-textarea" rows={2} value={tc.input}
                          onChange={(e) => updateTestCase(i, 'input', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Expected Output</label>
                        <textarea className="form-textarea" rows={2} value={tc.output}
                          onChange={(e) => updateTestCase(i, 'output', e.target.value)} />
                      </div>
                    </div>
                    {testCases.length > 1 && (
                      <button type="button" className={`btn btn-danger btn-sm ${styles.removeBtn}`}
                        onClick={() => removeTC(setTestCases)(i)}>✕</button>
                    )}
                  </div>
                ))}
                <button type="button" className={styles.addBtn} onClick={addTC(setTestCases)}>
                  + Add Test Case
                </button>
              </div>

              {/* Hidden Test Cases */}
              <div className={`card ${styles.formSection}`}>
                <h3 className={styles.sectionTitle}>Hidden Test Cases</h3>
                <div className={styles.warningNote}>
                  ⚠️ These test cases are <strong>never shown to students</strong>. They are used for final evaluation.
                </div>
                {hiddenTestCases.map((tc, i) => (
                  <div key={i} className={styles.tcRow}>
                    <div className={styles.tcGrid2}>
                      <div className="form-group">
                        <label className="form-label">Input</label>
                        <textarea className="form-textarea" rows={2} value={tc.input}
                          onChange={(e) => updateHiddenTC(i, 'input', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Expected Output</label>
                        <textarea className="form-textarea" rows={2} value={tc.output}
                          onChange={(e) => updateHiddenTC(i, 'output', e.target.value)} />
                      </div>
                    </div>
                    {hiddenTestCases.length > 1 && (
                      <button type="button" className={`btn btn-danger btn-sm ${styles.removeBtn}`}
                        onClick={() => removeTC(setHiddenTestCases)(i)}>✕</button>
                    )}
                  </div>
                ))}
                <button type="button" className={styles.addBtn} onClick={addTC(setHiddenTestCases)}>
                  + Add Hidden Test Case
                </button>
              </div>

              {/* Submit */}
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={loading}
                  style={{ minWidth: 180 }}
                >
                  {loading ? (
                    <><span className="spinner" style={{ width: 16, height: 16 }} /> Creating…</>
                  ) : '✓ Create Assignment'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddAssignment;
