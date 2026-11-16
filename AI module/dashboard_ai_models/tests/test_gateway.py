import asyncio
import base64
import hashlib
import hmac
import json
import tempfile
import unittest
from pathlib import Path

from gateway.client import DeviceClient, DeliveryError, signed_headers
from gateway.outbox import Outbox


class SigningTests(unittest.TestCase):
    def test_cross_language_canonical_bytes(self):
        body = b'{"confidence":0.9,"type":"STROKE"}'
        path = '/api/v1/device/ai/events'
        secret = bytes(range(32))
        headers = signed_headers(secret, 'CG-TEST', 'POST', path, body, '1794736800', 'nonce_0123456789abc')
        canonical = '\n'.join(('POST', path, '1794736800', 'nonce_0123456789abc', hashlib.sha256(body).hexdigest()))
        self.assertEqual(headers['x-device-signature'], hmac.new(secret, canonical.encode(), hashlib.sha256).hexdigest())
        self.assertEqual(headers['x-device-signature'], 'b838840b2f8ee28ff2d258f0b8e975035f84ce842ecb9df4512aab2f17fe5460')

    def test_client_decodes_base64url_and_rejects_unsafe_destinations(self):
        encoded = base64.urlsafe_b64encode(bytes(range(32))).decode().rstrip('=')
        self.assertEqual(DeviceClient('http://localhost:4000/api/v1', 'CG', encoded).secret, bytes(range(32)))
        for url in ['http://example.com/api/v1', 'https://user:pass@example.com/api', 'https://example.com/api?key=x']:
            with self.assertRaises(ValueError):
                DeviceClient(url, 'CG', encoded)


class FakeClient:
    def __init__(self, error=None):
        self.calls = []
        self.error = error

    def request(self, method, path, payload):
        self.calls.append(payload)
        if self.error:
            raise self.error
        return {'eventId': payload['clientEventId'], 'processingMode': 'REPLAY'}


class OutboxTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.path = Path(self.folder.name) / 'queue.sqlite'
        self.box = Outbox(self.path)

    def tearDown(self):
        self.box.close()
        self.folder.cleanup()

    @staticmethod
    def payload(event_id):
        return {'clientEventId': event_id, 'ai': {'associationId': 'pair-a'}, 'confidence': 0.9}

    def test_restart_preserves_payload_and_episode(self):
        self.box.observe('pair-a:Cardiac', True, self.payload)
        self.box.close()
        self.box = Outbox(self.path)
        self.assertFalse(self.box.observe('pair-a:Cardiac', True, self.payload))
        self.assertEqual(self.box.depth, 1)
        client = FakeClient()
        self.box.deliver_one(client, 'pair-a')
        self.assertEqual(self.box.depth, 0)
        self.assertEqual(len(client.calls), 1)

    def test_transient_error_preserves_id_and_honors_retry_after(self):
        self.box.enqueue(self.payload('evt-12345678'))
        failing = FakeClient(DeliveryError(429, retry_after=30))
        self.box.deliver_one(failing, 'pair-a', now=100)
        successful = FakeClient()
        self.assertFalse(self.box.deliver_one(successful, 'pair-a', now=129))
        self.box.deliver_one(successful, 'pair-a', now=130)
        self.assertEqual(failing.calls[0], successful.calls[0])

    def test_reassignment_and_permanent_errors_quarantine_without_delivery(self):
        self.box.enqueue(self.payload('evt-12345678'))
        client = FakeClient()
        self.box.deliver_one(client, 'pair-b')
        self.assertEqual(client.calls, [])
        self.assertEqual(self.box.db.execute('SELECT state FROM deliveries').fetchone()[0], 'quarantined')

    def test_independent_alarms_and_three_clear_windows_rearm(self):
        self.box.observe('pair-a:Cardiac', True, self.payload)
        self.box.observe('pair-a:Seizure', True, self.payload)
        for _ in range(2):
            self.box.observe('pair-a:Cardiac', False, self.payload)
        self.assertFalse(self.box.observe('pair-a:Cardiac', True, self.payload))
        for _ in range(3):
            self.box.observe('pair-a:Cardiac', False, self.payload)
        self.assertTrue(self.box.observe('pair-a:Cardiac', True, self.payload))
        self.assertEqual(self.box.depth, 3)

    def test_capacity_and_immutable_ids(self):
        self.box.max_entries = 1
        self.box.enqueue(self.payload('evt-12345678'))
        with self.assertRaises(ValueError):
            self.box.enqueue({**self.payload('evt-12345678'), 'confidence': 0.1})
        with self.assertRaises(RuntimeError):
            self.box.enqueue(self.payload('evt-87654321'))

    def test_async_delivery_keeps_the_event_loop_responsive(self):
        import time
        class SlowClient(FakeClient):
            def request(self, method, path, payload):
                time.sleep(0.1)
                return super().request(method, path, payload)
        self.box.enqueue(self.payload('evt-12345678'))
        async def run():
            task = asyncio.create_task(self.box.deliver_one_async(SlowClient(), 'pair-a'))
            await asyncio.sleep(0.01)
            self.assertFalse(task.done())
            await task
        asyncio.run(run())
        self.assertEqual(self.box.depth, 0)


if __name__ == '__main__':
    unittest.main()
