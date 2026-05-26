import { centralRequest } from './api';
import { endpoints } from '../config/endpointResolver';

/**
 * Fetch results from the Centralized Database Server.
 *
 * POST /api/results/result/
 * Payload: { roll_number } (optional — omit for teacher to get all results)
 * Response: array of {
 *   id, student, roll_number, question_id, score,
 *   passed_testcases, total_testcases, execution_time, status, submitted_at
 * }
 *
 * Access rules (enforced server-side):
 *  - Teacher: gets all results if no roll_number; filtered if roll_number provided.
 *  - Student: only gets own results; must pass own roll_number.
 */
export const getResults = async (roll_number = null) => {
  const payload = roll_number ? { roll_number } : {};
  const res = await centralRequest.post(endpoints.results(), payload);
  return res.data;
};

/**
 * Convenience wrapper for a student fetching their own results.
 * @param {string} roll_number — the student's roll number (same as username)
 */
export const getMyResults = async (roll_number) => {
  const res = await centralRequest.post(endpoints.results(), { roll_number });
  return res.data;
};
