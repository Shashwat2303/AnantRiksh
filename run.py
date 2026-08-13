"""
AnantRiksh - Root Launcher
Runs the backend FastAPI server and serves the 3D frontend at http://localhost:8000
"""
import os
import sys
import subprocess

if __name__ == "__main__":
    backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
    run_script = os.path.join(backend_dir, "run.py")
    
    print("[AnantRiksh] Launching server from root directory...")
    sys.exit(subprocess.call([sys.executable, run_script], cwd=backend_dir))
