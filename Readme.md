# ⚡ Distributed Assignment & Code Execution System

A highly scalable, zero-configuration distributed computing platform for Local Area Networks (LAN).  
The system distributes coding assignments to students while offloading code compilation and execution to a self-discovering mesh network of worker nodes — with built-in plagiarism detection.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Project Structure](#3-project-structure)
4. [Setup Guide](#4-setup-guide)
5. [Running the System](#5-running-the-system)
6. [Environment Variables](#6-environment-variables)
7. [Service Discovery (Zeroconf / mDNS)](#7-service-discovery-zeroconf--mdns)
8. [Code Execution & Judging Pipeline](#8-code-execution--judging-pipeline)
9. [Plagiarism Detection System](#9-plagiarism-detection-system)
10. [API Reference](#10-api-reference)

---

## 1. Architecture Overview

The platform is composed of three distinct service roles:

```
┌─────────────────────────────────────────────────────────────────┐
│                        LOCAL AREA NETWORK                       │
│                                                                 │
│  ┌──────────────────────┐      ┌────────────────────────────┐   │
│  │  Centralized DB      │      │  Gateway Node (Backend)    │   │
│  │  (Django + PgSQL)    │◄─────│  (Django + React)          │   │
│  │  Port: 8000          │      │  Ports: 8001 / 3000        │   │
│  │                      │      │                            │   │
│  │  • Auth (JWT)        │      │  • Task Queue              │   │
│  │  • Questions         │      │  • Load Balancer (P2C)     │   │
│  │  • Results           │      │  • Code Editor (React)     │   │
│  │  • Plagiarism Data   │      │  • Node Discovery          │   │
│  └──────────────────────┘      └────────────────────────────┘   │
│                                        ▲     ▼                  │
│                          ┌─────────────┘     └──────────────┐   │
│                          │                                   │   │
│               ┌──────────┴───────┐             ┌────────────┴─┐ │
│               │  Worker Node     │             │  Worker Node  │ │
│               │  Port: 8002      │             │  Port: 8003   │ │
│               │                  │             │               │ │
│               │  • Code Exec     │             │  • Code Exec  │ │
│               │  • I/O Judging   │             │  • I/O Judge  │ │
│               └──────────────────┘             └───────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### A. Centralized Database Server
- **Technology:** Django 4.2 + PostgreSQL
- **Default Port:** `8000`
- **Responsibilities:** Single source of truth for all persistent data — user authentication (JWT), assignment questions, student results, and plagiarism detection records.
- **Design Constraint:** Never executes student code to prevent server bottlenecks.

### B. Gateway Node + Frontend
- **Technology:** Django 4.2 (Backend Node) + React 18 (Frontend)
- **Default Ports:** `8001` (API) / `3000` (React Dev Server)
- **Responsibilities:** Accepts student submissions, runs a Power-of-Two-Choices load balancer across discovered worker nodes, and dispatches tasks via a 2-phase token admission protocol. The React UI provides the coding interface, dashboards, and real-time node telemetry.

### C. Headless Worker Nodes
- **Technology:** Django 4.2
- **Default Ports:** `8002`, `8003`, … (dynamically assigned)
- **Responsibilities:** Receive code payloads, compile using native system compilers, execute against test cases in an isolated subprocess, and push results back to the Gateway Node.

---

## 2. Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.8+ | All backend services |
| Node.js | 18+ | React frontend only |
| npm | 9+ | React frontend only |
| PostgreSQL | 13+ | Centralized DB only |
| GCC / G++ | Any | For C/C++ compilation on worker nodes |
| Java JDK | 11+ | For Java compilation on worker nodes |
| Python | 3.8+ | For Python execution on worker nodes |
| Network | — | All machines on the same LAN / Wi-Fi |

---

## 3. Project Structure

```
Assignment_System/
├── cli.py                          # Unified orchestrator — start all services from here
├── requiremnts.txt                 # Python package dependencies
│
├── Centralized_Database/           # Django project (PostgreSQL backend)
│   ├── .env                        # Database credentials + plagiarism threshold
│   ├── manage.py
│   ├── Centralized_Database/       # Django settings, root URLs
│   ├── users/                      # Auth app (JWT login, student/teacher creation)
│   ├── questions/                  # Questions & test cases app
│   └── results/                    # Results + plagiarism detection app
│       ├── models.py               # Result, SubmittedSolution, SolutionFingerprint, PlagiarismDetected
│       ├── plagiarism_engine.py    # Tokeniser + fingerprint + Jaccard similarity
│       ├── views.py                # All result + plagiarism API views
│       ├── serializers.py
│       ├── urls.py
│       └── migrations/
│
├── Backend/
│   └── System_Management/          # Django project (Gateway + Worker node)
│       ├── manage.py
│       ├── System_Management/      # Django settings, root URLs
│       ├── api_management/         # REST API layer
│       │   ├── views.py            # All node API views
│       │   ├── urls.py
│       │   └── services/
│       │       ├── task_dispatch_service.py
│       │       ├── handle_local_run.py
│       │       ├── node_info.py
│       │       └── plagiarism_pipeline.py  # Async plagiarism trigger (new)
│       └── Services/
│           ├── Sender_Server/      # Load balancer, task queue, node discovery
│           └── Receiver_Server/    # Worker pool, code executor, result pusher
│
└── Frontend/
    └── system_interface/           # React 18 application
        └── src/
            ├── services/           # Axios clients (api.js, resultService.js, plagiarismService.js)
            ├── config/             # Endpoint resolver + runtime config
            ├── pages/
            │   ├── teacher/        # Teacher dashboards
            │   └── student/        # Student dashboards
            └── components/         # Shared UI components (ResultTable, Sidebar, etc.)
```

---

## 4. Setup Guide

### Step 1 — Clone & Create Virtual Environment

```bash
# Navigate to project root
cd Assignment_System

# Create virtual environment
python -m venv venv

# Activate — Windows
venv\Scripts\activate

# Activate — macOS / Linux
source venv/bin/activate
```

### Step 2 — Install Python Dependencies

```bash
pip install django djangorestframework djangorestframework-simplejwt \
            django-cors-headers zeroconf psutil psycopg2-binary \
            python-dotenv requests
```

### Step 3 — Configure the Centralized Database

Edit `Centralized_Database/.env`:

```env
DB_NAME=assignment_system
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

# Plagiarism detection threshold (0.0 – 1.0). Default: 0.75
PLAGIARISM_THRESHOLD=0.75
```

### Step 4 — Run Database Migrations

```bash
cd Centralized_Database
python manage.py migrate
python manage.py createsuperuser   # Create the first teacher account
cd ..
```

### Step 5 — Install Frontend Dependencies

```bash
cd Frontend/system_interface
npm install
cd ../..
```

---

## 5. Running the System

All services are launched via the root-level `cli.py` orchestrator.

### Production-like setup (3 separate machines or terminal windows)

```bash
# Terminal 1 — Centralized Database Server
python cli.py --db_server --port 8000

# Terminal 2 — Gateway Node + React Frontend (main machine)
python cli.py --assignment --port 8001

# Terminal 3+ — Additional headless worker nodes (any LAN machine)
python cli.py --worker_only --port 8002
```

### Single-machine development setup

```bash
# Window 1 — Database
python cli.py --db_server --port 8000

# Window 2 — Assignment node (different port since DB is on 8000)
python cli.py --assignment --port 8001

# React starts automatically on port 3000
```

### CLI Options

| Flag | Default | Description |
|---|---|---|
| `--db_server` | — | Start only the Centralized Database server |
| `--assignment` | — | Start the Backend Node + React frontend |
| `--worker_only` | — | Start only a headless worker node |
| `--port <n>` | `8000` | Port for the service being started |

---

## 6. Environment Variables

### Centralized Database (`Centralized_Database/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DB_NAME` | ✅ | — | PostgreSQL database name |
| `DB_USER` | ✅ | — | PostgreSQL username |
| `DB_PASSWORD` | ✅ | — | PostgreSQL password |
| `DB_HOST` | ✅ | — | PostgreSQL host address |
| `DB_PORT` | ✅ | `5432` | PostgreSQL port |
| `PLAGIARISM_THRESHOLD` | ❌ | `0.75` | Jaccard similarity cutoff for plagiarism flagging (0.0–1.0) |

### Backend Node (injected by `cli.py` at runtime)

| Variable | Default | Description |
|---|---|---|
| `NODE_PORT` | `8000` | The port this node listens on |

---

## 7. Service Discovery (Zeroconf / mDNS)

The system requires **zero hardcoded IP addresses**. All service discovery is powered by mDNS broadcasts on the local network.

| Service | mDNS Name | Broadcast By |
|---|---|---|
| Centralized Database | `_assignsysdb._tcp.local.` | DB Server at startup |
| Worker Nodes | `_assignsysnode._tcp.local.` | Each node at startup |

**Discovery flow:**
1. The Central DB broadcasts: *"I am `_assignsysdb._tcp.local.` at `<IP>:8000`"*
2. Worker nodes join the LAN and discover the DB broadcast — saving the DB IP.
3. Worker nodes also broadcast their own identity + port.
4. The Gateway Node's React frontend calls `/api/node_info/` to get a live network map (DB IP, own IP, all peer node IPs) and dynamically routes all Axios requests without any `.env` configuration.

---

## 8. Code Execution & Judging Pipeline

When a student clicks **Submit**:

```
Student (React)
    │
    ▼
POST /api/task/  ─────────────────────────────── Backend Node (Gateway)
    │                                                    │
    │  ① submit_task() creates a task + queues it        │
    │                                                    │
    │  ② Power-of-Two-Choices load balancer picks        │
    │     the least-loaded peer node                     │
    │                                                    │
    │  ③ Phase 1 — Token Request                         │
    │     POST /api/task_token/ ──► Peer Node            │
    │     ◄── { "status": "accept", "token": "uuid" }    │
    │                                                    │
    │  ④ Phase 2 — Full Task Dispatch                    │
    │     POST /api/accepted_task/ ──► Peer Node         │
    │     (code + test cases + token)                    │
    │                                                    │
    │  ⑤ Peer Node compiles + executes code              │
    │     in an isolated subprocess                      │
    │                                                    │
    │  ⑥ Result pushed back to Gateway                   │
    │     POST /api/task_result/                         │
    │                                                    │
    │  ⑦ Gateway forwards result to Central DB           │
    │     POST /api/results/push_result/                 │
    │                                                    │
    ▼
Student dashboard polls /api/results/result/ for final verdict
```

**Supported Languages:**

| Language | Compiler / Runtime | File |
|---|---|---|
| Python | System Python interpreter | `solution.py` |
| C++ | `g++ -O2 -std=c++17` | `solution.cpp` |
| Java | `javac` / `java` | `Main.java` |
| JavaScript | Node.js | `solution.js` |
| C | `gcc -O2` | `solution.c` |

---

## 9. Plagiarism Detection System

The plagiarism detection system is **fully isolated** from the grading pipeline. It runs as an asynchronous background job and does not affect submission latency.

### How It Works

```
Student clicks Submit
    │
    ├──► [Existing Pipeline] submit_task() → distributed grading (unchanged)
    │
    └──► [New, Async] daemon thread fires AFTER submit_task() returns
              │
              ▼
         POST /api/results/plagiarism/ingest/   (Central DB)
              │
              ▼  Fingerprinting (plagiarism_engine.py)
         ① Tokenise code by language:
            • Python  → Python `tokenize` module (AST-accurate)
            • C++     → Regex lexer (keywords, identifiers, operators)
            • Java    → Regex lexer (keywords, identifiers, operators)
              │
         ② Normalise: collapse string/number literals → __STR__ / __NUM__
              │
         ③ Build 5-grams over token sequence
              │
         ④ Hash each 5-gram with SHA-256 (truncated to 8 bytes)
              │
         ⑤ Store raw code → submitted_solutions table
            Store fingerprint → solution_fingerprints table
              │
         ⑥ Fetch all other fingerprints for same question
              │
         ⑦ Jaccard( A, B ) = |A ∩ B| / |A ∪ B|
              │
         ⑧ score ≥ PLAGIARISM_THRESHOLD?
            YES → insert row into plagiarism_detected table
```

### Threshold Configuration

The similarity threshold is read from `PLAGIARISM_THRESHOLD` in the Central DB `.env` file. **No code redeploy needed** — changing the value takes effect on the next ingest request.

```
# Conservative (catches only obvious copies)
PLAGIARISM_THRESHOLD=0.85

# Recommended default
PLAGIARISM_THRESHOLD=0.75

# Aggressive (may produce false positives on boilerplate-heavy problems)
PLAGIARISM_THRESHOLD=0.60
```

### Dashboard Visibility Rules

| Dashboard | Plagiarism Column Shows |
|---|---|
| **Teacher** | `⚠️ Plagiarism detected with <roll_number>` |
| **Student** | `⚠️ Plagiarism detected` (other student hidden) |

---

## 10. API Reference

See [`docs/API_CONTRACTS.md`](docs/API_CONTRACTS.md) for the complete, structured reference of all API endpoints including request formats, response schemas, authentication requirements, and error codes.