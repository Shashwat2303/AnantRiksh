"""
AnantRiksh Server Runner
"""
import uvicorn
import os
import sys

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Set stdout to utf-8 on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

if __name__ == "__main__":
    print("[AnantRiksh] Starting Planck 2018 Engine & SDSS DR18 Visualizer...")
    print("[AnantRiksh] Open http://localhost:8000 in your browser to view the 3D map.")
    uvicorn.run("app.server:app", host="127.0.0.1", port=8000, reload=False)
