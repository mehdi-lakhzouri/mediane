"""Publish dashboard playback through the existing signed, replay-only gateway."""
import asyncio
import hashlib
import json
import math
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from .client import DeviceClient, DeliveryError
from .outbox import Outbox
from .replay import MODEL_TYPES, ROOT, utc, verified_manifest

CONFIG_PATH = ROOT / '.gateway' / 'dashboard.json'


def load_config():
    config = json.loads(CONFIG_PATH.read_text(encoding='utf-8')) if CONFIG_PATH.exists() else {}
    for key, name in [('api', 'CABINGUARD_API_URL'), ('serial', 'CABINGUARD_DEVICE_SERIAL'),
                      ('secret', 'CABINGUARD_DEVICE_SECRET')]:
        if os.environ.get(name):
            config[key] = os.environ[name]
    if config:
        config.setdefault('api', 'https://api.vunlera.tn/api/v1')
    return config


class DashboardGateway:
    def __init__(self, config, notify, *, client=None, outbox=None, manifest=None):
        self.config, self.notify = config, notify
        self.client, self.outbox, self.manifest = client, outbox, manifest
        self.enabled = bool(config)
        self.association = config.get('associationId')
        self.task = None
        self.boot_id = str(uuid.uuid4())
        self.scope = None
        self.started = datetime.now(timezone.utc)
        self.active = False
        self.statuses = {model: 'UNAVAILABLE' for model in MODEL_TYPES}
        self.completed = {}
        self.connected = False
        self.blocked = False
        self.error = None
        self.baseline_sent = 0
        self.last_snapshot = None

    def snapshot(self):
        sent = self.outbox.db.execute("SELECT COUNT(*) FROM deliveries WHERE state='sent'").fetchone()[0] if self.outbox else 0
        return {'type': 'gateway', 'enabled': self.enabled, 'connected': self.connected,
                'api': self.config.get('api'), 'serial': self.config.get('serial'),
                'driver': self.config.get('driver'), 'mode': 'REPLAY',
                'sent': max(0, sent - self.baseline_sent),
                'pending': self.outbox.depth if self.outbox else 0,
                'quarantined': self.outbox.quarantined if self.outbox else 0,
                'error': self.error}

    async def report(self):
        status = self.snapshot()
        if status != self.last_snapshot:
            self.last_snapshot = status
            await self.notify(status)

    async def start(self):
        if not self.enabled:
            return
        try:
            self.manifest = self.manifest or verified_manifest()
            self.client = self.client or DeviceClient(self.config['api'], self.config['serial'], self.config['secret'])
            key = hashlib.sha256((self.config['api'].rstrip('/') + ':' + self.config['serial']).encode()).hexdigest()[:16]
            self.outbox = self.outbox or Outbox(ROOT / '.gateway' / f'dashboard-{key}.sqlite')
            self.baseline_sent = self.outbox.db.execute("SELECT COUNT(*) FROM deliveries WHERE state='sent'").fetchone()[0]
            await self.check_session()
        except (DeliveryError, ValueError, KeyError, RuntimeError) as exc:
            self.error = self.explain(exc)
        if self.client and self.outbox and self.manifest:
            self.task = asyncio.create_task(self.deliver())
        await self.report()

    @staticmethod
    def explain(exc):
        if isinstance(exc, DeliveryError):
            return f'API inaccessible (HTTP {exc.status or "hors ligne"}). Vérifiez la connexion et le boîtier.'
        return str(exc) if not isinstance(exc, KeyError) else 'Configuration incomplète. Lancez python -m gateway.configure.'

    async def check_session(self):
        if self.blocked:
            raise RuntimeError('Association modifiée. Reconfigurez le boîtier avant de poursuivre.')
        session = await asyncio.to_thread(self.client.request, 'GET', '/device/ai/session')
        if not session.get('paired'):
            self.blocked = True
            raise RuntimeError('Ce boîtier doit être associé à un conducteur dans le backend.')
        association = session.get('associationId')
        if not association or (self.association and association != self.association):
            self.blocked = True
            raise RuntimeError('Association modifiée. Reconfigurez le boîtier avant de poursuivre.')
        self.association = association
        self.connected = True
        self.error = None

    async def prepare(self):
        """Validate pairing before Play; never silently fall back to local playback."""
        if not self.enabled:
            return True
        try:
            if not self.client or not self.outbox or not self.manifest or not self.task or self.task.done():
                raise RuntimeError('Passerelle indisponible. Vérifiez la configuration puis redémarrez le dashboard.')
            await self.check_session()
            await self.report()
            return True
        except (DeliveryError, RuntimeError) as exc:
            self.connected = False
            self.error = self.explain(exc)
            await self.report()
            return False

    async def observe(self, message):
        if not self.enabled or not self.outbox or not self.association:
            return
        kind = message['type']
        if kind not in ('scenario', 'end', 'idle', 'error', 'model'):
            return
        if kind == 'scenario':
            # Each Play/scenario is a new episode scope; retries keep their original IDs.
            self.scope = str(uuid.uuid4())
            self.started = datetime.now(timezone.utc)
            self.active = True
            self.completed.clear()
            self.statuses = {model: 'WARMING_UP' for model in MODEL_TYPES}
        elif kind in ('end', 'idle'):
            self.active = False
            self.statuses = {model: 'UNAVAILABLE' for model in MODEL_TYPES}
        elif kind == 'error':
            self.statuses = {model: 'ERROR' for model in MODEL_TYPES}
        elif kind == 'model' and self.active and not self.blocked:
            model, score = message['model'], message['p']
            if model not in MODEL_TYPES:
                return
            valid = isinstance(score, (int, float)) and not isinstance(score, bool) and math.isfinite(score) and 0 <= score <= 1
            self.statuses[model] = 'READY' if valid else 'ERROR'
            self.completed[model] = time.monotonic()
            if valid:
                captured = datetime.now(timezone.utc)
                def payload(event_id):
                    return {'clientEventId': event_id, 'type': MODEL_TYPES[model],
                            'detectedAt': utc(captured), 'confidence': float(score),
                            'ai': {'schemaVersion': 1, 'associationId': self.association,
                                   'episodeId': event_id, 'inputKind': 'REPLAY', 'model': model,
                                   'modelSha256': self.manifest[model]['sha256'],
                                   'featureVersion': '1', 'decisionVersion': '1',
                                   'windowStartAt': utc(max(self.started, captured - timedelta(seconds=60 if model == 'Cardiac' else 5))),
                                   'windowEndAt': utc(captured)}}
                try:
                    self.outbox.observe(f'{self.association}:{self.scope}:{model}', bool(message['alarm']), payload)
                except (RuntimeError, ValueError) as exc:
                    self.error = str(exc)
        await self.report()

    async def heartbeat(self):
        for model, completed in self.completed.items():
            if self.active and time.monotonic() - completed > (40 if model == 'Stroke' else 25):
                self.statuses[model] = 'DEGRADED'
        response = await asyncio.to_thread(self.client.request, 'POST', '/device/ai/heartbeat', {
            'associationId': self.association, 'runtimeVersion': '0.2.0', 'bootId': self.boot_id,
            'queueDepth': self.outbox.depth, **{model.lower(): state for model, state in self.statuses.items()},
        })
        if response.get('associationId') != self.association or not response.get('paired'):
            self.blocked = True
            raise RuntimeError('Association modifiée. Reconfigurez le boîtier avant de poursuivre.')

    async def deliver(self):
        heartbeat_at = 0
        try:
            while True:
                if self.blocked:
                    await asyncio.sleep(1)
                    continue
                try:
                    if time.monotonic() - heartbeat_at >= 15:
                        await self.check_session()
                        await self.heartbeat()
                        heartbeat_at = time.monotonic()
                    if self.connected:
                        await self.outbox.deliver_one_async(self.client, self.association)
                    if self.outbox.quarantined:
                        self.error = 'Des événements ont été refusés par l’API. Vérifiez le boîtier et son association.'
                except (DeliveryError, RuntimeError) as exc:
                    self.connected = False
                    self.error = self.explain(exc)
                    heartbeat_at = time.monotonic()
                    if isinstance(exc, DeliveryError) and exc.permanent:
                        self.blocked = True
                await self.report()
                await asyncio.sleep(0.25)
        except asyncio.CancelledError:
            pass

    async def close(self):
        if self.task:
            self.task.cancel()
            await self.task
        if self.client and self.outbox and self.association and not self.blocked:
            self.statuses = {model: 'UNAVAILABLE' for model in MODEL_TYPES}
            try:
                await self.heartbeat()
            except (DeliveryError, RuntimeError):
                pass
        if self.outbox:
            self.outbox.close()
