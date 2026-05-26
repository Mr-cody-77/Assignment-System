// src/utils/localJudge.js

export const runLocalCode = (code, language, testCases) => {
  return new Promise((resolve) => {
    // 1. Create the Web Worker script as a string
    const workerScript = `
      self.onmessage = async (e) => {
        const { code, language, testCases } = e.data;
        let results = [];

        if (language.toLowerCase() === 'python') {
          // Load Python environment in the background
          importScripts('https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js');
          const pyodide = await loadPyodide();

          for (let i = 0; i < testCases.length; i++) {
            const tc = testCases[i];
            
            // Safely inject the test case inputs so Python's input() function works
            const inputArr = JSON.stringify(tc.input_data.split('\\n'));

            const setupCode = \`
import sys
from io import StringIO
sys.stdout = StringIO()
_inputs = \${inputArr}
def _mock_input():
    return _inputs.pop(0) if _inputs else ""
__builtins__.input = _mock_input
\`;
            try {
              // Run setup and the student's code
              pyodide.runPython(setupCode);
              pyodide.runPython(code);
              
              // Capture output
              const stdout = pyodide.runPython("sys.stdout.getvalue()").trim();
              const expected = tc.expected_output.trim();

              results.push({
                testCase: i + 1,
                status: stdout === expected ? 'Passed' : 'Wrong Answer',
                output: stdout,
                expected: expected
              });
            } catch (err) {
              results.push({ 
                testCase: i + 1, 
                status: 'Syntax/Runtime Error', 
                output: err.message 
              });
            }
          }
          postMessage({ status: 'success', results });

        } else {
          // Fallback if they try to run C++ or Java locally
          postMessage({ 
            status: 'error', 
            message: 'Local Run currently supports Python. Please use Submit for other languages.' 
          });
        }
      };
    `;

    // 2. Spin up the background worker
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    // 3. Enforce a 5-Second Time Limit (TLE)
    const timeout = setTimeout(() => {
      worker.terminate();
      resolve({ status: 'Time Limit Exceeded', results: [] });
    }, 5000); 

    // 4. Listen for the results
    worker.onmessage = (e) => {
      clearTimeout(timeout);
      worker.terminate();
      resolve(e.data);
    };

    // 5. Start execution
    worker.postMessage({ code, language, testCases });
  });
};