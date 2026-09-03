"""
Receiver_Server/worker.py
Code execution worker — runs submitted code in a sandboxed subprocess.
Supports Python, C++, Java, JavaScript.
Sends result callback to origin Django node.
"""

import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import time
import traceback
from unittest import result
import urllib.request
import urllib.error

logger = logging.getLogger('receiver.worker')

# ── Language profiles ─────────────────────────────────────────────────

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
DEFAULT_MEMORY_LIMIT_MB = 256
COMPILE_TIMEOUT = 30


def _render(parts, file, binary, directory):
    return [
        p.replace('{file}', file)
         .replace('{binary}', binary)
         .replace('{dir}', directory)
        for p in parts
    ]


def _memory_mb(pid: int) -> float:
    try:
        import psutil
        return psutil.Process(pid).memory_info().rss / (1024 * 1024)
    except Exception:
        return 0.0


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

    if language == 'java':
        code = code.replace('public class Solution','public class Main')
        path = os.path.join(directory,'Main.java')
    else:
        path = os.path.join(directory, f'solution{config["extension"]}')
        
    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
        
    return path


def run_code(language: str, code: str, input_data: str,
             time_limit_ms: int = DEFAULT_TIME_LIMIT_MS,
             memory_limit_mb: int = DEFAULT_MEMORY_LIMIT_MB) -> dict:
    """
    Compile (if needed) and run one program against one stdin input.
    Returns a result dict with stdout, stderr, timing, memory, status.
    """
    config = LANG_CONFIG.get(language)
    if not config:
        return {'status': 'unsupported_language', 'stderr': f'Unsupported: {language}',
                'stdout': '', 'exec_time_ms': 0, 'memory_mb': 0, 'exit_code': -1}

    timeout_s = min(max(time_limit_ms / 1000, 0.5), 30)
    tmpdir = tempfile.mkdtemp(prefix='recv_exec_')

    try:
        source = _prepare_source(language, code, tmpdir)
        binary = os.path.join(tmpdir, 'solution' + ('.exe' if sys.platform == 'win32' else ''))

        # ── Compilation ──────────────────────────────────────
        if config['compile']:
            cmd = _render(config['compile'], source, binary, tmpdir)
            try:
                result = subprocess.run(
                    cmd, capture_output=True, text=True,
                    timeout=COMPILE_TIMEOUT, cwd=tmpdir,
                )
            except FileNotFoundError:
                return {'status': 'compilation_error',
                        'stderr': f'Compiler not found for {language}. Install it.',
                        'stdout': '', 'exec_time_ms': 0, 'memory_mb': 0, 'exit_code': -1}
            except subprocess.TimeoutExpired:
                return {'status': 'compilation_error', 'stderr': 'Compilation timed out.',
                        'stdout': '', 'exec_time_ms': 0, 'memory_mb': 0, 'exit_code': -1}
            if result.returncode != 0:
                return {'status': 'compilation_error',
                        'stderr': result.stderr or result.stdout,
                        'stdout': '', 'exec_time_ms': 0, 'memory_mb': 0,
                        'exit_code': result.returncode}

        # ── Execution ─────────────────────────────────────────
        cmd = _render(config['run'], source, binary, tmpdir)
        start = time.perf_counter()
        try:
            proc = subprocess.Popen(
                cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                stderr=subprocess.PIPE, cwd=tmpdir, text=True,
            )
            try:
                stdout, stderr = proc.communicate(input=str(input_data), timeout=timeout_s)
                peak_mem = _memory_mb(proc.pid)
                exit_code = proc.returncode
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.communicate()
                return {
                    'status': 'time_limit_exceeded',
                    'stderr': 'Time Limit Exceeded.',
                    'stdout': '', 'exec_time_ms': round(timeout_s * 1000, 2),
                    'memory_mb': 0, 'exit_code': -1,
                }
        except FileNotFoundError:
            return {'status': 'runtime_error',
                    'stderr': f'Runtime not found for {language}.',
                    'stdout': '', 'exec_time_ms': 0, 'memory_mb': 0, 'exit_code': -1}

        elapsed_ms = (time.perf_counter() - start) * 1000

        if peak_mem > memory_limit_mb:
            status = 'memory_limit_exceeded'
        elif exit_code != 0:
            status = 'runtime_error'
        elif elapsed_ms > time_limit_ms:
            status = 'time_limit_exceeded'
        else:
            status = 'success'

        return {
            'status': status,
            'stdout': stdout.strip(),
            'stderr': stderr.strip(),
            'exec_time_ms': round(elapsed_ms, 2),
            'memory_mb': round(peak_mem, 2),
            'exit_code': exit_code,
        }

    except Exception as e:
        logger.exception(f'Execution engine error: {e}')
        return {'status': 'runtime_error', 'stderr': str(e),
                'stdout': '', 'exec_time_ms': 0, 'memory_mb': 0, 'exit_code': -1}
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def _priority(status: str) -> int:
    return {
        'compilation_error': 0, 'runtime_error': 1,
        'time_limit_exceeded': 2, 'memory_limit_exceeded': 3,
        'wrong_answer': 4, 'success': 5,
    }.get(status, 99)


