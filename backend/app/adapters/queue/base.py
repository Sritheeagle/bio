from abc import ABC, abstractmethod
from typing import Optional


class QueueAdapter(ABC):
    @abstractmethod
    async def enqueue_job(
        self, job_id: str, workflow_type: str, project_id: Optional[str] = None
    ) -> None:
        """Enqueue a job for execution."""
        pass

    @abstractmethod
    def cancel_job(self, job_id: str) -> bool:
        """Signal cancellation for a running or queued job."""
        pass

