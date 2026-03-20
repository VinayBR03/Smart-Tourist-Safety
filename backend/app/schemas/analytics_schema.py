#app/schemas/analytics_schema.py

from pydantic import BaseModel
from typing import List, Dict
from datetime import date


# =========================================================
# INCIDENT TREND
# =========================================================

class IncidentTrendItem(BaseModel):
    day: str
    count: int


class IncidentTrendResponse(BaseModel):
    data: List[IncidentTrendItem]


# =========================================================
# INCIDENT STATUS DISTRIBUTION
# =========================================================

class IncidentStatusResponse(BaseModel):
    status_counts: Dict[str, int]


# =========================================================
# ZONE RISK DISTRIBUTION
# =========================================================

class ZoneRiskResponse(BaseModel):
    risk_counts: Dict[str, int]


# =========================================================
# DEVICE HEALTH STATUS
# =========================================================

class DeviceHealthResponse(BaseModel):
    status_counts: Dict[str, int]


# =========================================================
# DEVICE BATTERY DISTRIBUTION
# =========================================================

class DeviceBatteryDistributionItem(BaseModel):
    range: str
    count: int


class DeviceBatteryDistributionResponse(BaseModel):
    data: List[DeviceBatteryDistributionItem]