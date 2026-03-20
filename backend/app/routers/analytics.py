# app/routers/analytics.py

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.schemas.analytics_schema import (
    IncidentTrendResponse,
    IncidentStatusResponse,
    ZoneRiskResponse,
    DeviceHealthResponse,
    DeviceBatteryDistributionResponse,
)

from app.services.analytics_service import (
    get_incident_trend,
    get_incident_status_counts,
    get_zone_risk_counts,
    get_device_status_counts,
    get_device_battery_distribution,
)

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
)


# =========================================================
# INCIDENT TREND
# =========================================================

@router.get(
    "/incidents/trend",
    response_model=IncidentTrendResponse,
)
def incident_trend(
    db: Session = Depends(get_db),
):
    data = get_incident_trend(db)
    return {"data": data}


# =========================================================
# INCIDENT STATUS DISTRIBUTION
# =========================================================

@router.get(
    "/incidents/status",
    response_model=IncidentStatusResponse,
)
def incident_status(
    db: Session = Depends(get_db),
):
    status_counts = get_incident_status_counts(db)
    return {"status_counts": status_counts}


# =========================================================
# ZONE RISK DISTRIBUTION
# =========================================================

@router.get(
    "/zones/risk",
    response_model=ZoneRiskResponse,
)
def zone_risk(
    db: Session = Depends(get_db),
):
    risk_counts = get_zone_risk_counts(db)
    return {"risk_counts": risk_counts}


# =========================================================
# DEVICE HEALTH STATUS
# =========================================================

@router.get(
    "/devices/health",
    response_model=DeviceHealthResponse,
)
def device_health(
    db: Session = Depends(get_db),
):
    status_counts = get_device_status_counts(db)
    return {"status_counts": status_counts}


# =========================================================
# DEVICE BATTERY DISTRIBUTION
# =========================================================

@router.get(
    "/devices/battery",
    response_model=DeviceBatteryDistributionResponse,
)
def device_battery_distribution(
    db: Session = Depends(get_db),
):
    data = get_device_battery_distribution(db)
    return {"data": data}