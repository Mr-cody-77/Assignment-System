import React, { useState } from 'react';
import { formatDate, formatDuration, formatScore, formatStatus, getStatusBadgeClass } from '../../utils/formatters';
import styles from './ResultTable.module.css';

const GroupedResultTable = ({ groups, groupBy, showStudent, plagiarismMap = {} }) => {
  const [expandedRow, setExpandedRow] = useState(null);

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  if (!groups || groups.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--clr-text-3)' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>📊</div>
        <p>No results available to display.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: 40 }}></th>
            <th>{groupBy === 'student' ? 'Student Info' : 'Test'}</th>
            <th>Department</th>
            <th>Total Marks</th>
            <th>Questions Attempted</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <React.Fragment key={group.id}>
              {/* Parent Row */}
              <tr 
                onClick={() => toggleRow(group.id)} 
                style={{ cursor: 'pointer', backgroundColor: expandedRow === group.id ? 'rgba(255,255,255,0.03)' : 'transparent' }}
              >
                <td style={{ color: 'var(--clr-text-3)', textAlign: 'center' }}>
                  {expandedRow === group.id ? '▼' : '▶'}
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{group.title}</div>
                  {group.subtitle && <div style={{ fontSize: 12, color: 'var(--clr-text-3)' }}>Roll: {group.subtitle}</div>}
                </td>
                <td style={{ color: 'var(--clr-text-2)' }}>
                  {group.department || 'N/A'}
                </td>
                <td style={{ fontWeight: 600, color: 'var(--clr-primary)' }}>
                  {formatScore(group.marks)} {group.max_marks !== undefined ? `/ ${group.max_marks}` : ''}
                </td>
                <td>
                  {group.questionsDone}
                </td>
              </tr>
              
              {/* Expanded Details Row */}
              {expandedRow === group.id && (
                <tr>
                  <td colSpan={5} style={{ padding: 0, backgroundColor: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ padding: '16px 32px' }}>
                      <table style={{ margin: 0, border: '1px solid var(--clr-border)', borderRadius: 8, overflow: 'hidden' }}>
                        <thead style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                          <tr>
                            <th>Question</th>
                            <th>Score</th>
                            <th>Status</th>
                            <th>Passed/Total</th>
                            <th>Exec Time</th>
                            <th>Submitted At</th>
                            {showStudent && <th>Plagiarism</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {group.results.map(r => (
                            <tr key={r.id}>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>#{r.question_id}</td>
                              <td style={{ fontWeight: 600 }}>{formatScore(r.score)} {r.max_score !== undefined ? `/ ${r.max_score}` : ''}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className={getStatusBadgeClass(r.status)}>
                                    {formatStatus(r.status)}
                                  </span>
                                  {r.is_latest === true && (
                                    <span style={{ fontSize: '10px', background: 'var(--clr-primary)', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>Latest</span>
                                  )}
                                </div>
                              </td>
                              <td style={{ fontSize: 13 }}>{r.passed_testcases ?? '?'}/{r.total_testcases ?? '?'}</td>
                              <td style={{ fontSize: 13 }}>{formatDuration(r.execution_time)}</td>
                              <td style={{ fontSize: 12, color: 'var(--clr-text-3)' }}>{formatDate(r.submitted_at)}</td>
                              {showStudent && (
                                <td>
                                  {(() => {
                                    const flagKey = `${r.roll_number}:${r.question_id}`;
                                    const flag = plagiarismMap[flagKey];
                                    if (!flag) return <span style={{ color: 'var(--clr-text-3)', fontSize: 12 }}>—</span>;
                                    return (
                                      <span
                                        title={`Similarity: ${(flag.similarity_score * 100).toFixed(1)}%`}
                                        style={{
                                          display: 'inline-flex', alignItems: 'center', gap: 4,
                                          background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.5)',
                                          color: '#f59e0b', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                                        }}
                                      >
                                        ⚠️ {flag.copied_from_student_roll ? `w/ ${flag.copied_from_student_roll}` : 'Detected'}
                                      </span>
                                    );
                                  })()}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default GroupedResultTable;
