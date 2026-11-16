"""Bounded SQLite queue and episode state, committed before network delivery."""
import json
import asyncio
import os
import random
import sqlite3
import time
import uuid
from pathlib import Path

from .client import DeliveryError, encode_body


class Outbox:
    def __init__(self, path, max_entries=10000):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS deliveries (
                id TEXT PRIMARY KEY, body TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending',
                attempts INTEGER NOT NULL DEFAULT 0, next_at REAL NOT NULL DEFAULT 0,
                created_at REAL NOT NULL, failure_status INTEGER
            );
            CREATE TABLE IF NOT EXISTS episodes (
                scope TEXT PRIMARY KEY, event_id TEXT NOT NULL, quiet INTEGER NOT NULL DEFAULT 0
            );
        """)
        self.max_entries = max_entries
        if os.name != "nt":
            os.chmod(path, 0o600)

    def enqueue(self, payload):
        body = encode_body(payload).decode()
        with self.db:
            existing = self.db.execute("SELECT body FROM deliveries WHERE id=?", (payload["clientEventId"],)).fetchone()
            if existing:
                if existing[0] != body:
                    raise ValueError("An event ID cannot identify a different payload")
                return
            # Keep metadata bounded, including quarantined failures and delivered receipts.
            self.db.execute("DELETE FROM deliveries WHERE state='sent' AND created_at < ?", (time.time() - 86400,))
            if self.db.execute("SELECT COUNT(*) FROM deliveries").fetchone()[0] >= self.max_entries:
                raise RuntimeError("Gateway outbox full: delivery coverage is degraded")
            self.db.execute("INSERT INTO deliveries(id,body,created_at) VALUES(?,?,?)",
                            (payload["clientEventId"], body, time.time()))

    def observe(self, scope, alarm, build_payload):
        """One immutable event per alarm episode; re-arm after three clear model windows.

        Persist episode and payload in one transaction so restart cannot create a duplicate.
        Scope includes association and model, keeping simultaneous alarms independent.
        """
        with self.db:
            row = self.db.execute("SELECT event_id,quiet FROM episodes WHERE scope=?", (scope,)).fetchone()
            if not alarm:
                if row:
                    if row[1] + 1 >= 3:
                        self.db.execute("DELETE FROM episodes WHERE scope=?", (scope,))
                    else:
                        self.db.execute("UPDATE episodes SET quiet=quiet+1 WHERE scope=?", (scope,))
                return False
            if row:
                self.db.execute("UPDATE episodes SET quiet=0 WHERE scope=?", (scope,))
                return False
            event_id = str(uuid.uuid4())
            payload = build_payload(event_id)
            if self.db.execute("SELECT COUNT(*) FROM deliveries").fetchone()[0] >= self.max_entries:
                raise RuntimeError("Gateway outbox full: delivery coverage is degraded")
            self.db.execute("INSERT INTO deliveries(id,body,created_at) VALUES(?,?,?)",
                            (event_id, encode_body(payload).decode(), time.time()))
            self.db.execute("INSERT INTO episodes(scope,event_id) VALUES(?,?)", (scope, event_id))
            return True

    @property
    def depth(self):
        return self.db.execute("SELECT COUNT(*) FROM deliveries WHERE state='pending'").fetchone()[0]

    def deliver_one(self, client, association_id, now=None):
        now = time.time() if now is None else now
        row = self.db.execute("SELECT id,body,attempts FROM deliveries WHERE state='pending' AND next_at<=? ORDER BY created_at LIMIT 1", (now,)).fetchone()
        if not row:
            return False
        event_id, body, attempts = row
        payload = json.loads(body)
        try:
            if payload["ai"]["associationId"] != association_id:
                raise DeliveryError(409)
            receipt = client.request("POST", "/device/ai/events", payload)
            if not receipt.get("eventId") or receipt.get("processingMode") not in ("REPLAY", "DELAYED", "ACTIVE"):
                raise DeliveryError(502)
        except DeliveryError as exc:
            delay = exc.retry_after if exc.retry_after is not None else min(2 ** min(attempts + 1, 8), 300) * random.uniform(0.8, 1.2)
            with self.db:
                self.db.execute("UPDATE deliveries SET state=?,attempts=attempts+1,next_at=?,failure_status=? WHERE id=?",
                                ("quarantined" if exc.permanent else "pending", now + delay, exc.status, event_id))
        else:
            with self.db:
                self.db.execute("UPDATE deliveries SET state='sent',body='{}' WHERE id=?", (event_id,))
        return True

    async def deliver_one_async(self, client, association_id, now=None):
        """Use the same queue semantics without blocking the signal/event loop on HTTP."""
        now = time.time() if now is None else now
        row = self.db.execute("SELECT id,body,attempts FROM deliveries WHERE state='pending' AND next_at<=? ORDER BY created_at LIMIT 1", (now,)).fetchone()
        if not row:
            return False
        event_id, body, attempts = row
        payload = json.loads(body)
        try:
            if payload['ai']['associationId'] != association_id:
                raise DeliveryError(409)
            receipt = await asyncio.to_thread(client.request, 'POST', '/device/ai/events', payload)
            if not receipt.get('eventId') or receipt.get('processingMode') not in ('REPLAY', 'DELAYED', 'ACTIVE'):
                raise DeliveryError(502)
        except DeliveryError as exc:
            delay = exc.retry_after if exc.retry_after is not None else min(2 ** min(attempts + 1, 8), 300) * random.uniform(0.8, 1.2)
            with self.db:
                self.db.execute("UPDATE deliveries SET state=?,attempts=attempts+1,next_at=?,failure_status=? WHERE id=?",
                                ('quarantined' if exc.permanent else 'pending', now + delay, exc.status, event_id))
        else:
            with self.db:
                self.db.execute("UPDATE deliveries SET state='sent',body='{}' WHERE id=?", (event_id,))
        return True

    @property
    def quarantined(self):
        return self.db.execute("SELECT COUNT(*) FROM deliveries WHERE state='quarantined'").fetchone()[0]

    def close(self):
        self.db.close()
