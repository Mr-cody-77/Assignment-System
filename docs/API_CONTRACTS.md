# API Contracts — Distributed Assignment System

> **Version:** 1.1.0  
> **Last Updated:** 2026-06-08  
> **Author:** Subrata Nandi  

This document is the single source of truth for all HTTP API endpoints exposed by the system. It is written for engineers integrating with, extending, or debugging the platform.

---

## Table of Contents

- [Conventions](#conventions)
- [Base URLs](#base-urls)
- [Authentication](#authentication)
- [Error Format](#error-format)
- [Central Database API](#central-database-api)
  - [Auth — Users](#auth--users)
  - [Questions](#questions)
  - [Results](#results)
  - [Plagiarism Detection *(new)*](#plagiarism-detection)
- [Backend Node API](#backend-node-api)
  - [Task Submission](#task-submission)
  - [Task Status](#task-status)
  - [Local Code Run](#local-code-run)
  - [Node Telemetry](#node-telemetry)
  - [P2P — Token Admission](#p2p--token-admission-protocol)
  - [P2P — Task Dispatch](#p2p--task-dispatch)
  - [P2P — Result Callback](#p2p--result-callback)

---

## Conventions

| Convention | Detail |
|---|---|
| `{base_central}` | Base URL of the Centralized Database server |
| `{base_node}` | Base URL of the Backend Node (Gateway) |
| Request body format | `application/json` unless noted |
| Response body format | `application/json` always |
| Timestamps | ISO 8601 UTC strings — `"2026-06-08T14:30:00Z"` |
| IDs | Integer primary keys unless noted as UUID |
| `?` after a field name | Field is optional |

---

## Base URLs

| Service | Default URL | Configured By |
|---|---|---|
| Centralized Database | `http://<db-host>:8000` | `cli.py --db_server --port 8000` |
| Backend Node | `http://<node-host>:8001` | `cli.py --assignment --port 8001` |

> The React frontend discovers these URLs dynamically at runtime via `GET /api/node_info/`. No hardcoded URLs are needed in the frontend.

---

## Authentication

The Centralized Database uses **JWT Bearer Tokens** (via `djangorestframework-simplejwt`).

```
Authorization: Bearer <access_token>
```

**Token lifecycle:**

| Token | TTL | Obtained From |
|---|---|---|
| Access Token | 5 minutes (default) | `POST /api/users/login/` |
| Refresh Token | 1 day (default) | `POST /api/users/login/` |
| Rotated Access | On demand | `POST /api/users/refresh/` |

The React frontend automatically intercepts 401 responses and refreshes the access token transparently using `api.js` interceptors.

**Role-based access:**

| Role | Description |
|---|---|
| `teacher` | Can create questions, view all student results, view detailed plagiarism reports |
| `student` | Can view own results and own (anonymised) plagiarism flags |

The Backend Node API is **not JWT-authenticated** — it operates on the same trusted LAN.

---

## Error Format

All error responses follow a consistent structure:

```json
{
  "detail": "Human-readable error message"
}
```

Or, for validation errors from DRF serializers:

```json
{
  "field_name": ["Error message for this field."],
  "another_field": ["Another error."]
}
```

### HTTP Status Code Reference

| Code | Meaning |
|---|---|
| `200 OK` | Success (GET, POST non-creation) |
| `201 Created` | Resource successfully created |
| `202 Accepted` | Task queued (async processing) |
| `400 Bad Request` | Invalid input / validation failure |
| `401 Unauthorized` | Missing or expired access token |
| `403 Forbidden` | Authenticated but insufficient role |
| `404 Not Found` | Resource does not exist |
| `500 Internal Server Error` | Unexpected server-side failure |

---

## Central Database API

**Base:** `{base_central}`

---

### Auth — Users

#### `POST /api/users/login/`

Authenticates a user (student or teacher) and returns a JWT token pair.

**Authentication required:** ❌ None

**Request body:**

```json
{
  "username": "2023001",
  "password": "2023001"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `username` | `string` | ✅ | For students, this is the roll number |
| `password` | `string` | ✅ | Default student password equals roll number |

**Success response — `200 OK`:**

```json
{
  "authenticated": true,
  "role": "student",
  "username": "2023001",
  "access": "<jwt-access-token>",
  "refresh": "<jwt-refresh-token>"
}
```

| Field | Type | Description |
|---|---|---|
| `authenticated` | `boolean` | Always `true` on success |
| `role` | `"teacher" \| "student"` | User role |
| `username` | `string` | Authenticated username |
| `access` | `string` | Short-lived access token |
| `refresh` | `string` | Long-lived refresh token |

**Error responses:**

| Status | Condition | Body |
|---|---|---|
| `400` | Missing or invalid fields | DRF validation errors |
| `401` | Wrong username or password | `{ "authenticated": false, "message": "Invalid credentials" }` |

---

#### `POST /api/users/refresh/`

Exchanges a valid refresh token for a new access token.

**Authentication required:** ❌ None

**Request body:**

```json
{
  "refresh": "<jwt-refresh-token>"
}
```

**Success response — `200 OK`:**

```json
{
  "access": "<new-jwt-access-token>"
}
```

**Error responses:**

| Status | Condition | Body |
|---|---|---|
| `400` | `refresh` field missing | `{ "detail": "Refresh token required" }` |
| `401` | Refresh token invalid or expired | `{ "detail": "Invalid refresh token" }` |

---

#### `POST /api/users/add_student/`

Creates a new student account. The student's roll number becomes both their username and default password.

**Authentication required:** ✅ `Bearer <token>` — **Teacher only**

**Request body:**

```json
{
  "roll_number": "2023042"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `roll_number` | `string` | ✅ | Max 50 characters, must be unique |

**Success response — `200 OK`:**

```json
{
  "success": true,
  "username": "2023042",
  "password": "2023042"
}
```

> ⚠️ **Note:** The `password` field in the response is the plain-text initial password. Share it securely with the student and instruct them to change it.

**Error responses:**

| Status | Condition | Body |
|---|---|---|
| `400` | `roll_number` missing | DRF validation errors |
| `200` | Roll number already exists | `{ "success": false, "message": "Student already exists" }` |
| `403` | Caller is not a teacher | DRF permission error |

---

#### `POST /api/users/add_teacher/`

Creates a new teacher account.

**Authentication required:** ✅ `Bearer <token>` — **Teacher only**

**Request body:**

```json
{
  "username": "prof_sharma",
  "password": "SecurePass123"
}
```

**Success response — `200 OK`:**

```json
{
  "success": true,
  "username": "prof_sharma",
  "role": "teacher"
}
```

**Error responses:**

| Status | Condition | Body |
|---|---|---|
| `400` | Missing fields | DRF validation errors |
| `200` | Username already exists | `{ "success": false, "message": "Teacher already exists" }` |
| `403` | Caller is not a teacher | DRF permission error |

---

### Questions

#### `GET /api/questions/`

Returns all questions. For students, the `is_solved` field reflects their own submission history.

**Authentication required:** ✅ `Bearer <token>`

**Request:** No body.

**Success response — `200 OK`:**

```json
[
  {
    "id": 1,
    "title": "Two Sum",
    "description": "Given an array of integers...",
    "examples": [
      { "input": "[2,7,11,15], 9", "output": "[0,1]" }
    ],
    "constraints": "2 <= nums.length <= 10^4",
    "test_cases": [
      { "id": 1, "input_data": "2 7 11 15\n9", "expected_output": "0 1" }
    ],
    "hidden_test_cases": [
      { "id": 5, "input_data": "3 2 4\n6", "expected_output": "1 2" }
    ],
    "created_at": "2026-05-21T09:00:00Z",
    "is_solved": false
  }
]
```

| Field | Type | Notes |
|---|---|---|
| `id` | `integer` | Question primary key — used as `question_id` everywhere |
| `title` | `string` | Display title |
| `description` | `string` | Full problem statement |
| `examples` | `array<object>` | Visible example I/O for students |
| `constraints` | `string` | Problem constraints |
| `test_cases` | `array<TestCase>` | Visible test cases |
| `hidden_test_cases` | `array<HiddenTestCase>` | Graded hidden test cases |
| `created_at` | `datetime` | ISO 8601 |
| `is_solved` | `boolean` | `true` if **this user** has an `accepted` result |

---

#### `GET /api/questions/{question_id}/`

Returns full details for a single question.

**Authentication required:** ✅ `Bearer <token>`

**Path parameter:**

| Parameter | Type | Description |
|---|---|---|
| `question_id` | `integer` | Question primary key |

**Success response — `200 OK`:** Same schema as a single element from `GET /api/questions/`.

**Error responses:**

| Status | Condition |
|---|---|
| `404` | Question not found |

---

#### `POST /api/questions/create/`

Creates a new question with visible and hidden test cases.

**Authentication required:** ✅ `Bearer <token>` — **Teacher only**

**Request body:**

```json
{
  "title": "Reverse String",
  "description": "Write a function that reverses a string.",
  "examples": [
    { "input": "hello", "output": "olleh" }
  ],
  "constraints": "1 <= s.length <= 10^5",
  "test_cases": [
    { "input": "hello", "output": "olleh" },
    { "input": "world", "output": "dlrow" }
  ],
  "hidden_test_cases": [
    { "input": "abcdef", "output": "fedcba" }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | `string` | ✅ | Max 255 chars |
| `description` | `string` | ✅ | Full problem statement (Markdown supported) |
| `examples` | `array` | ❌ | Sample I/O shown to students |
| `constraints` | `string` | ✅ | Problem constraints |
| `test_cases` | `array<{input, output}>` | ❌ | Visible test cases for "Run" |
| `hidden_test_cases` | `array<{input, output}>` | ❌ | Secret test cases for scoring |

**Success response — `201 Created`:**

```json
{
  "message": "Question created",
  "question_id": 7
}
```

**Error responses:**

| Status | Condition |
|---|---|
| `403` | Caller is not a teacher |

---

### Results

#### `POST /api/results/result/`

Fetches submission results.

- **Teacher** → Returns all results (or filtered by `roll_number` if provided).
- **Student** → Returns only own results. Must provide own `roll_number`.

**Authentication required:** ✅ `Bearer <token>`

**Request body:**

```json
{
  "roll_number": "2023001"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `roll_number` | `string` | Teacher: ❌ optional / Student: ✅ required | Teacher omits for all results |

**Success response — `200 OK`:**

```json
[
  {
    "id": 42,
    "student": "2023001",
    "roll_number": "2023001",
    "question_id": "3",
    "score": 80.0,
    "passed_testcases": 4,
    "total_testcases": 5,
    "execution_time": 0.312,
    "status": "partial",
    "submitted_at": "2026-06-08T10:15:30Z"
  }
]
```

| Field | Type | Notes |
|---|---|---|
| `id` | `integer` | Result primary key |
| `student` | `string` | Username of the student |
| `roll_number` | `string` | Student roll number |
| `question_id` | `string` | Question ID (stringified integer) |
| `score` | `float` | Raw score (0 – 100) |
| `passed_testcases` | `integer` | Number of hidden test cases passed |
| `total_testcases` | `integer` | Total hidden test cases |
| `execution_time` | `float` | Execution time in seconds |
| `status` | `string` | See [Status Values](#result-status-values) |
| `submitted_at` | `datetime` | ISO 8601 UTC |

##### Result Status Values

| Value | Meaning |
|---|---|
| `accepted` | All test cases passed |
| `partial` | Some test cases passed |
| `wrong_answer` | Output does not match expected |
| `runtime_error` | Process exited with non-zero code |
| `time_limit_exceeded` | Execution exceeded the time limit |
| `memory_limit_exceeded` | Process exceeded memory limit |

**Error responses:**

| Status | Condition |
|---|---|
| `403` | Student attempting to access another student's results |

---

#### `POST /api/results/push_result/`

**Internal endpoint.** Called by a Worker Node after code execution is complete, to persist the result to the database.

**Authentication required:** ❌ None (internal LAN call)

**Request body:**

```json
{
  "roll_number": "2023001",
  "question_id": "3",
  "status": "accepted",
  "score": 100.0,
  "passed_testcases": 5,
  "total_testcases": 5,
  "execution_time": 0.205
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `roll_number` | `string` | ✅ | Used to look up the User record |
| `question_id` | `string` | ✅ | |
| `status` | `string` | ✅ | One of the Result status values |
| `score` | `float` | ❌ | Default `0` |
| `passed_testcases` | `integer` | ❌ | Default `0` |
| `total_testcases` | `integer` | ❌ | Default `0` |
| `execution_time` | `float` | ❌ | Default `0` |
| `execution_node` | `string` | ❌ | Ignored in storage |
| `results` | `array` | ❌ | Ignored in storage |
| `logs` | `array` | ❌ | Ignored in storage |

**Success response — `200 OK`:**

```json
{
  "success": true,
  "result_id": 42
}
```

**Error responses:**

| Status | Condition |
|---|---|
| `400` | Validation failure |
| `404` | Student with given `roll_number` not found |

---

### Plagiarism Detection

> All three endpoints live under `{base_central}/api/results/plagiarism/`.

---

#### `POST /api/results/plagiarism/ingest/`

**Internal endpoint.** Called asynchronously by the Backend Node's daemon thread after a student submits code. Stores the raw solution and its fingerprint, runs pairwise Jaccard comparison against all existing fingerprints for the same question, and inserts `PlagiarismDetected` records where the similarity score meets or exceeds `PLAGIARISM_THRESHOLD`.

**Authentication required:** ❌ None (internal LAN call, machine-to-machine)

**Request body:**

```json
{
  "roll_number": "2023001",
  "question_id": "3",
  "language": "python",
  "code": "def two_sum(nums, target):\n    ..."
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `roll_number` | `string` | ✅ | Submitting student's roll number |
| `question_id` | `string` | ✅ | Question being answered |
| `language` | `string` | ✅ | `"python"`, `"cpp"`, `"c++"`, `"java"`, or other |
| `code` | `string` | ✅ | Full raw source code |

**Processing steps (server-side):**

1. **Store solution** — `update_or_create` in `submitted_solutions` (latest submission wins).
2. **Generate fingerprint** — tokenise → normalise → 5-gram SHA-256 hashes → `update_or_create` in `solution_fingerprints`.
3. **Short-circuit** — if fingerprint is empty (code too short), return early with `"detail": "fingerprint_too_short"`.
4. **Fetch peers** — all `solution_fingerprints` rows for same `question_id`, excluding this student.
5. **Compare** — Jaccard similarity for each peer.
6. **Flag** — if `similarity ≥ PLAGIARISM_THRESHOLD`, insert into `plagiarism_detected`.

**Success response — `200 OK`:**

```json
{
  "status": "ok",
  "fingerprint_length": 142,
  "comparisons": 8,
  "flagged": 1
}
```

| Field | Type | Description |
|---|---|---|
| `status` | `string` | Always `"ok"` on success |
| `fingerprint_length` | `integer` | Number of n-gram hashes generated |
| `comparisons` | `integer` | Number of other students compared against |
| `flagged` | `integer` | Number of `PlagiarismDetected` records inserted |

**Short-circuit response — `200 OK`:**

```json
{
  "status": "ok",
  "detail": "fingerprint_too_short"
}
```

**Error responses:**

| Status | Condition |
|---|---|
| `400` | Missing required field |

---

#### `GET /api/results/plagiarism/teacher/`

Returns all plagiarism detection incidents. Teacher can see both student roll numbers and the similarity score. Supports filtering by question.

**Authentication required:** ✅ `Bearer <token>` — **Teacher only**

**Query parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `question_id` | `string` | ❌ | Filter flags to a specific question |

**Example:**
```
GET /api/results/plagiarism/teacher/?question_id=3
```

**Success response — `200 OK`:**

```json
[
  {
    "id": 1,
    "flagged_student_roll": "2023001",
    "copied_from_student_roll": "2023007",
    "question_id": "3",
    "similarity_score": 0.8923,
    "detected_at": "2026-06-08T14:22:05Z"
  }
]
```

| Field | Type | Description |
|---|---|---|
| `id` | `integer` | Flag record primary key |
| `flagged_student_roll` | `string` | The student whose submission triggered the flag |
| `copied_from_student_roll` | `string` | The student they matched against |
| `question_id` | `string` | Question ID |
| `similarity_score` | `float` | Jaccard similarity (0.0–1.0) |
| `detected_at` | `datetime` | ISO 8601 UTC |

**Error responses:**

| Status | Condition |
|---|---|
| `403` | Caller is not a teacher |

---

#### `GET /api/results/plagiarism/student/`

Returns plagiarism flags for the authenticated student only. The `copied_from_student_roll` field is **deliberately omitted** — students must not be able to identify the other student they matched.

**Authentication required:** ✅ `Bearer <token>` — **Student only**

**Request:** No body, no query parameters.

**Success response — `200 OK`:**

```json
[
  {
    "id": 1,
    "flagged_student_roll": "2023001",
    "question_id": "3",
    "similarity_score": 0.8923,
    "detected_at": "2026-06-08T14:22:05Z"
  }
]
```

> ⚠️ `copied_from_student_roll` is intentionally absent from this response.

**Error responses:**

| Status | Condition |
|---|---|
| `403` | Caller is not a student |

---

## Backend Node API

**Base:** `{base_node}`

> The Backend Node does not use JWT authentication. All endpoints are accessible on the trusted LAN.

---

### Task Submission

#### `POST /api/task/`

Submits a student's solution to the distributed execution pipeline. The task is queued, assigned to the best available node via Power-of-Two-Choices, and executed asynchronously.

Immediately after queuing, a background daemon thread fires the plagiarism detection pipeline — this is invisible to the caller.

**Authentication required:** ❌ None (called by React via LAN)

**Request body:**

```json
{
  "roll_number": "2023001",
  "language": "python",
  "solution": "def solution():\n    return sum([1,2,3])",
  "question": {
    "id": 3,
    "title": "Sum of Array",
    "description": "Return the sum of the given array.",
    "constraints": "1 ≤ n ≤ 1000",
    "examples": [],
    "test_cases": [],
    "hidden_test_cases": []
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `roll_number` | `string` | ✅ | Student's roll number |
| `language` | `string` | ✅ | `"python"`, `"cpp"`, `"java"`, `"javascript"`, `"c"` |
| `solution` | `string` | ✅ | Full raw source code |
| `question` | `object` | ✅ | Full question object (test cases fetched from DB server at dispatch time and merged) |
| `question.id` | `integer` | ✅ | Used to fetch hidden test cases from the Central DB |

**Success response — `202 Accepted`:**

```json
{
  "task_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "queued"
}
```

| Field | Type | Description |
|---|---|---|
| `task_id` | `UUID` | Use this to poll `GET /api/task_status/` |
| `status` | `"queued"` | Task has been accepted into the queue |

**Error responses:**

| Status | Condition | Body |
|---|---|---|
| `202` with `"queue_full"` | All nodes are at capacity | `{ "status": "queue_full" }` |
| `400` | Missing required field | `{ "error": "..." }` |

---

### Task Status

#### `GET /api/task_status/`

Returns the live status of all tasks tracked by this node in memory.

**Authentication required:** ❌ None

**Request:** No body, no parameters.

**Success response — `200 OK`:**

```json
[
  {
    "task_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "question_id": "3",
    "roll_number": "2023001",
    "status": "executing",
    "assigned_node": {
      "node_id": "Node-5599c493",
      "ip": "192.168.1.105",
      "port": 8002
    },
    "created_at": 1749386130.512,
    "updated_at": 1749386131.801,
    "result": null
  }
]
```

##### Task Status Values

| Value | Description |
|---|---|
| `queued` | Task is in the local queue, not yet assigned |
| `executing` | Task has been dispatched to a worker node |
| `accepted` | Worker completed successfully |
| `wrong_answer` | Worker returned wrong answer |
| `runtime_error` | Worker reported a runtime error |
| `time_limit_exceeded` | Worker reported TLE |
| `memory_limit_exceeded` | Worker reported MLE |

When `status` is a terminal value, the `result` field contains the full execution payload returned by the worker.

---

### Local Code Run

#### `POST /api/local-run/`

Compiles and executes code locally **on this node** against a set of visible test cases. Used by the React code editor's "Run" button (not a graded submission).

**Authentication required:** ❌ None

**Request body:**

```json
{
  "language": "python",
  "code": "print(int(input()) * 2)",
  "test_cases": [
    { "input_data": "5", "expected_output": "10" },
    { "input_data": "0", "expected_output": "0" }
  ],
  "time_limit_ms": 2000
}
```

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `language` | `string` | ✅ | — | `"python"`, `"cpp"`, `"java"`, `"javascript"`, `"c"` |
| `code` | `string` | ✅ | — | Full source code |
| `test_cases` | `array` | ✅ | — | Visible test cases to run against |
| `test_cases[].input_data` | `string` | ✅ | — | stdin fed to the process |
| `test_cases[].expected_output` | `string` | ✅ | — | Expected stdout |
| `time_limit_ms` | `integer` | ❌ | `2000` | Max `10000`, capped at 10 seconds |

**Success response — `200 OK`:**

```json
{
  "status": "completed",
  "passed_count": 1,
  "total_count": 2,
  "results": [
    {
      "test_case_order": 1,
      "passed": true,
      "status": "accepted",
      "stdout": "10",
      "stderr": "",
      "expected_output": "10",
      "actual_output": "10"
    },
    {
      "test_case_order": 2,
      "passed": false,
      "status": "wrong_answer",
      "stdout": "0",
      "stderr": "",
      "expected_output": "0",
      "actual_output": "0"
    }
  ]
}
```

##### Per-test-case Status Values

| Value | Meaning |
|---|---|
| `accepted` | Output matched expected |
| `wrong_answer` | Output did not match |
| `runtime_error` | Process exited with error |
| `compilation_error` | Compiler failed |
| `time_limit_exceeded` | Process timed out |
| `unsupported_language` | Language not in `LANG_CONFIG` |

---

### Node Telemetry

#### `GET /api/get-load/`

Returns real-time hardware metrics and task statistics for this node.

**Authentication required:** ❌ None

**Request:** No body.

**Success response — `200 OK`:**

```json
{
  "node_id": "Node-5599c493",
  "hostname": "workstation-lab3",
  "ip": "192.168.1.104",
  "port": 8001,
  "cpu_usage": 23.4,
  "memory_usage": 61.2,
  "io_wait": 0.8,
  "active_workers": 2,
  "inflight_tasks": 2,
  "completed_tasks": 47,
  "workers_limit": 5,
  "current_load_score": 0.712
}
```

| Field | Type | Description |
|---|---|---|
| `node_id` | `string` | Unique node identifier |
| `hostname` | `string` | Machine hostname |
| `ip` | `string` | LAN IP address |
| `port` | `integer` | Port this node listens on |
| `cpu_usage` | `float` | Current CPU usage % |
| `memory_usage` | `float` | Current RAM usage % |
| `io_wait` | `float` | Current I/O wait % |
| `active_workers` | `integer` | Worker threads currently running |
| `inflight_tasks` | `integer` | Tasks currently executing |
| `completed_tasks` | `integer` | Total tasks completed since startup |
| `workers_limit` | `integer` | Max concurrent workers allowed |
| `current_load_score` | `float` | Composite load score (0–1); higher = more available |

---

#### `GET /api/node_info/`

Returns the complete network map as known by this node: its own identity, the Central DB address, and all discovered peer nodes.

**Authentication required:** ❌ None

**Request:** No body.

**Success response — `200 OK`:**

```json
{
  "self": {
    "node_id": "Node-5599c493",
    "ip": "192.168.1.104",
    "port": 8001
  },
  "database": {
    "ip": "192.168.1.100",
    "port": 8000
  },
  "peers": [
    {
      "node_id": "Node-aa44bb12",
      "ip": "192.168.1.105",
      "port": 8002,
      "cpu_usage": 18.1,
      "memory_usage": 55.0
    }
  ]
}
```

> The React frontend uses this payload to dynamically route API calls without any hardcoded URLs.

---

### P2P — Token Admission Protocol

These endpoints implement Phase 1 of the 2-phase task dispatch between Gateway Nodes.

#### `POST /api/task_token/`

Phase 1 — Sender asks this node if it can accept a new task. If accepted, an opaque single-use token is returned which must accompany the full task payload.

**Authentication required:** ❌ None (LAN-internal)

**Request body:**

```json
{
  "task_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

**Success (accept) response — `200 OK`:**

```json
{
  "status": "accept",
  "token": "9a8b7c6d-5e4f-3a2b-1c0d-ef1234567890"
}
```

**Success (reject) response — `200 OK`:**

```json
{
  "status": "reject"
}
```

> A `reject` means this node is currently at capacity. The Sender should retry with a different candidate node.

---

### P2P — Task Dispatch

#### `POST /api/accepted_task/`

Phase 2 — Delivers the full task payload to a node that has already issued an admission token. The token is validated before the task is queued for execution.

**Authentication required:** ❌ None (LAN-internal)

**Request body:**

```json
{
  "task_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "token": "9a8b7c6d-5e4f-3a2b-1c0d-ef1234567890",
  "sender_id": "Node-5599c493",
  "sender_ip": "192.168.1.104",
  "sender_port": 8001,
  "submission_id": "sub_001",
  "roll_number": "2023001",
  "question_id": "3",
  "language": "python",
  "code": "def solution(): ...",
  "title": "Two Sum",
  "description": "...",
  "constraints": "...",
  "examples": [],
  "test_cases": [
    { "input_data": "2 7\n9", "expected_output": "0 1" }
  ],
  "hidden_test_cases": [
    { "input_data": "3 2\n6", "expected_output": "1 2" }
  ],
  "time_limit_ms": 2000,
  "memory_limit_mb": 256,
  "max_score": 100,
  "callback_ip": "192.168.1.104",
  "callback_port": 8001
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `task_id` | `UUID` | ✅ | Must match the token |
| `token` | `UUID` | ✅ | Single-use token from Phase 1 |
| `sender_id` | `string` | ✅ | Node ID of the sender (for routing callback) |
| `sender_ip` / `sender_port` | `string` / `int` | ✅ | Sender address |
| `callback_ip` / `callback_port` | `string` / `int` | ✅ | Where to POST the result when done |
| `code` | `string` | ✅ | Full source code |
| `language` | `string` | ✅ | |
| `test_cases` | `array` | ✅ | Visible test cases |
| `hidden_test_cases` | `array` | ✅ | Graded hidden test cases |
| `time_limit_ms` | `integer` | ❌ | Default `2000` |
| `memory_limit_mb` | `integer` | ❌ | Default `256` |
| `max_score` | `float` | ❌ | Default `100` |

**Success response — `200 OK`:**

```json
{
  "status": "accepted"
}
```

**Error responses:**

| Status | Body | Reason |
|---|---|---|
| `403` | `{ "status": "reject", "reason": "invalid_token" }` | Token invalid or already used |
| `400` | `{ "status": "reject", "reason": "..." }` | Worker queue full or other error |

---

### P2P — Result Callback

#### `POST /api/task_result/`

Called by a Worker Node after it finishes executing a task. The Gateway Node updates its in-memory task state and forwards the result to the Central DB.

**Authentication required:** ❌ None (LAN-internal)

**Request body:**

```json
{
  "task_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "roll_number": "2023001",
  "question_id": "3",
  "status": "accepted",
  "score": 100.0,
  "passed_testcases": 5,
  "total_testcases": 5,
  "execution_time": 0.205,
  "authorization": "Bearer <jwt-token>"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `task_id` | `UUID` | ✅ | Used to update in-memory task state |
| `roll_number` | `string` | ✅ | Forwarded to Central DB |
| `question_id` | `string` | ✅ | Forwarded to Central DB |
| `status` | `string` | ✅ | Final execution verdict |
| `score` | `float` | ❌ | Final score |
| `passed_testcases` | `integer` | ❌ | |
| `total_testcases` | `integer` | ❌ | |
| `execution_time` | `float` | ❌ | Seconds |
| `authorization` | `string` | ❌ | JWT forwarded to Central DB's `push_result` |

**Success response — `200 OK`:**

```json
{
  "success": true
}
```

**Error response — `500 Internal Server Error`:**

```json
{
  "success": false
}
```

---

## Data Model Reference

### `Result`

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint PK` | |
| `student_id` | `FK → users_user` | |
| `roll_number` | `varchar(100)` | Denormalised for query speed |
| `question_id` | `varchar(100)` | String-cast question PK |
| `score` | `float` | |
| `passed_testcases` | `int` | |
| `total_testcases` | `int` | |
| `execution_time` | `float` | Seconds |
| `status` | `varchar(50)` | Enum — see Status Values |
| `submitted_at` | `timestamptz` | Auto-set on creation |

### `SubmittedSolution` *(plagiarism)*

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint PK` | |
| `roll_number` | `varchar(100)` | |
| `question_id` | `varchar(100)` | |
| `language` | `varchar(50)` | |
| `code` | `text` | Raw source code |
| `submitted_at` | `timestamptz` | |
| — | `UNIQUE(roll_number, question_id)` | Latest submission replaces previous |

### `SolutionFingerprint` *(plagiarism)*

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint PK` | |
| `roll_number` | `varchar(100)` | |
| `question_id` | `varchar(100)` | |
| `language` | `varchar(50)` | |
| `fingerprint_data` | `jsonb` | Array of 16-char hex strings |
| `generated_at` | `timestamptz` | Auto-updated on upsert |
| — | `UNIQUE(roll_number, question_id)` | Latest fingerprint replaces previous |

### `PlagiarismDetected` *(plagiarism)*

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint PK` | |
| `flagged_student_id` | `FK → users_user` | Student whose submission was flagged |
| `copied_from_student_roll` | `varchar(100)` | Roll number of the matched student |
| `question_id` | `varchar(100)` | |
| `similarity_score` | `float` | Jaccard similarity, rounded to 4 decimal places |
| `detected_at` | `timestamptz` | Auto-set on creation |

---

## Changelog

| Version | Date | Changes |
|---|---|---|
| `1.1.0` | 2026-06-08 | Added plagiarism detection endpoints (`/ingest/`, `/teacher/`, `/student/`); added `SubmittedSolution`, `SolutionFingerprint`, `PlagiarismDetected` data model reference |
| `1.0.0` | 2026-05-21 | Initial release — auth, questions, results, task pipeline |
