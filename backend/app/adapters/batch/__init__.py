from typing import Optional
from backend.app.adapters.batch.aws_batch import AWSBatchAdapter

_batch_adapter: Optional[AWSBatchAdapter] = None


def get_batch_adapter() -> AWSBatchAdapter:
    global _batch_adapter
    if _batch_adapter is None:
        _batch_adapter = AWSBatchAdapter()
    return _batch_adapter
