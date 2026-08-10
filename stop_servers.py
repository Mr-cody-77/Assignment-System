import sys
import psutil

def kill_process_tree(pid):
    try:
        parent = psutil.Process(pid)
        children = parent.children(recursive=True)
        # Terminate children first
        for child in children:
            try:
                child.terminate()
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        # Terminate parent
        parent.terminate()
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        pass

def kill_processes_on_port(port):
    for conn in psutil.net_connections(kind='inet'):
        if conn.laddr.port == port:
            if conn.pid:
                print(f"Killing process tree for PID {conn.pid} on port {port}")
                kill_process_tree(conn.pid)

if __name__ == "__main__":
    print("Stopping Assignment System servers (ports 8000 and 3000)...")
    kill_processes_on_port(8000)
    kill_processes_on_port(3000)
    print("Servers successfully stopped.")
