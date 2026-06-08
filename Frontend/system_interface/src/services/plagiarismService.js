/**
 * plagiarismService.js
 *
 * Fetch helper functions for the plagiarism detection feature.
 * These are COMPLETELY SEPARATE from resultService.js and do not
 * alter any existing fetch logic.
 *
 * Teacher endpoint returns: [ { id, flagged_student_roll, copied_from_student_roll,
 *                               question_id, similarity_score, detected_at } ]
 * Student endpoint returns: [ { id, flagged_student_roll, question_id,
 *                               similarity_score, detected_at } ]
 *                           (copied_from_student_roll is intentionally omitted
 *                            by the server for students)
 */

import { centralRequest } from './api';
import { endpoints } from '../config/endpointResolver';

/**
 * Fetch all plagiarism flags — teacher view.
 * Includes the roll number of the student copied from.
 *
 * @param {string|null} questionId - optional filter by question ID
 * @returns {Promise<Array>}
 */
export const getTeacherPlagiarismFlags = async (questionId = null) => {
  const url = questionId
    ? `${endpoints.plagiarismTeacher()}?question_id=${questionId}`
    : endpoints.plagiarismTeacher();
  const res = await centralRequest.get(url);
  return Array.isArray(res.data) ? res.data : [];
};

/**
 * Fetch plagiarism flags for the currently logged-in student.
 * The copied_from_student_roll field is deliberately absent from the response.
 *
 * @returns {Promise<Array>}
 */
export const getStudentPlagiarismFlags = async () => {
  const res = await centralRequest.get(endpoints.plagiarismStudent());
  return Array.isArray(res.data) ? res.data : [];
};

/**
 * Build a lookup map from an array of plagiarism flags for quick O(1) access
 * inside ResultTable.
 *
 * Map key format: "<roll_number>:<question_id>"
 * Map value:      the plagiarism flag object (or the first one if duplicates exist)
 *
 * @param {Array}  flags        - array returned by getTeacherPlagiarismFlags or
 *                                getStudentPlagiarismFlags
 * @param {string} rollKey      - field name for the current student's roll number
 *                                ('flagged_student_roll')
 * @returns {Object}
 */
export const buildPlagiarismMap = (flags, rollKey = 'flagged_student_roll') => {
  const map = {};
  for (const flag of flags) {
    const key = `${flag[rollKey]}:${flag.question_id}`;
    if (!map[key]) {
      map[key] = flag;
    }
  }
  return map;
};
