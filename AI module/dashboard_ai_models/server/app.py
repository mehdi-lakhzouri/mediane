"""Web server: serves the page and streams the car loop to the browser over a WebSocket.

At start-up it loads the data (all scenarios) and the 4 models (in their helper processes).
The browser sends only 3 commands: play one scenario, play all scenarios, stop.
"""
import asyncio
import json
import os
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from gateway.dashboard import DashboardGateway, load_config
from gateway.replay import verified_manifest
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
    # Validate exported artifacts before model workers unpickle them.
    manifest = verified_manifest()
    config = load_config()
    print("Loading the data of every scenario ...")
    scenarios = await asyncio.to_thread(build_scenarios, lambda m: print("  ", m))
    for s in scenarios:
        print(f"   {s.name:36s} {s.duration:5.0f} s  {'SIMULATED' if s.simulated else 'real recordings'}")
    print("Loading the 4 models (one helper process per model) ...")
    workers, infos = await start_workers()
    for i in infos:
        print(f"   {i['model']:8s} {', '.join(i['files'])}")
    gateway = app.state.gateway = DashboardGateway(config, broadcast, manifest=manifest)
    await gateway.start()

    async def publish(message):
        await gateway.observe(message)
        await broadcast(message)

    app.state.loop = CarLoop(scenarios, workers, publish, infos)
    app.state.controls = asyncio.Lock()
    print("Ready.")
    try:
        yield
    finally:
        await app.state.loop.stop()
        await gateway.close()
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
    host = ws.headers.get('host', '')
    origin = ws.headers.get('origin')
    if urlsplit('http://' + host).hostname not in ('127.0.0.1', 'localhost', '::1') or (
        origin and origin not in ('http://' + host, 'https://' + host)
    ):
        await ws.close(code=1008)
        return
    await ws.accept()
    loop = app.state.loop
    q = asyncio.Queue(maxsize=600)
    await ws.send_text(encode(loop.hello()))
    await ws.send_text(encode(app.state.gateway.snapshot()))
    for m in loop.snapshot():
        q.put_nowait(encode(m))
    clients.add(q)
    sender = asyncio.create_task(_sender(ws, q))
    try:
        while True:
            cmd = json.loads(await ws.receive_text())
            async with app.state.controls:
                if cmd.get("cmd") == "play" and cmd.get("scenario") in loop.scenarios:
                    if await app.state.gateway.prepare():
                        await loop.stop()
                        loop.play([cmd["scenario"]])
                elif cmd.get("cmd") == "play_all":
                    if await app.state.gateway.prepare():
                        await loop.stop()
                        loop.play(loop.order)
                elif cmd.get("cmd") == "stop":
                    await loop.stop()
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        clients.discard(q)
        sender.cancel()
