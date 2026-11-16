"""Each model runs in its own helper process.

Why: computing the cardiac features takes about 200 ms, as long as one streaming step.
In a separate process a model never delays the live stream (the page never freezes),
and the 3 models can compute at the same time on different CPU cores.

Each helper process keeps ONE detector (with its memory: alarm counters, seizure history),
and handles the calls one after the other, in the order they were sent.
"""
import asyncio
import os
from concurrent.futures import ProcessPoolExecutor

MODELS = ("Cardiac", "Seizure", "Stroke")

# ---- inside the helper process
_kind = None
_detector = None


def _init(kind):
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    import warnings
    warnings.filterwarnings("ignore")
    global _kind
    _kind = kind
    _reset()


def _reset():
    """New detector = empty memory, at the start of each scenario."""
    global _detector
    from pipeline.detectors import DETECTORS
    _detector = DETECTORS[_kind]()
    return True


def _step(*args):
    return _detector.step(*args)


def _warm_up():
    """The first MFCC call compiles code (several seconds): done at start-up, not during the demo."""
    import numpy as np
    if _kind == "Stroke":
        from pipeline import stroke_features as stf
        stf.f_mfcc(0.1 * np.random.default_rng(0).standard_normal(16000), 16000)
    d = _detector
    files = [d.file] + ([d.type_file] if hasattr(d, "type_file") else [])
    return {"model": _kind, "files": files, "rule": d.rule, "threshold": d.thr}


# ---- in the server process
class ModelWorker:
    def __init__(self, kind):
        self.kind = kind
        self.pool = ProcessPoolExecutor(max_workers=1, initializer=_init, initargs=(kind,))

    async def _call(self, fn, *args):
        return await asyncio.get_running_loop().run_in_executor(self.pool, fn, *args)

    async def step(self, *args):
        return await self._call(_step, *args)

    async def reset(self):
        return await self._call(_reset)

    async def warm_up(self):
        return await self._call(_warm_up)

    def close(self):
        self.pool.shutdown(wait=False, cancel_futures=True)


async def start_workers():
    """Starts the 3 helper processes, loads the models, returns (workers, model info)."""
    workers = {k: ModelWorker(k) for k in MODELS}
    infos = await asyncio.gather(*(w.warm_up() for w in workers.values()))
    return workers, list(infos)
