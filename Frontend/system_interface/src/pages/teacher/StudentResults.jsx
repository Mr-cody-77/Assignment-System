import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import GroupedResultTable from '../../components/ResultTable/GroupedResultTable';
import StatCard from '../../components/common/StatCard';
import SearchBar from '../../components/SearchBar/SearchBar';
import { getResults, exportResultsExcel } from '../../services/resultService';
import { getAllTests, getSubmittedTests } from '../../services/testService';
import { exportToCSV, filterData } from '../../utils/helpers';
import { averageScorePercent, formatScore } from '../../utils/formatters';
import styles from './StudentResults.module.css';
// ── PLAGIARISM DETECTION — new isolated imports ───────────────────────────────
import { getTeacherPlagiarismFlags, buildPlagiarismMap } from '../../services/plagiarismService';
// ─────────────────────────────────────────────────────────────────────────────

const StudentResults = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tests, setTests] = useState([]);
  const [selectedTestId, setSelectedTestId] = useState('');
  const [testSubmissions, setTestSubmissions] = useState([]);

  // ── PLAGIARISM DETECTION — new isolated state (does not touch existing state) ──
  const [plagiarismMap, setPlagiarismMap] = useState({});
  // ─────────────────────────────────────────────────────────────────

  const fetchResults = useCallback(async () => {
    try {
      const [data, testsData, submissionsData] = await Promise.all([
        getResults(),
        getAllTests(),
        getSubmittedTests()
      ]);
      setResults(Array.isArray(data) ? data : []);
      setTests(Array.isArray(testsData) ? testsData : []);
      setTestSubmissions(submissionsData?.submissions || []);
    } catch (err) {
      addToast('Failed to load results or tests', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchResults(); }, [fetchResults]);
  useEffect(() => {
    const interval = setInterval(fetchResults, 30000);
    return () => clearInterval(interval);
  }, [fetchResults]);

  // ── PLAGIARISM DETECTION — separate fetch, independent of results fetch ────────
  const fetchPlagiarismFlags = useCallback(async () => {
    try {
      const flags = await getTeacherPlagiarismFlags();
      setPlagiarismMap(buildPlagiarismMap(flags));
    } catch {
      // Silently ignore — plagiarism UI is non-critical
    }
  }, []);

  useEffect(() => { fetchPlagiarismFlags(); }, [fetchPlagiarismFlags]);
  useEffect(() => {
    const interval = setInterval(fetchPlagiarismFlags, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, [fetchPlagiarismFlags]);
  // ─────────────────────────────────────────────────────────────────

  // Filter results by selected test (if any)
  const testFilteredResults = useMemo(() => {
    if (!selectedTestId) return results;
    const test = tests.find(t => String(t.id) === selectedTestId);
    if (!test) return results;
    const testQuestionIds = new Set(test.questions?.map(q => String(q.id)) || []);
    return results.filter(r => testQuestionIds.has(String(r.question_id)));
  }, [results, tests, selectedTestId]);

  const filteredResults = filterData(
    statusFilter ? testFilteredResults.filter((r) => r.status?.toLowerCase() === statusFilter) : testFilteredResults,
    search,
    ['roll_number', 'student', 'student_name', 'question_id', 'status']
  );

  const accepted = results.filter((r) =>
    ['accepted', 'completed'].includes(r.status?.toLowerCase())
  ).length;
  const avgScore = averageScorePercent(results);

  const groupedResults = useMemo(() => {
    const questionMaxMarks = {};
    let totalTestMarks = 0;
    
    if (selectedTestId) {
      const selectedTest = tests.find(t => String(t.id) === selectedTestId);
      if (selectedTest) {
        selectedTest.questions?.forEach(q => {
          questionMaxMarks[String(q.id)] = q.marks || 10;
          totalTestMarks += q.marks || 10;
        });
      }
    } else {
      tests.forEach(test => {
        test.questions?.forEach(q => {
          questionMaxMarks[String(q.id)] = q.marks || 10;
        });
      });
    }

    const groupsMap = {};
    filteredResults.forEach(r => {
      const key = r.roll_number || r.student;
      if (!groupsMap[key]) {
        groupsMap[key] = {
          id: key,
          title: r.student_name || r.student || r.roll_number,
          subtitle: (r.student_name || r.student) ? r.roll_number : '',
          department: r.student_department || 'N/A',
          marks: 0,
          max_marks: selectedTestId ? totalTestMarks : undefined,
          questionsDone: new Set(),
          results: []
        };
      }
      if (r.is_latest === undefined || r.is_latest) {
        groupsMap[key].marks += r.score || 0;
      }
      groupsMap[key].questionsDone.add(String(r.question_id));
      
      const qMax = questionMaxMarks[String(r.question_id)] || r.max_score || 10;
      groupsMap[key].results.push({
        ...r,
        max_score: qMax
      });
    });

    return Object.values(groupsMap).map(g => ({
      ...g,
      questionsDone: g.questionsDone.size
    })).sort((a, b) => b.marks - a.marks);
  }, [filteredResults, selectedTestId, tests]);

  return (
    <div className="app-shell">
      <Sidebar role="teacher" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title="Student Results"
          subtitle="All student submissions"
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => exportToCSV(filteredResults, 'results.csv')}
                disabled={filteredResults.length === 0}
              >
                ⬇ Export CSV
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => exportResultsExcel(selectedTestId)}
                disabled={filteredResults.length === 0 || !selectedTestId}
                title={!selectedTestId ? 'Select a test to export Excel' : ''}
              >
                ⬇ Export Excel
              </button>
            </div>
          }
        />
        <div className="page-body">
          {/* Summary stats */}
          <div className={styles.summaryGrid}>
            <StatCard label="Total Submissions" value={results.length} icon="📊" color="#6366f1" />
            <StatCard label="Accepted" value={accepted} icon="✅" color="#10b981" />
            <StatCard label="Acceptance Rate" value={results.length ? `${((accepted / results.length) * 100).toFixed(0)}%` : '—'} icon="🎯" color="#06b6d4" />
            <StatCard label="Avg Score" value={formatScore(avgScore)} icon="⭐" color="#f59e0b" />
          </div>

          {/* Filter bar */}
          <div className={styles.filterBar}>
            <select
              className={`form-select ${styles.filterSelect}`}
              value={selectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
              style={{ minWidth: 200 }}
            >
              <option value="">All Tests</option>
              {tests.map(test => (
                <option key={test.id} value={String(test.id)}>
                  {test.name} {test.is_live ? '(Live)' : ''}
                </option>
              ))}
            </select>

            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by roll number, question, status…"
            />
            <select
              className={`form-select ${styles.filterSelect}`}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="accepted">Accepted</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="wrong_answer">Wrong Answer</option>
              <option value="pending">Pending</option>
              <option value="running">Running</option>
            </select>
          </div>

          <GroupedResultTable 
            groups={groupedResults} 
            groupBy="student" 
            showStudent={true} 
            plagiarismMap={plagiarismMap} 
          />
        </div>
      </div>
    </div>
  );
};

export default StudentResults;
