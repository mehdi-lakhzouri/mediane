"""Starts CabinGuard and opens the dashboard in the browser.

Run:  python run.py              (then choose a scenario on the page)
      python run.py --no-browser (start the server only)
"""
import argparse
import os
import threading
import time
import urllib.request
import webbrowser

HOST, PORT = "127.0.0.1", 8000


def open_browser_when_ready(url):
    for _ in range(1200):                 # the server answers once the data and the models are loaded
        try:
            urllib.request.urlopen(url, timeout=1)
            webbrowser.open(url)
            return
        except OSError:
            time.sleep(0.5)


if __name__ == "__main__":                # needed on Windows: the helper processes re-import this file
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-browser", action="store_true")
    ap.add_argument("--port", type=int, default=PORT)
    args = ap.parse_args()
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    url = f"http://{HOST}:{args.port}/"
    print(f"CabinGuard dashboard: {url}  (Ctrl+C to stop)")
    if not args.no_browser:
        threading.Thread(target=open_browser_when_ready, args=(url,), daemon=True).start()
    import uvicorn
    uvicorn.run("server.app:app", host=HOST, port=args.port, log_level="warning")
