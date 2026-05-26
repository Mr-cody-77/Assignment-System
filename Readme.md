# ⚡ Distributed Assignment & Code Execution System

A highly scalable, zero-configuration distributed computing platform designed for local area networks (LAN). 

This system allows a centralized database to distribute coding assignments to students, while seamlessly offloading the heavy lifting of code compilation and execution to a decentralized, self-discovering mesh network of worker nodes.

---

---

## ⚙️ 2. Complete Setup Guide (From Scratch)

### Prerequisites
* **Python 3.8+**
* **Node.js 18+** & **npm**
* **Native Compilers:** (e.g., Java JDK, GCC/G++, Python) installed and added to the system `PATH`.
* **Network:** All participating machines must be connected to the **same Local Area Network (LAN/Wi-Fi)**.

### Step 1: Clone and Structure
Ensure your project directories are structured correctly:

# Python Backend Setup (Virtual Environment)

## Navigate to the root directory
cd Assignment_System

## Create the virtual environment
python -m venv venv

## Activate it
### Windows:
venv\Scripts\activate
### Mac/Linux:
source venv/bin/activate

## Install required Python packages
pip install django djangorestframework django-cors-headers zeroconf

# Operating the Cluster (cli.py Orchestrator)

## to run the database server at port
python cli.py --db_server --port 8000

## To run the Assignment System 
python cli.py --assignment --port {port}

port = 8000 (Default)
port = 8001 or others (if database server and assignment system is running on single machine)

## For Debugging 

### Adding Compute Power (Peer Machines)
python cli.py --worker_only --port 8002
 
---

## 1. Advanced Architecture Deep-Dive

This platform abandons the traditional "monolithic server" approach. Instead, it utilizes a microservice architecture divided into three distinct roles.

### A. Centralized Database Server (Django)
* **The Source of Truth.**
* **Port:** `8000` (Default)
* **Responsibilities:** Handles all persistent data. It manages user authentication (Students/Teachers), stores assignment questions, and records the final submitted results.
* **Network Role:** It broadcasts its existence to the LAN using mDNS. It **strictly does not** execute student code to prevent server bottlenecks or security breaches.

### B. The "Gateway" Node + Frontend (Django + React)
* **The User Interface & Bridge.**
* **Port:** `8001` (Backend Node) & `3000` (React App)
* **Responsibilities:** The React frontend provides the dashboard and code editor. It talks to the Central DB for logins and assignments, but routes all heavy code-execution requests to its local "Gateway" node (Port 8001). 
* **Network Role:** The Gateway node polls the network for other active worker nodes and feeds this real-time telemetry (CPU/Memory load) back to the React UI.

### C. Headless Worker Nodes (Django)
* **The Compute Engines.**
* **Port:** `8002`, `8003`, etc. (Dynamically assigned)
* **Responsibilities:** These are silent, background processes running on peer computers across the LAN. They receive raw code, securely compile it, execute it against test cases (Judging), and return the output.
* **Network Role:** They dynamically discover the Central DB and other peer nodes. They continuously broadcast their current hardware load to the network.

### Zeroconf Discovery

This system requires zero hardcoded IP addresses. It achieves this using mDNS (Multicast DNS via the zeroconf Python library).

* **DB Broadcast:** The Central DB shouts across the router: "I am _assignsysdb._tcp.local., at Port 8000!"

* **Node Generation:** A Worker Node starts and generates a unique ID (e.g., Node-5599c493). It shouts: "I am a Compute Node, here is my IP and Port!"

* **The Handshake:** The Node hears the DB's broadcast and saves its IP. The DB ignores its own broadcast but listens for Nodes.

* **Dynamic Frontend Routing:** React asks its Gateway Node (8001) for the network map (/api/node_info/). The Gateway packages its own identity, the DB's identity, and all discovered peer nodes, handing this JSON payload to React. React uses this payload to dynamically route Axios requests without needing a .env file.

### Code Execution & Judging Methodology

When a student clicks "Submit Task", the execution completely bypasses the Central DB to prevent bottlenecks.

* **Direct Dispatch:** React sends the raw source code string directly to the local Gateway Node (/api/task/).

* **Sandboxing:** The Node temporarily writes the code to an isolated file on its local disk (e.g., Main.java or script.py).

* **Subprocess Compilation:** The Node uses Python's subprocess.Popen to invoke the host machine's native compilers.

* **I/O Judging:** The subprocess is fed predefined standard input (test cases). Its stdout (standard output) is captured and strictly compared against the expected output string.

* **Score Routing:** The Node forwards the final ACCEPTED or WRONG ANSWER result securely to the Central DB to be saved to the student's permanent record.