def evaluate_task(task: dict) -> dict:
    """
    Run code against all test cases and aggregate results.
    Returns a payload suitable for POSTing to /result callback.
    """
    language = task.get('language', 'python')
    code = task.get('code', '')
    test_cases = []

    for case in task.get("test_cases",[],):
        case["is_hidden"] = False
        test_cases.append(case)

    for case in task.get("hidden_test_cases",[],):
        case["is_hidden"] = True
        test_cases.append(case)
    time_limit_ms = int(task.get('time_limit_ms') or DEFAULT_TIME_LIMIT_MS)
    memory_limit_mb = int(task.get('memory_limit_mb') or DEFAULT_MEMORY_LIMIT_MB)
    max_score = float(task.get('max_score') or 100)

    results = []
    statuses = []
    passed_count = 0
    earned_points = 0.0
    total_points = 0.0

    for i, case in enumerate(test_cases):
        result = run_code(language, code, str(case.get('input_data', '')),
                          time_limit_ms, memory_limit_mb)
        expected = str(case.get('expected_output', '')).replace('\r\n', '\n').strip()
        actual = result['stdout'].replace('\r\n', '\n').strip()
        passed = (
            result['status'] == 'success'
            and actual == expected
        )
        points = float(case.get('points') or 0)
        case_status = (
            result['status'] if result['status'] != 'success'
            else ('accepted' if passed else 'wrong_answer')
        )

        if passed:
            passed_count += 1
            earned_points += points
        total_points += points
        statuses.append(case_status)

        results.append({
            'test_case': case.get('id'),
            'test_case_order': case.get('order', i + 1),
            'is_hidden': bool(case.get('is_hidden', False)),
            'passed': passed,
            'status': case_status,
            'stdout': result['stdout'],
            'stderr': result['stderr'],
            'actual_output': actual,
            'exec_time_ms': result['exec_time_ms'],
            'memory_kb': round(result['memory_mb'] * 1024, 2),
        })

    if not statuses:
        final_status = 'failed'

    elif all(s == 'accepted' for s in statuses):
        final_status = 'accepted'

    elif any(s == 'compilation_error' for s in statuses):
        final_status = 'compilation_error'

    elif any(s == 'runtime_error' for s in statuses):
        final_status = 'runtime_error'

    elif any(s == 'time_limit_exceeded' for s in statuses):
        final_status = 'time_limit_exceeded'

    elif any(s == 'memory_limit_exceeded' for s in statuses):
        final_status = 'memory_limit_exceeded'

    elif any(s == 'wrong_answer' for s in statuses):
        final_status = 'wrong_answer'

    if total_points > 0:
        score = round((earned_points / total_points * max_score), 2)
    elif test_cases:
        score = round((passed_count / len(test_cases) * max_score), 2)
    else:
        score = 0.0
    total_execution_time = sum(
        tc['exec_time_ms']
        for tc in results
    )

    return {
            'task_id': task.get('task_id', ''),
            'roll_number': task.get('roll_number', ''),
            'question_id': task.get('question_id', ''),
            'language': language,
            'code': task.get('data', {}).get('code', ''),
            'status': final_status,
            'score': score,
            'passed_testcases': passed_count,
            'total_testcases': len(test_cases),
            'execution_time': round(total_execution_time / 1000, 3),
            'email': task.get('email') or '',
        }


def send_result_callback(task: dict, result: dict) -> bool:

    print("CAllback result is called")
    from Services.Receiver_Server.runtime import runtime

    callback_ip = task.get("callback_ip")
    callback_port = task.get("callback_port", 8000)

    if not callback_ip:
        logger.warning("Callback IP missing")
        return False
    
    print(callback_ip)
    print(callback_port)

    url = f"http://{callback_ip}:{callback_port}/api/task_result/"

    authorization = task.get("authorization", "")
    result["authorization"] = authorization
    payload = json.dumps(result).encode()

    try:
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=10) as response:
            success = 200 <= response.status < 300

        if success:
            logger.info(f"Result sent to {callback_ip}:{callback_port}")

        return success

    except urllib.error.HTTPError as e:
        # Catches 4xx and 5xx status codes gracefully
        logger.error(f"CALLBACK URL = {url}")
        logger.error(f"HTTP Error {e.code}: {e.reason}")
        return False

    except Exception as e:
        # Catches actual connection drops, timeouts, or code crashes
        logger.error(f"CALLBACK URL = {url}")
        logger.error(f"EXCEPTION = {repr(e)}")
        traceback.print_exc()
        return False
    
def execute_task(task: dict) -> None:

    task_id = task.get(
        'task_id',
        'unknown',
    )

    logger.info(
        f'Executing task {task_id} '
        f'({task.get("language")})'
    )

    from Services.Receiver_Server.runtime import runtime

    runtime.worker_start()

    result = {
        'status': 'runtime_error',
        'passed_count': 0,
    }

    try:

        result = evaluate_task(task)

        send_result_callback(
            task,
            result,
        )

    except Exception as e:

        logger.exception(
            f'Task {task_id} failed: {e}'
        )

    finally:

        runtime.worker_done()
        runtime.complete_inflight()

        logger.info(
            f'Task {task_id} done: '
            f'{result.get("status")} '
            f'({result.get("passed_count",0)}/'
            f'{len(task.get("test_cases",[]))} passed)'
        )
