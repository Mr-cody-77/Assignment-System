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
        getMyResults(user.username),
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
        questionToTest[q.id] = test;
        questionMaxMarks[q.id] = q.marks || 10;
        testTotal += q.marks || 10;
      });
      testMaxMarks[test.id] = testTotal;
    });

    const groupsMap = {};
    results.forEach(r => {
      const test = questionToTest[r.question_id];
      const key = test ? test.id : 'unassigned';
      if (!groupsMap[key]) {
        groupsMap[key] = {
          id: key,
          title: test ? test.name : 'Unassigned Questions',
          subtitle: '',
          marks: 0,
          max_marks: test ? testMaxMarks[test.id] : undefined,
          questionsDone: new Set(),
          results: []
        };
      }
      groupsMap[key].marks += r.score || 0;
      groupsMap[key].questionsDone.add(r.question_id);
      
      const qMax = questionMaxMarks[r.question_id];
      groupsMap[key].results.push({
        ...r,
        max_score: qMax
      });
    });

    // Filter out groups for tests that haven't been submitted
    return Object.values(groupsMap).map(g => ({
      ...g,
      questionsDone: g.questionsDone.size
    })).filter(g => {
      // Only show groups for submitted tests (or 'unassigned' if needed)
      if (g.id === 'unassigned') return false; // hide unassigned entirely
      return submittedTestIds.includes(g.id);
    }).sort((a, b) => b.marks - a.marks);
  }, [results, tests, submittedTestIds]);

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
