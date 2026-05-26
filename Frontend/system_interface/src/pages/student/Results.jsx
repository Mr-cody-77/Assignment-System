import React, { useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import ResultTable from '../../components/ResultTable/ResultTable';
import StatCard from '../../components/common/StatCard';
import usePolling from '../../hooks/usePolling';
import { getMyResults } from '../../services/resultService';
import { averageScorePercent, formatScore, normalizeScorePercent } from '../../utils/formatters';

const Results = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchResults = useCallback(async () => {
    if (!user?.username) return;
    try {
      const data = await getMyResults(user.username);
      setResults(Array.isArray(data) ? data : []);
    } catch {
      // silently fail on polling
    } finally {
      setLoading(false);
    }
  }, [user]);

  usePolling(fetchResults, 15000, true);

  const accepted = results.filter((r) =>
    ['accepted', 'completed'].includes(r.status?.toLowerCase())
  ).length;
  const avgScore = averageScorePercent(results);
  const bestScore = results.length
    ? Math.max(...results.map((r) => normalizeScorePercent(r.score)))
    : 0;

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
          <ResultTable results={results} loading={loading} showStudent={false} />
        </div>
      </div>
    </div>
  );
};

export default Results;
