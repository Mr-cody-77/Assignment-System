import os
import sys
import shutil
import subprocess
import tempfile
import time
import logging

logger = logging.getLogger(__name__)

# Reusing your language config
LANG_CONFIG = {
    'python': {
        'extension': '.py',
        'compile': None,
        'run': [sys.executable, '{file}'],
    },
    'cpp': {
        'extension': '.cpp',
        'compile': ['g++', '-O2', '-std=c++17', '-o', '{binary}', '{file}', '-lm'],
        'run': ['{binary}'],
    },
    'java': {
        'extension': '.java',
        'compile': ['javac', '{file}'],
        'run': ['java', '-cp', '{dir}', 'Main'],
    },
    'javascript': {
        'extension': '.js',
        'compile': None,
        'run': ['node', '{file}'],
    },
    'c': {
        'extension': '.c',
        'compile': ['gcc', '-O2', '-o', '{binary}', '{file}', '-lm'],
        'run': ['{binary}'],
    },
}

DEFAULT_TIME_LIMIT_MS = 2000
COMPILE_TIMEOUT = 10

def _render(parts, file, binary, directory):
    return [
        p.replace('{file}', file)
         .replace('{binary}', binary)
         .replace('{dir}', directory)
        for p in parts
    ]

def _prepare_source(language: str, code: str, directory: str) -> str:
    config = LANG_CONFIG[language]
    
    # --- LEETCODE MAGIC: Auto-call functions and print return values ---
    if language == 'python' and 'def solution' in code:
        # Secretly append a caller to the bottom of the user's Python code
        auto_caller = """

if __name__ == '__main__':
    # Automatically call the user's function
    res = solution()
    # If the user used 'return' instead of 'print', print it for them
    if res is not None:
        print(res)
"""
        # Prevent running twice if the user manually wrote solution()
        if not code.strip().endswith("solution()"):
            code += auto_caller

    elif language == 'javascript' and 'function solution' in code:
        # Secretly append a caller to the bottom of the user's JS code
        auto_caller = "\n\nconst __res = solution();\nif (__res !== undefined) { console.log(__res); }\n"
        if "solution();" not in code:
            code += auto_caller
    # -------------------------------------------------------------------

    # Save the file
    if language == 'java':
        code = code.replace('public class Solution', 'public class Main')
        path = os.path.join(directory, 'Main.java')
    else:
        path = os.path.join(directory, f'solution{config["extension"]}')
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
        
    return path

def run_local_code(language: str, code: str, input_data: str, time_limit_ms: int) -> dict:
    """
    Compiles and runs a single test case. 
    Returns stdout, stderr, and status.
    """
    config = LANG_CONFIG.get(language)
    if not config:
        return {'status': 'unsupported_language', 'stderr': f'Unsupported: {language}', 'stdout': ''}

    timeout_s = min(max(time_limit_ms / 1000, 0.5), 10) # Max 10 seconds for local run
    tmpdir = tempfile.mkdtemp(prefix='local_exec_')

    try:
        source = _prepare_source(language, code, tmpdir)
        binary = os.path.join(tmpdir, 'solution' + ('.exe' if sys.platform == 'win32' else ''))

        # -- Compilation Phase --
        if config['compile']:
            cmd = _render(config['compile'], source, binary, tmpdir)
            try:
                comp_res = subprocess.run(
                    cmd, capture_output=True, text=True,
                    timeout=COMPILE_TIMEOUT, cwd=tmpdir
                )
                if comp_res.returncode != 0:
                    return {
                        'status': 'compilation_error',
                        'stderr': comp_res.stderr or comp_res.stdout,
                        'stdout': ''
                    }
            except subprocess.TimeoutExpired:
                return {'status': 'compilation_error', 'stderr': 'Compilation timed out.', 'stdout': ''}
            except FileNotFoundError:
                return {'status': 'compilation_error', 'stderr': f'Compiler not found for {language}.', 'stdout': ''}

        # -- Execution Phase --
        cmd = _render(config['run'], source, binary, tmpdir)
        try:
            proc = subprocess.Popen(
                cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                stderr=subprocess.PIPE, cwd=tmpdir, text=True
            )
            try:
                stdout, stderr = proc.communicate(input=str(input_data), timeout=timeout_s)
                exit_code = proc.returncode
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.communicate()
                return {'status': 'time_limit_exceeded', 'stderr': 'Time Limit Exceeded (TLE).', 'stdout': ''}

        except FileNotFoundError:
            return {'status': 'runtime_error', 'stderr': f'Runtime not found for {language}.', 'stdout': ''}

        if exit_code != 0:
            return {'status': 'runtime_error', 'stderr': stderr.strip() or stdout.strip(), 'stdout': ''}

        return {
            'status': 'success',
            'stdout': stdout.strip(),
            'stderr': stderr.strip()
        }

    except Exception as e:
        logger.exception(f'Local Execution error: {e}')
        return {'status': 'runtime_error', 'stderr': str(e), 'stdout': ''}
    
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

def execute_code_locally(payload: dict) -> dict:
    """
    Main entry point for LocalRunView. Iterates through visible test cases.
    """
    language = payload.get('language', 'python')
    code = payload.get('code', '')
    test_cases = payload.get('test_cases', [])
    time_limit_ms = int(payload.get('time_limit_ms', DEFAULT_TIME_LIMIT_MS))

    results = []
    passed_count = 0

    for i, case in enumerate(test_cases):
        input_data = str(case.get('input_data', ''))
        expected = str(case.get('expected_output', '')).strip()
        
        # Run the code
        exec_result = run_local_code(language, code, input_data, time_limit_ms)
        actual = exec_result['stdout'].strip()

        # Determine if test passed
        passed = (exec_result['status'] == 'success' and actual == expected)
        
        case_status = exec_result['status']
        if case_status == 'success':
            case_status = 'accepted' if passed else 'wrong_answer'

        if passed:
            passed_count += 1

        results.append({
            'test_case_order': i + 1,
            'passed': passed,
            'status': case_status,
            'stdout': exec_result['stdout'],
            'stderr': exec_result['stderr'],
            'expected_output': expected,
            'actual_output': actual
        })

    return {
        'status': 'completed',
        'passed_count': passed_count,
        'total_count': len(test_cases),
        'results': results
    }