/**
 * examUtils.js
 *
 * BUG-09 FIX: Centralised exam submission utilities shared by
 * AssignmentDetails.jsx and TestQuestions.jsx.
 *
 * Previously both components had their own separate copies of these
 * functions (addPointsToCases / inline `normalize`) which could diverge
 * and produce different scores for the same question depending on which
 * page the student submitted from.
 */

/**
 * Distribute 100 points evenly across all test cases (visible + hidden).
 * Any existing `points` value on a case is preserved if already set.
 *
 * @param {Array}  cases      - Array of test case objects
 * @param {number} startIndex - Ordering offset (0 for visible, visible.length for hidden)
 * @param {number} totalCases - Total number of all cases (visible + hidden) for score calc
 * @returns {Array} Test cases with `order` and `points` fields populated
 */
export const addPointsToCases = (cases = [], startIndex = 0, totalCases = 1) =>
  cases.map((testCase, index) => ({
    ...testCase,
    order:  startIndex + index + 1,
    points: Number(testCase.points) || Number((100 / totalCases).toFixed(4)),
  }));

/**
 * Build a normalised question payload ready for the task submission API.
 * Populates default limits and distributes points across all test cases.
 *
 * @param {Object} question - Raw question object from the API
 * @returns {Object} Normalised question with scored test cases
 */
export const buildSubmitQuestion = (question) => {
  const visible = Array.isArray(question?.test_cases)        ? question.test_cases        : [];
  const hidden  = Array.isArray(question?.hidden_test_cases) ? question.hidden_test_cases : [];
  const totalCases = Math.max(visible.length + hidden.length, 1);

  return {
    ...question,
    max_score:        question.marks || question.max_score || 100,
    time_limit_ms:    question.time_limit_ms    || 2000,
    memory_limit_mb:  question.memory_limit_mb  || 256,
    test_cases:        addPointsToCases(visible, 0,              totalCases),
    hidden_test_cases: addPointsToCases(hidden,  visible.length, totalCases),
  };
};

/**
 * Clear all exam-related state from localStorage and sessionStorage.
 * Called after the test is formally submitted.
 */
export const clearExamStorage = () => {
  localStorage.removeItem('exam_active');
  localStorage.removeItem('exam_duration');
  localStorage.removeItem('exam_end_time');
  localStorage.removeItem('exam_test_id');

  try {
    Object.keys(sessionStorage).forEach((k) => {
      if (k.startsWith('code_cache_') || k.startsWith('language_cache_')) {
        sessionStorage.removeItem(k);
      }
    });
  } catch {
    // sessionStorage may be unavailable in some browser contexts
  }
};
