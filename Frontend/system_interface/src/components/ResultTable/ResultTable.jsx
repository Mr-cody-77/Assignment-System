import React, { useState, useMemo } from 'react';
import Pagination from '../Pagination/Pagination';
import SearchBar from '../SearchBar/SearchBar';
import EmptyState from '../common/EmptyState';
import { SkeletonCard } from '../Loader/SkeletonLoader';
import {
  formatDate,
  formatDuration,
  formatScore,
  formatStatus,
  getStatusBadgeClass,
  normalizeScorePercent,
} from '../../utils/formatters';
import { filterData, sortData, paginateData, exportToCSV } from '../../utils/helpers';
import styles from './ResultTable.module.css';

const PAGE_SIZE = 15;

const ResultTable = ({ results = [], loading = false, showStudent = false, plagiarismMap = {} }) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('submitted_at');
  const [sortDir, setSortDir] = useState('desc');

  const searchKeys = showStudent
    ? ['student', 'roll_number', 'question_id', 'status']
    : ['roll_number', 'question_id', 'status'];

  const handleSort = (key) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = useMemo(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () => filterData(results, search, searchKeys),
    [results, search] // searchKeys changes every render, intentional stable ref by prop
  );
  const sorted = useMemo(() => sortData(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);
  const { items, totalPages, totalItems } = paginateData(sorted, page, PAGE_SIZE);

  const SortBtn = ({ col }) => (
    <span onClick={() => handleSort(col)} style={{ cursor: 'pointer' }}>
      {sortKey === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
    </span>
  );

  const scoreClass = (score) => {
    const v = normalizeScorePercent(score);
    return v >= 80 ? styles.scoreHigh : v >= 50 ? styles.scoreMid : styles.scoreLow;
  };

  if (loading && results.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div>
      <div className={styles.controls}>
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search by roll number, question, status…"
        />
        <button
          className={`btn btn-secondary btn-sm ${styles.exportBtn}`}
          onClick={() => exportToCSV(filtered, 'results.csv')}
          disabled={filtered.length === 0}
        >
          ⬇ Export CSV
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No results found"
          description={search ? 'No results match your search query.' : 'No submissions yet.'}
        />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  {showStudent ? (
                    <th onClick={() => handleSort('student')} style={{ cursor: 'pointer' }}>
                      Student <SortBtn col="student" />
                    </th>
                  ) : (
                    <th onClick={() => handleSort('roll_number')} style={{ cursor: 'pointer' }}>
                      Roll Number <SortBtn col="roll_number" />
                    </th>
                  )}
                  <th onClick={() => handleSort('question_id')} style={{ cursor: 'pointer' }}>
                    Question <SortBtn col="question_id" />
                  </th>
                  <th onClick={() => handleSort('score')} style={{ cursor: 'pointer' }}>
                    Score <SortBtn col="score" />
                  </th>
                  <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>
                    Status <SortBtn col="status" />
                  </th>
                  <th>Passed / Total</th>
                  <th onClick={() => handleSort('execution_time')} style={{ cursor: 'pointer' }}>
                    Exec Time <SortBtn col="execution_time" />
                  </th>
                  <th onClick={() => handleSort('submitted_at')} style={{ cursor: 'pointer' }}>
                    Submitted <SortBtn col="submitted_at" />
                  </th>
                  {/* Plagiarism column — new, isolated */}
                  <th>Plagiarism</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={r.id}>
                    <td style={{ color: 'var(--clr-text-3)', fontSize: 12 }}>
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {showStudent ? r.student || r.roll_number : r.roll_number}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      #{r.question_id}
                    </td>
                    <td className={scoreClass(r.score)}>{formatScore(r.score)}</td>
                    <td>
                      <span className={getStatusBadgeClass(r.status)}>
                        {formatStatus(r.status)}
                      </span>
                    </td>
                    <td>
                      {r.passed_testcases ?? '?'}/{r.total_testcases ?? '?'}
                    </td>
                    <td>{formatDuration(r.execution_time)}</td>
                    <td style={{ fontSize: 12, color: 'var(--clr-text-2)' }}>
                      {formatDate(r.submitted_at)}
                    </td>
                    {/* Plagiarism cell — new, isolated */}
                    <td>
                      {(() => {
                        const rollForKey = showStudent
                          ? (r.roll_number)
                          : (r.roll_number);
                        const flagKey = `${rollForKey}:${r.question_id}`;
                        const flag = plagiarismMap[flagKey];
                        if (!flag) return <span style={{ color: 'var(--clr-text-3)', fontSize: 12 }}>—</span>;
                        return (
                          <span
                            title={`Similarity: ${(flag.similarity_score * 100).toFixed(1)}%`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: 'rgba(251,191,36,0.15)',
                              border: '1px solid rgba(251,191,36,0.5)',
                              color: '#f59e0b',
                              borderRadius: 6,
                              padding: '2px 8px',
                              fontSize: 11,
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ⚠️
                            {showStudent && flag.copied_from_student_roll
                              ? ` Plagiarism detected with ${flag.copied_from_student_roll}`
                              : ' Plagiarism detected'}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
};

export default ResultTable;
