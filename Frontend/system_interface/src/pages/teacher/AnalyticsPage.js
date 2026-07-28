import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import StatCard from '../../components/common/StatCard';
import { getAllTests } from '../../services/testService';
import { getResults } from '../../services/resultService';
import { averageScorePercent, formatScore } from '../../utils/formatters';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'];

const labelStatus = (status = 'unknown') =>
  status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const groupBy = (items, keyFn) =>
  items.reduce((acc, item) => {
    const key = keyFn(item) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

const toChartData = (grouped) =>
  Object.entries(grouped).map(([name, value]) => ({ name, value }));

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tests, setTests] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedTestId, setSelectedTestId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      const [testsRes, resultRes] = await Promise.allSettled([
        getAllTests(),
        getResults(),
      ]);

      if (testsRes.status === 'fulfilled') {
        setTests(Array.isArray(testsRes.value) ? testsRes.value : []);
      }

      if (resultRes.status === 'fulfilled') {
        setResults(Array.isArray(resultRes.value) ? resultRes.value : []);
      } else {
        addToast('Failed to load analytics data.', 'error');
      }

      setLoading(false);
    };

    fetchAnalytics();
  }, [addToast]);

  const filteredResults = useMemo(() => {
    if (!selectedTestId) return results;
    const test = tests.find(t => String(t.id) === selectedTestId);
    if (!test) return [];
    const testQuestionIds = test.questions?.map(q => String(q.id)) || [];
    return results.filter((result) => testQuestionIds.includes(String(result.question_id)));
  }, [results, selectedTestId, tests]);

  const statusData = useMemo(() => {
    const grouped = groupBy(filteredResults, (result) =>
      labelStatus(result.status || 'unknown')
    );
    return toChartData(grouped);
  }, [filteredResults]);

  const questionData = useMemo(() => {
    const grouped = groupBy(filteredResults, (result) => `#${result.question_id}`);
    return toChartData(grouped);
  }, [filteredResults]);

  const averageScore = useMemo(
    () => averageScorePercent(filteredResults),
    [filteredResults]
  );

  const acceptedCount = filteredResults.filter((result) =>
    ['accepted', 'completed'].includes(result.status?.toLowerCase())
  ).length;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    return (
      <div
        style={{
          background: 'var(--clr-surface)',
          border: '1px solid var(--clr-border)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 13,
        }}
      >
        <strong>{label || payload[0].name}</strong>: {payload[0].value}
      </div>
    );
  };

  return (
    <div className="app-shell">
      <Sidebar role="teacher" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title="Analytics"
          subtitle={`Submission trends for ${user?.username || 'teacher'}`}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          actions={
            <select
              className="form-select"
              value={selectedTestId}
              onChange={(event) => setSelectedTestId(event.target.value)}
              style={{ minWidth: 220 }}
            >
              <option value="">All Tests</option>
              {tests.map((test) => (
                <option key={test.id} value={String(test.id)}>
                  {test.name} {test.is_live ? '(Live)' : ''}
                </option>
              ))}
            </select>
          }
        />

        <div className="page-body">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
              marginBottom: 32,
            }}
          >
            <StatCard
              label="Submissions"
              value={loading ? '-' : filteredResults.length}
              icon="ST"
              color="#6366f1"
            />
            <StatCard
              label="Accepted"
              value={loading ? '-' : acceptedCount}
              icon="OK"
              color="#10b981"
            />
            <StatCard
              label="Acceptance Rate"
              value={
                loading || !filteredResults.length
                  ? '-'
                  : `${Math.round((acceptedCount / filteredResults.length) * 100)}%`
              }
              icon="%"
              color="#06b6d4"
            />
            <StatCard
              label="Average Score"
              value={loading ? '-' : formatScore(averageScore)}
              icon="SC"
              color="#f59e0b"
            />
          </div>

          {loading ? (
            <div className="loading-screen" style={{ minHeight: 300 }}>
              <span className="spinner" />
            </div>
          ) : filteredResults.length === 0 ? (
            <p style={{ color: 'var(--clr-text-3)', fontSize: 14 }}>
              No analytics data available yet.
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 24,
              }}
            >
              <div className="card">
                <h3 style={{ fontWeight: 700, marginBottom: 16 }}>
                  Status Distribution
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      outerRadius={92}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {statusData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <h3 style={{ fontWeight: 700, marginBottom: 16 }}>
                  Submissions by Assignment
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={questionData} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                    <XAxis dataKey="name" stroke="var(--clr-text-3)" tick={{ fontSize: 12 }} />
                    <YAxis stroke="var(--clr-text-3)" tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
