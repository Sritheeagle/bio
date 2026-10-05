from typing import Optional
from backend.app.config import QUEUE_TYPE, SQS_ECG_QUEUE_URL, SQS_PROTEIN_QUEUE_URL
from backend.app.adapters.queue.base import QueueAdapter
from backend.app.adapters.queue.local import LocalQueueAdapter
from backend.app.adapters.queue.sqs import SQSQueueAdapter

_queue_adapter: Optional[QueueAdapter] = None


def get_queue_adapter() -> QueueAdapter:
    global _queue_adapter
    if _queue_adapter is None:
        if QUEUE_TYPE == "sqs" and (SQS_ECG_QUEUE_URL or SQS_PROTEIN_QUEUE_URL):
            _queue_adapter = SQSQueueAdapter()
        else:
            _queue_adapter = LocalQueueAdapter()
    return _queue_adapter


def set_queue_adapter(adapter: Optional[QueueAdapter]) -> None:
    """Set or reset the active queue adapter (useful for test isolation)."""
    global _queue_adapter
    _queue_adapter = adapter

