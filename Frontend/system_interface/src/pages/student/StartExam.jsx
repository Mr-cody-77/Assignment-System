import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getAllTests, startTest } from '../../services/testService';
import styles from './StartExam.module.css';

const StartExam = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [testName, setTestName] = useState('the Test');
  const [testId, setTestId] = useState(null);

  useEffect(() => {
    const fetchTest = async () => {
      try {
        const tests = await getAllTests();
        if (tests && tests.length > 0) {
          setTestName(tests[0].name || tests[0].title || 'the Test');
          setTestId(String(tests[0].id));
        }
      } catch (err) {
        // ignore
      }
    };
    fetchTest();
  }, []);

  const handleStartExam = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await startTest();
      const duration = data.duration_minutes || 60;

      localStorage.setItem('exam_active', 'true');
      localStorage.setItem('exam_duration', duration.toString());
      const endTime = Date.now() + duration * 60 * 1000;
      localStorage.setItem('exam_end_time', endTime.toString());
      localStorage.setItem('exam_test_id', String(data.id));

      navigate('/student/tests');
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to start test. Please contact your teacher.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />

      <div className={styles.card}>
        <div className={styles.iconRing}>📝</div>
        <h1 className={styles.title}>Ready to Begin {testName}?</h1>
        <p className={styles.subtitle}>
          Welcome, <strong>{user?.username || 'Student'}</strong>. Please review the rules below before starting.
        </p>

        <div className={styles.rulesBox}>
          <h3 className={styles.rulesTitle}>⚠️ Test Rules</h3>
          <ul className={styles.rulesList}>
            <li>Internet access will be <strong>disabled</strong> during the test.</li>
            <li>Only the Assignment System will remain accessible.</li>
            <li>Do <strong>not</strong> close or minimize the browser.</li>
            <li>Your timer starts as soon as you click "Start Test".</li>
            <li>Submit your answers before the timer runs out.</li>
            <li>Any attempt to bypass restrictions will be flagged.</li>
          </ul>
        </div>

        {error && (
          <div className={styles.errorBox}>
            <span>❌</span>
            <span>{error}</span>
          </div>
        )}

        <button
          className={styles.startBtn}
          onClick={handleStartExam}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner" />
              <span>Securing Environment...</span>
            </>
          ) : (
            <>
              <span>🚀</span>
              <span>Start Test</span>
            </>
          )}
        </button>

        <p className={styles.note}>
          By clicking Start Test, you agree to the test conditions above.
        </p>
      </div>
    </div>
  );
};

export default StartExam;
