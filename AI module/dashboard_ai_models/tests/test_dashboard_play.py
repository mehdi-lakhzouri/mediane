"""Exercise a browser Play command through the WebSocket and signed-gateway hook."""
import asyncio
import importlib
import json
import socket
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import uvicorn
from websockets.asyncio.client import connect
from websockets.exceptions import InvalidStatus

from gateway.outbox import Outbox
from server.car_loop import CarLoop
from test_dashboard_gateway import DemoApi


class Playback:
    def __init__(self, scenarios, workers, send, infos):
        self.send = send
        self.scenarios = {'Stroke': None}
        self.order = ['Stroke']
        self.task = None

    def hello(self):
        return {'type': 'hello', 'scenarios': [], 'models': [], 'playing': False}

    def snapshot(self):
        return []

    def play(self, names):
        async def run():
            await self.send({'type': 'scenario', 'name': names[0]})
            await self.send({'type': 'model', 'model': 'Stroke', 'p': 0.98, 'alarm': True})
        self.task = asyncio.create_task(run())

    async def stop(self):
        if self.task:
            await self.task
        await self.send({'type': 'idle'})


class DashboardPlayTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.api = DemoApi()
        self.box = Outbox(Path(self.folder.name) / 'queue.sqlite')
        self.module = importlib.import_module('server.app')
        config = {'api': 'https://api.vunlera.tn/api/v1', 'serial': 'CG-DEMO',
                  'secret': 'private-test-secret', 'associationId': 'pair-a'}
        manifest = {model: {'sha256': 'a' * 64} for model in ('Cardiac', 'Seizure', 'Stroke')}
        self.patches = [
            patch.object(self.module, 'verified_manifest', return_value=manifest),
            patch.object(self.module, 'build_scenarios', return_value=[]),
            patch.object(self.module, 'start_workers', new=AsyncMock(return_value=({}, []))),
            patch.object(self.module, 'CarLoop', Playback),
            patch.object(self.module, 'load_config', return_value=config),
            patch('gateway.dashboard.verified_manifest', return_value=manifest),
            patch('gateway.dashboard.DeviceClient', return_value=self.api),
            patch('gateway.dashboard.Outbox', return_value=self.box),
        ]
        for item in self.patches:
            item.start()
        self.listener = socket.socket()
        self.listener.bind(('127.0.0.1', 0))
        self.listener.setblocking(False)
        self.address = f'127.0.0.1:{self.listener.getsockname()[1]}'
        self.server = uvicorn.Server(uvicorn.Config(self.module.app, log_level='error', lifespan='on'))
        self.task = asyncio.create_task(self.server.serve(sockets=[self.listener]))
        for _ in range(100):
            if self.server.started:
                break
            if self.task.done():
                await self.task
            await asyncio.sleep(0.02)
        self.assertTrue(self.server.started)

    async def asyncTearDown(self):
        self.server.should_exit = True
        await asyncio.wait_for(self.task, 5)
        self.listener.close()
        for item in reversed(self.patches):
            item.stop()
        self.folder.cleanup()

    async def test_browser_play_delivers_and_reports_receipt(self):
        async with connect(f'ws://{self.address}/ws', origin=f'http://{self.address}') as ws:
            self.assertEqual(json.loads(await ws.recv())['type'], 'hello')
            self.assertTrue(json.loads(await ws.recv())['connected'])
            await ws.send(json.dumps({'cmd': 'play', 'scenario': 'Stroke'}))
            async def receive_delivery():
                while True:
                    message = json.loads(await ws.recv())
                    self.assertNotIn('private-test-secret', json.dumps(message))
                    if message['type'] == 'gateway' and message['sent'] == 1:
                        return message
            receipt = await asyncio.wait_for(receive_delivery(), 5)
            self.assertEqual(receipt['pending'], 0)
            self.assertEqual(self.api.events[0]['ai']['inputKind'], 'REPLAY')
            self.assertEqual(self.api.events[0]['ai']['associationId'], 'pair-a')
            await ws.send(json.dumps({'cmd': 'stop'}))

    async def test_unrelated_website_cannot_trigger_demo(self):
        with self.assertRaises(InvalidStatus):
            async with connect(f'ws://{self.address}/ws', origin='https://unrelated.example'):
                pass
        self.assertEqual(self.api.events, [])


class PlaybackFailureTests(unittest.IsolatedAsyncioTestCase):
    async def test_source_failure_reaches_browser_and_finishes_playback(self):
        messages = []

        async def send(message):
            messages.append(message)

        def unavailable_source():
            raise RuntimeError('Recording unavailable')

        loop = CarLoop([SimpleNamespace(name='Broken', make_source=unavailable_source)], {}, send, [])
        await loop._play(['Broken'])
        self.assertEqual([m['type'] for m in messages], ['error', 'idle'])
        self.assertIn('Recording unavailable', messages[0]['text'])


if __name__ == '__main__':
    unittest.main()
