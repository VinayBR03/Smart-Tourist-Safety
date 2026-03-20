# app/routers/health.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.core.enums import UserRole
from app.models.user import User
from app.models.health_telemetry import HealthTelemetry
from app.schemas.health_schema import (
    HealthTelemetryResponse,
    HealthAlertSummary,
)


router = APIRouter(
    prefix="/health",
    tags=["Health"],
)


# =========================================================
# Get my latest vitals (Tourist)
# GET /health/me
# =========================================================

@router.get(
    "/me",
    response_model=HealthTelemetryResponse,
    status_code=status.HTTP_200_OK,
)
def get_my_latest_vitals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(HealthTelemetry)
        .where(HealthTelemetry.tourist_id == current_user.id)
        .order_by(desc(HealthTelemetry.recorded_at))
        .limit(1)
    )
    record = db.execute(stmt).scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No health telemetry found",
        )

    return record


# =========================================================
# Live telemetry — latest record per active tourist
# GET /health/live
# Called by: HealthMonitoringPage via getLiveHealthTelemetry()
# =========================================================

@router.get(
    "/live",
    response_model=list[HealthTelemetryResponse],
    status_code=status.HTTP_200_OK,
)
def get_live_telemetry(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.AUTHORITY, UserRole.ADMIN)),
):
    """
    Returns the single most-recent telemetry record for every tourist.
    Uses a subquery to get the max recorded_at per tourist, then joins
    back to fetch the full row — avoids DISTINCT ON which is PostgreSQL-only
    but also works fine on Postgres.
    """
    from sqlalchemy import func

    # Subquery: max recorded_at per tourist
    subq = (
        select(
            HealthTelemetry.tourist_id,
            func.max(HealthTelemetry.recorded_at).label("latest_at"),
        )
        .group_by(HealthTelemetry.tourist_id)
        .subquery()
    )

    stmt = (
        select(HealthTelemetry)
        .join(
            subq,
            (HealthTelemetry.tourist_id == subq.c.tourist_id)
            & (HealthTelemetry.recorded_at == subq.c.latest_at),
        )
        .order_by(desc(HealthTelemetry.recorded_at))
    )

    records = db.execute(stmt).scalars().all()
    return records


# =========================================================
# Recent health alerts (Authority / Admin dashboard)
# GET /health/alerts
# Called by: HealthMonitoringPage via listHealthAlerts()
# =========================================================

@router.get(
    "/alerts",
    response_model=list[HealthAlertSummary],
    status_code=status.HTTP_200_OK,
)
def get_recent_health_alerts(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.AUTHORITY, UserRole.ADMIN)),
):
    stmt = (
        select(
            HealthTelemetry.tourist_id,
            HealthTelemetry.alert_type,
            HealthTelemetry.recorded_at,
        )
        .where(HealthTelemetry.is_alert.is_(True))
        .order_by(desc(HealthTelemetry.recorded_at))
        .limit(20)
    )
    rows = db.execute(stmt).all()

    return [
        {
            "tourist_id": r.tourist_id,
            "alert_type": r.alert_type,
            "recorded_at": r.recorded_at,
        }
        for r in rows
    ]


# =========================================================
# Get tourist vitals by ID (Authority / Admin)
# GET /health/tourist/{tourist_id}
# =========================================================

@router.get(
    "/tourist/{tourist_id}",
    response_model=HealthTelemetryResponse,
    status_code=status.HTTP_200_OK,
)
def get_tourist_latest_vitals(
    tourist_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.AUTHORITY, UserRole.ADMIN)),
):
    stmt = (
        select(HealthTelemetry)
        .where(HealthTelemetry.tourist_id == tourist_id)
        .order_by(desc(HealthTelemetry.recorded_at))
        .limit(1)
    )
    record = db.execute(stmt).scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No health telemetry found",
        )

    return record


# =========================================================
# Tourist health history (list)
# GET /tourists/{tourist_id}/health  →  handled via tourist router
# This route provides an alternate path under /health
# GET /health/tourist/{tourist_id}/history
# =========================================================

@router.get(
    "/tourist/{tourist_id}/history",
    response_model=list[HealthTelemetryResponse],
    status_code=status.HTTP_200_OK,
)
def get_tourist_health_history(
    tourist_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.AUTHORITY, UserRole.ADMIN)),
):
    stmt = (
        select(HealthTelemetry)
        .where(HealthTelemetry.tourist_id == tourist_id)
        .order_by(desc(HealthTelemetry.recorded_at))
        .limit(min(limit, 200))
    )
    return db.execute(stmt).scalars().all()