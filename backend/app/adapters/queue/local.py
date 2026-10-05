from typing import Dict, Optional
import asyncio
from backend.app.adapters.queue.base import QueueAdapter

cancellation_events: Dict[str, asyncio.Event] = {}
ecg_queue: asyncio.Queue = asyncio.Queue()
protein_queue: asyncio.Queue = asyncio.Queue()


class LocalQueueAdapter(QueueAdapter):
    async def enqueue_job(
        self, job_id: str, workflow_type: str, project_id: Optional[str] = None
    ) -> None:
        cancellation_events[job_id] = asyncio.Event()
        if workflow_type == "ecg":
            await ecg_queue.put(job_id)
        elif workflow_type == "protein":
            await protein_queue.put(job_id)
        else:
            raise ValueError(f"Unknown workflow type: {workflow_type}")

    def cancel_job(self, job_id: str) -> bool:

        if job_id in cancellation_events:
            cancellation_events[job_id].set()
            return True
        return False


def get_cancellation_event(job_id: str) -> asyncio.Event:
    if job_id not in cancellation_events:
        cancellation_events[job_id] = asyncio.Event()
    return cancellation_events[job_id]
