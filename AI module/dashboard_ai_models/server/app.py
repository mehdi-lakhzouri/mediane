"""Web server: serves the page and streams the car loop to the browser over a WebSocket.

At start-up it loads the data (all scenarios) and the 4 models (in their helper processes).
The browser sends only 3 commands: play one scenario, play all scenarios, stop.
"""
import asyncio
import json
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from pipeline.scenarios import ROOT, build_scenarios
from .car_loop import CarLoop, clean
from .model_workers import start_workers

STATIC = os.path.join(ROOT, "static")
clients = set()                       # one message queue per open browser tab


def encode(msg):
    return json.dumps(clean(msg), allow_nan=False, separators=(",", ":"))


async def broadcast(msg):
    text = encode(msg)
    for q in list(clients):
        if q.full():                  # a tab that cannot keep up loses its oldest message
            q.get_nowait()
        q.put_nowait(text)


@asynccontextmanager
async def lifespan(app):
    print("Loading the data of every scenario ...")
    scenarios = await asyncio.to_thread(build_scenarios, lambda m: print("  ", m))
    for s in scenarios:
        print(f"   {s.name:36s} {s.duration:5.0f} s  {'SIMULATED' if s.simulated else 'real recordings'}")
    print("Loading the 4 models (one helper process per model) ...")
    workers, infos = await start_workers()
    for i in infos:
        print(f"   {i['model']:8s} {', '.join(i['files'])}")
    app.state.loop = CarLoop(scenarios, workers, broadcast, infos)
    print("Ready.")
    yield
    await app.state.loop.stop()
    for w in workers.values():
        w.close()


app = FastAPI(lifespan=lifespan)
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/")
def index():
    return FileResponse(os.path.join(STATIC, "index.html"), headers={"Cache-Control": "no-store"})


async def _sender(ws, q):
    while True:
        await ws.send_text(await q.get())


@app.websocket("/ws")
async def websocket(ws: WebSocket):
    await ws.accept()
    loop = app.state.loop
    q = asyncio.Queue(maxsize=600)
    await ws.send_text(encode(loop.hello()))
    for m in loop.snapshot():
        q.put_nowait(encode(m))
    clients.add(q)
    sender = asyncio.create_task(_sender(ws, q))
    try:
        while True:
            cmd = json.loads(await ws.receive_text())
            if cmd.get("cmd") == "play" and cmd.get("scenario") in loop.scenarios:
                loop.play([cmd["scenario"]])
            elif cmd.get("cmd") == "play_all":
                loop.play(loop.order)
            elif cmd.get("cmd") == "stop":
                await loop.stop()
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        clients.discard(q)
        sender.cancel()
