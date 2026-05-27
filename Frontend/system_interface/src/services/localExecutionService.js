import { backendRequest } from './api'; 

const DEFAULT_TIME_LIMIT_MS = 2000;

export const runVisibleTestCases = async ({
  language,
  code,
  testCases = [],
  timeLimitMs = DEFAULT_TIME_LIMIT_MS,
}) => {
  if (!Array.isArray(testCases) || testCases.length === 0) {
    return [];
  }

  try {
    // Calling the new Django endpoint
    const response = await backendRequest.post('/api/local-run/', { // Note: ensure this path matches your Django urls
      language: language?.toLowerCase(),
      code: code,
      time_limit_ms: timeLimitMs,
      test_cases: testCases.map(tc => ({
        input_data: tc.input_data,
        expected_output: tc.expected_output
      }))
    });

    const backendResults = response.data.results;

    // Mapping for TerminalPanel compatibility
    return backendResults.map((res, index) => ({
      test_case_order: index + 1,
      passed: res.passed,
      status: res.status,
      actual: res.actual_output, 
      stdout: res.stdout,
      stderr: res.stderr,
      expected: res.expected_output,
      exec_time_ms: res.exec_time_ms || 0,
    }));

  } catch (error) {
    console.error("Backend Execution Error:", error);
    
    const errorMessage = error.response?.data?.error_message 
      || error.response?.data?.stderr 
      || "Failed to connect to the execution server.";
      
    throw new Error(errorMessage);
  }
};