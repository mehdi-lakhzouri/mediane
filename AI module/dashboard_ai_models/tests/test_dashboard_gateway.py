import asyncio
import json
import tempfile
import unittest
from pathlib import Path

from gateway.client import DeliveryError
from gateway.dashboard import DashboardGateway
from gateway.outbox import Outbox


class DemoApi:
    def __init__(self):
        self.association = 'pair-a'
        self.paired = True
        self.events = []
        self.health = []
        self.unreachable = False

    def request(self, method, route, payload=None):
        if self.unreachable:
            raise DeliveryError()
        if route == '/device/ai/events':
            self.events.append(payload)
            return {'eventId': payload['clientEventId'], 'processingMode': 'REPLAY'}
        if route == '/device/ai/heartbeat':
            self.health.append(payload)
        return {'paired': self.paired, 'associationId': self.association, 'mode': 'ACTIVE'}


class DashboardGatewayTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.box = Outbox(Path(self.folder.name) / 'queue.sqlite')
        self.client = DemoApi()
        self.messages = []

        async def notify(message):
            self.messages.append(message)

        self.gateway = DashboardGateway(
            {'api': 'https://api.vunlera.tn/api/v1', 'serial': 'CG-DEMO',
             'associationId': 'pair-a', 'secret': 'never-in-browser'}, notify,
            client=self.client, outbox=self.box,
            manifest={model: {'sha256': 'a' * 64} for model in ('Cardiac', 'Seizure', 'Stroke')},
        )
        await self.gateway.start()

    async def asyncTearDown(self):
        await self.gateway.close()
        self.folder.cleanup()

    async def wait_delivered(self, count):
        for _ in range(100):
            if len(self.client.events) >= count and self.gateway.snapshot()['sent'] >= count:
                return
            await asyncio.sleep(0.02)
        self.fail('Queued detection did not reach API')

    async def model(self, model='Stroke', score=0.95, alarm=True):
        await self.gateway.observe({'type': 'model', 'model': model, 'p': score, 'alarm': alarm})

    async def test_play_sends_independent_replay_events_and_restart_rearms(self):
        self.assertTrue(await self.gateway.prepare())
        await self.gateway.observe({'type': 'scenario'})
        await self.model('Stroke')
        await self.model('Cardiac')
        await self.model('Stroke')  # Same episode must not send a duplicate.
        await self.wait_delivered(2)
        self.assertEqual({e['type'] for e in self.client.events}, {'STROKE', 'CARDIAC_EMERGENCY'})
        for event in self.client.events:
            self.assertEqual(event['ai']['inputKind'], 'REPLAY')  # Even on ACTIVE devices.
            self.assertEqual(event['ai']['associationId'], 'pair-a')
            self.assertEqual(event['clientEventId'], event['ai']['episodeId'])
        await self.gateway.observe({'type': 'end'})
        await self.gateway.observe({'type': 'scenario'})
        await self.model('Stroke')
        await self.wait_delivered(3)
        self.assertNotEqual(self.client.events[0]['clientEventId'], self.client.events[2]['clientEventId'])
        await self.gateway.report()
        self.assertEqual(self.gateway.snapshot()['sent'], 3)
        self.assertNotIn('never-in-browser', json.dumps(self.messages))

    async def test_no_alarm_or_invalid_model_score_is_not_a_detection(self):
        await self.gateway.observe({'type': 'scenario'})
        await self.model(alarm=False)
        for score in (float('nan'), float('inf'), -0.1, 1.1, None, True):
            await self.model(score=score)
        await asyncio.sleep(0.3)
        self.assertEqual(self.client.events, [])
        self.assertEqual(self.box.depth, 0)

    async def test_reassignment_blocks_play_without_changing_destination(self):
        self.client.association = 'pair-b'
        self.assertFalse(await self.gateway.prepare())
        self.assertEqual(self.gateway.association, 'pair-a')
        self.assertTrue(self.gateway.blocked)
        await self.gateway.observe({'type': 'scenario'})
        await self.model()
        self.assertEqual(self.box.depth, 0)

    async def test_connection_failure_keeps_events_queued_and_blocks_next_play(self):
        await self.gateway.observe({'type': 'scenario'})
        self.client.unreachable = True
        await self.model()
        self.assertFalse(await self.gateway.prepare())
        await asyncio.sleep(0.3)
        self.assertEqual(self.box.depth, 1)
        self.assertEqual(self.client.events, [])

    async def test_stopping_reports_unavailable_models(self):
        await self.gateway.observe({'type': 'scenario'})
        await self.model()
        await self.gateway.observe({'type': 'idle'})
        await self.gateway.heartbeat()
        self.assertEqual(self.client.health[-1]['stroke'], 'UNAVAILABLE')
        self.assertFalse(self.gateway.active)


if __name__ == '__main__':
    unittest.main()
