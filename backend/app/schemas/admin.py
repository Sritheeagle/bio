from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class UserAdminUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ModelVersionUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    status: Optional[str] = None
    description: Optional[str] = None


class ModelVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workflow_type: str
    name: str
    version: str
    status: str
    description: Optional[str]
    is_enabled: bool
    config_json: Optional[str]
    created_at: datetime

