import { useState, useCallback } from 'react';
import { buildSubmitQuestion, clearExamStorage } from '../utils/examUtils';
import { submitTask, getTaskStatus } from '../services/taskService';
import { submitTest }               from '../services/testService';
import { getMyResults }             from '../services/resultService';
import { updateUserEmail }          from '../services/userService';

/**
 * useExamSubmit
 *
 * BUG-07 FIX: Single canonical exam-submission hook consumed by both
 * AssignmentDetails.jsx (question panel) and TestQuestions.jsx (test list).
 *
 * Previously the two components had completely separate submission pipelines
 * with critical differences:
 *   - Email source: AssignmentDetails read only localStorage; TestQuestions
 *     also prompted the user via modal.
 *   - Roll-number poll filter: AssignmentDetails used only user.username;
 *     TestQuestions used user.roll_number || user.username.
 *   - Post-submit action: AssignmentDetails always navigated away;
 *     TestQuestions showed an inline result screen.
 *   - Result fetch: AssignmentDetails never fetched results at all;
 *     TestQuestions called getMyResults() with a local task-status fallback.
 *
 * This hook provides one pipeline that both components configure via options.
 *
 * @param {Object} options
 * @param {Object}   options.user       - Authenticated user object from AuthContext
 * @param {Function} options.addToast   - Toast notification callback
 * @param {Function} options.onSuccess  - Called with { test, results } after successful submit
 * @returns {{ submitting, emailInput, setEmailInput, showEmailModal, handleExamEnd, confirmExamEnd }}
 */
export function useExamSubmit({ user, addToast, onSuccess }) {
  const [submitting,      setSubmitting]      = useState(false);
  const [showEmailModal,  setShowEmailModal]  = useState(false);
  const [emailInput,      setEmailInput]      = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  /** Open the email-confirmation modal */
  const handleExamEnd = useCallback(() => {
    setShowEmailModal(true);
  }, []);

  /** Execute the full submit pipeline after the user confirms their email */
  const confirmExamEnd = useCallback(async (e, test) => {
    if (e) e.preventDefault();

    if (!emailInput.trim()) {
      addToast('Please enter a valid email address.', 'warning');
      return;
    }

    setEmailSubmitting(true);

    // 1. Persist preferred email
    try {
      await updateUserEmail(emailInput);
    } catch {
      addToast('Failed to save email, but submitting test…', 'warning');
    }

    setEmailSubmitting(false);
    setShowEmailModal(false);

    await _runSubmit(test);
  }, [emailInput, user, addToast, onSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Core submission pipeline — shared by both components.
   * Can also be called directly (e.g. timer expiry auto-submit) by passing
   * `skipEmailStep=true`.
   */
  const _runSubmit = useCallback(async (test, skipEmailStep = false) => {
    if (submitting) return;
    setSubmitting(true);

    const testId = localStorage.getItem('exam_test_id') || (test && test.id);
    const resolvedEmail =
      emailInput ||
      localStorage.getItem('preferred_email') ||
      user?.email ||
      '';

    // Step A: Auto-submit cached code for every question in the test
    if (test && Array.isArray(test.questions) && user) {
      for (const q of test.questions) {
        const cachedCode = sessionStorage.getItem(`code_cache_${q.id}`);
        const cachedLang = sessionStorage.getItem(`language_cache_${q.id}`) || 'python';

        if (cachedCode) {
          // Remove immediately to prevent re-submission if the loop runs again
          sessionStorage.removeItem(`code_cache_${q.id}`);
          try {
            await submitTask({
              // BUG-07 FIX: Use roll_number with username fallback consistently
              roll_number: user.roll_number || user.username,
              question:    buildSubmitQuestion(q),
              language:    cachedLang,
              solution:    cachedCode,
              email:       resolvedEmail,
            });
          } catch (err) {
            console.error(`Failed to auto-submit code for Q${q.id}:`, err);
          }
        }
      }

      // Wait up to 10 s for any pending tasks to complete
      try {
        for (let i = 0; i < 10; i++) {
          const statuses = await getTaskStatus();
          const pending = statuses.filter(
            (t) =>
              // BUG-07 FIX: Check both roll_number and username consistently
              (t.roll_number === user?.roll_number || t.roll_number === user?.username) &&
              ['pending', 'queued', 'running'].includes(t.status?.toLowerCase())
          );
          if (pending.length === 0) break;
          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch (err) {
        console.error('Error polling task status:', err);
      }
    }

    // Step B: Formally submit the test record
    try {
      await submitTest(testId, user?.roll_number || user?.username);
      addToast('Test submitted successfully!', 'success');
    } catch (err) {
      console.error('Failed to submit test:', err);
      // Non-blocking — still proceed to show results
    }

    // Step C: Fetch per-question results
    // BUG-07 FIX: Both components now fetch results (AssignmentDetails
    // previously navigated away without fetching anything).
    let results = [];
    try {
      if (user) {
        results = await getMyResults(user.roll_number || user.username);
        if (!Array.isArray(results)) results = [];
      }
    } catch (err) {
      console.error('Failed to fetch results from Central DB, falling back to local task status:', err);
      try {
        if (user) {
          const statuses = await getTaskStatus();
          results = statuses
            .filter(
              (t) =>
                (t.roll_number === user.roll_number || t.roll_number === user.username) &&
                t.result
            )
            .map((t) => ({
              question_id:       String(t.question_id),
              score:             Number(t.result.score)            || 0,
              passed_testcases:  Number(t.result.passed_testcases) || 0,
              total_testcases:   Number(t.result.total_testcases)  || 0,
              execution_time:    Number(t.result.execution_time)   || 0,
              status:            t.result.status,
              submitted_at:      t.result.submitted_at ||
                new Date(t.updated_at ? t.updated_at * 1000 : Date.now()).toISOString(),
            }));
        }
      } catch (fallbackErr) {
        console.error('Local task status fallback also failed:', fallbackErr);
      }
    }

    // Step D: Clear exam state
    clearExamStorage();
    setSubmitting(false);

    // Step E: Hand results back to the component
    if (typeof onSuccess === 'function') {
      onSuccess({ test, results });
    }
  }, [submitting, emailInput, user, addToast, onSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  /** For timer-expiry auto-submit (no email modal) */
  const handleTimeUp = useCallback((test) => {
    _runSubmit(test, true);
  }, [_runSubmit]);

  return {
    submitting,
    emailInput,
    setEmailInput,
    emailSubmitting,
    showEmailModal,
    setShowEmailModal,
    handleExamEnd,
    confirmExamEnd,
    handleTimeUp,
  };
}

export default useExamSubmit;
