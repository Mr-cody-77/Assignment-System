import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import GroupedResultTable from '../../components/ResultTable/GroupedResultTable';
import StatCard from '../../components/common/StatCard';
import usePolling from '../../hooks/usePolling';
import { getMyResults } from '../../services/resultService';
import { getAllTests, getSubmittedTests } from '../../services/testService';
import { averageScorePercent, formatScore, normalizeScorePercent } from '../../utils/formatters';
// ── PLAGIARISM DETECTION — new isolated imports ───────────────────────────────
import { getStudentPlagiarismFlags, buildPlagiarismMap } from '../../services/plagiarismService';
// ─────────────────────────────────────────────────────────────────────────────

const Results = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [tests, setTests] = useState([]);
  const [submittedTestIds, setSubmittedTestIds] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── PLAGIARISM DETECTION — new isolated state ───────────────────────────────
  const [plagiarismMap, setPlagiarismMap] = useState({});
  // ──────────────────────────────────────────────────────────────────

  const fetchResults = useCallback(async () => {
    if (!user?.username) return;
    try {
      const [data, testsData, submittedData] = await Promise.all([
        getMyResults(user.roll_number || user.username),
        getAllTests(),
        getSubmittedTests()
      ]);
      setResults(Array.isArray(data) ? data : []);
      setTests(Array.isArray(testsData) ? testsData : []);
      setSubmittedTestIds(submittedData?.submitted_test_ids || []);
    } catch {
      // silently fail on polling
    } finally {
      setLoading(false);
    }
  }, [user]);

  usePolling(fetchResults, 15000, true);

  // ── PLAGIARISM DETECTION — separate polling, independent of results poll ─────
  const fetchPlagiarismFlags = useCallback(async () => {
    if (!user?.username) return;
    try {
      const flags = await getStudentPlagiarismFlags();
      setPlagiarismMap(buildPlagiarismMap(flags));
    } catch {
      // Silently ignore — plagiarism UI is non-critical
    }
  }, [user]);

  usePolling(fetchPlagiarismFlags, 60000, true);
  // ─────────────────────────────────────────────────────────────────

  const accepted = results.filter((r) =>
    ['accepted', 'completed'].includes(r.status?.toLowerCase())
  ).length;
  const avgScore = averageScorePercent(results);
  const bestScore = results.length
    ? Math.max(...results.map((r) => normalizeScorePercent(r.score)))
    : 0;

  const groupedResults = useMemo(() => {
    const questionToTest = {};
    const testMaxMarks = {};
    const questionMaxMarks = {};
    
    tests.forEach(test => {
      let testTotal = 0;
      test.questions?.forEach(q => {
        questionToTest[String(q.id)] = test;
        questionMaxMarks[String(q.id)] = q.marks || 10;
        testTotal += q.marks || 10;
      });
      testMaxMarks[String(test.id)] = testTotal;
    });

    const groupsMap = {};
    results.forEach(r => {
      const test = questionToTest[String(r.question_id)];
      const key = test ? String(test.id) : `q_${r.question_id}`;
      if (!groupsMap[key]) {
        groupsMap[key] = {
          id: key,
          title: test ? (test.name || test.title) : `Assignment (Question #${r.question_id})`,
          subtitle: test ? `Test #${test.id}` : '',
          marks: 0,
          max_marks: test ? testMaxMarks[String(test.id)] : undefined,
          latestByQ: {},
          allResults: []
        };
      }

      const qid = String(r.question_id);
      const qMax = questionMaxMarks[qid] || r.max_score || 10;
      const resultWithMax = { ...r, max_score: qMax };

      groupsMap[key].allResults.push(resultWithMax);

      const existingLatest = groupsMap[key].latestByQ[qid];
      if (!existingLatest || r.is_latest || (!existingLatest.is_latest && new Date(r.submitted_at) > new Date(existingLatest.submitted_at))) {
        groupsMap[key].latestByQ[qid] = resultWithMax;
      }
    });

    return Object.values(groupsMap).map(g => {
      const distinctQuestions = Object.values(g.latestByQ);
      const totalMarks = distinctQuestions.reduce((sum, item) => sum + (Number(item.score) || 0), 0);
      return {
        ...g,
        marks: Math.round(totalMarks * 100) / 100,
        questionsDone: distinctQuestions.length,
        results: distinctQuestions.sort((a, b) => Number(a.question_id) - Number(b.question_id))
      };
    }).sort((a, b) => b.marks - a.marks);
  }, [results, tests]);

  return (
    <div className="app-shell">
      <Sidebar role="student" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title="My Results"
          subtitle={`${results.length} submission${results.length !== 1 ? 's' : ''}`}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <div className="page-body">
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
            <StatCard label="Total Submissions" value={results.length} icon="📊" color="#6366f1" />
            <StatCard label="Accepted" value={accepted} icon="✅" color="#10b981" />
            <StatCard label="Average Score" value={formatScore(avgScore)} icon="⭐" color="#f59e0b" />
            <StatCard label="Best Score" value={formatScore(bestScore)} icon="🏆" color="#06b6d4" />
          </div>

          {/* Results table */}
          <GroupedResultTable 
            groups={groupedResults} 
            groupBy="test" 
            showStudent={false} 
            plagiarismMap={plagiarismMap} 
          />
        </div>
      </div>
    </div>
  );
};

export default Results;
