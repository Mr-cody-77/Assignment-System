import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getAllTests, startTest, getSubmittedTests } from '../../services/testService';
import styles from './StartExam.module.css';

const StartExam = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialChecking, setInitialChecking] = useState(true);
  const [error, setError] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [testName, setTestName] = useState('the Test');
  const [testId, setTestId] = useState(null);

  useEffect(() => {
    const fetchTestAndCheckPermission = async () => {
      try {
        const [testsRes, subRes] = await Promise.allSettled([
          getAllTests(),
          getSubmittedTests(),
        ]);

        const tests = testsRes.status === 'fulfilled' && Array.isArray(testsRes.value) ? testsRes.value : [];
        const currentTest = tests.find(t => t.is_live);
        if (currentTest) {
          setTestName(currentTest.name || currentTest.title || 'the Test');
          const tid = String(currentTest.id);
          setTestId(tid);

          const subData = subRes.status === 'fulfilled' ? subRes.value : {};
          const submitted = (subData.submitted_test_ids || []).map(String);
          const attempted = (subData.attempted_test_ids || []).map(String);

          if (submitted.includes(tid) || attempted.includes(tid)) {
            setIsBlocked(true);
            setError('You have already attempted or submitted this test. Re-attempts are not allowed without teacher permission from the dashboard.');
          }
        } else {
          setError('No active test is currently available.');
        }
      } catch (err) {
        console.error('Failed to check test status', err);
      } finally {
        setInitialChecking(false);
      }
    };
    fetchTestAndCheckPermission();
  }, []);

  const handleStartExam = async () => {
    if (isBlocked) return;
    setLoading(true);
    setError(null);

    try {
      const data = await startTest();
      const duration = data.duration_minutes || 60;

      localStorage.setItem('exam_active', 'true');
      localStorage.setItem('exam_duration', duration.toString());
      localStorage.setItem('exam_test_id', String(data.id));

      // SECURE OFFLINE CACHE: Tell the local Assignment Node to aggressively pre-fetch 
      // and cache the hidden test cases for these questions in case the network drops.
      if (data.questions && data.questions.length > 0) {
        const questionIds = data.questions.map(q => q.id);
        const token = localStorage.getItem('access_token') || localStorage.getItem('legacy_token');
        fetch('/api/cache-questions/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({ question_ids: questionIds })
        }).catch(err => console.log('Offline cache pre-fetch failed', err));
      }

      navigate('/student/tests');
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to start test. Please contact your teacher.';
      setError(msg);
      if (err?.response?.status === 403) {
        setIsBlocked(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />

      <div className={styles.card}>
        <div className={styles.iconRing}>{isBlocked ? '🔒' : '📝'}</div>
        <h1 className={styles.title}>
          {isBlocked ? 'Access Restricted' : `Ready to Begin ${testName}?`}
        </h1>
        <p className={styles.subtitle}>
          Welcome, <strong>{user?.username || 'Student'}</strong>. {isBlocked ? 'You have already attempted or completed this test.' : 'Please review the rules below before starting.'}
        </p>

        {isBlocked ? (
          <div className={styles.errorBox} style={{ margin: '20px 0', padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px' }}>
            <span style={{ fontSize: 20 }}>🚫</span>
            <span style={{ fontWeight: 500, lineHeight: 1.5 }}>
              {error || 'You have already attempted or submitted this test. You cannot re-enter without explicit permission granted by your teacher from the teacher dashboard.'}
            </span>
          </div>
        ) : (
          <div className={styles.rulesBox}>
            <h3 className={styles.rulesTitle}>⚠️ Test Rules</h3>
            <ul className={styles.rulesList}>
              <li>Internet access will be <strong>disabled</strong> during the test.</li>
              <li>Only CodeMesh will remain accessible.</li>
              <li>Do <strong>not</strong> close or minimize the browser.</li>
              <li>Your timer starts as soon as you click "Start Test".</li>
              <li>Submit your answers before the timer runs out.</li>
              <li>Any attempt to bypass restrictions will be flagged.</li>
            </ul>
          </div>
        )}

        {error && !isBlocked && (
          <div className={styles.errorBox}>
            <span>❌</span>
            <span>{error}</span>
          </div>
        )}

        {isBlocked ? (
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/student')}
            style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 700, marginTop: 8 }}
          >
            🏠 Back to Dashboard
          </button>
        ) : (
          <button
            className={styles.startBtn}
            onClick={handleStartExam}
            disabled={loading || initialChecking}
          >
            {loading ? (
              <>
                <span className="spinner" />
                <span>Securing Environment...</span>
              </>
            ) : initialChecking ? (
              <span>Checking Permission...</span>
            ) : (
              <>
                <span>⚡</span>
                <span>Start Test</span>
              </>
            )}
          </button>
        )}

        <p className={styles.note}>
          {isBlocked 
            ? 'Contact your course instructor or teacher if you need re-attempt permission.'
            : 'By clicking Start Test, you agree to the test conditions above.'}
        </p>
      </div>
    </div>
  );
};

export default StartExam;
