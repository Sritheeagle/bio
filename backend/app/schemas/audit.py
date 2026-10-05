from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: Optional[str]
    user_email: Optional[str]
    event_type: str
    target_type: Optional[str]
    target_id: Optional[str]
    details_json: Optional[str]
    ip_address: Optional[str]
    created_at: datetime

