import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import ResultTable from '../../components/ResultTable/ResultTable';
import StatCard from '../../components/common/StatCard';
import SearchBar from '../../components/SearchBar/SearchBar';
import { getResults } from '../../services/resultService';
import { exportToCSV, filterData } from '../../utils/helpers';
import { averageScorePercent, formatScore } from '../../utils/formatters';
import styles from './StudentResults.module.css';

const StudentResults = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchResults = useCallback(async () => {
    try {
      const data = await getResults(); // No roll_number → teacher gets all
      setResults(Array.isArray(data) ? data : []);
    } catch (err) {
      addToast('Failed to load results', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchResults(); }, [fetchResults]);
  useEffect(() => {
    const interval = setInterval(fetchResults, 30000);
    return () => clearInterval(interval);
  }, [fetchResults]);

  const filteredResults = filterData(
    statusFilter ? results.filter((r) => r.status?.toLowerCase() === statusFilter) : results,
    search,
    ['roll_number', 'student', 'question_id', 'status']
  );

  const accepted = results.filter((r) =>
    ['accepted', 'completed'].includes(r.status?.toLowerCase())
  ).length;
  const avgScore = averageScorePercent(results);

  return (
    <div className="app-shell">
      <Sidebar role="teacher" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title="Student Results"
          subtitle="All student submissions"
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          actions={
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => exportToCSV(filteredResults, 'results.csv')}
              disabled={filteredResults.length === 0}
            >
              ⬇ Export CSV
            </button>
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

          <ResultTable results={filteredResults} loading={loading} showStudent />
        </div>
      </div>
    </div>
  );
};

export default StudentResults;
