# app/services/analytics_service.py

from sqlalchemy import select, func, case
from sqlalchemy.orm import Session

from app.models.incident import Incident
from app.models.zone_status import ZoneStatus
from app.models.iot_device import IoTDevice


# =========================================================
# INCIDENT TREND (Mon–Sun)
# =========================================================

def get_incident_trend(db: Session):

    stmt = (
        select(
            func.to_char(Incident.created_at, "Dy").label("day"),
            func.count(Incident.id).label("count")
        )
        .group_by(func.to_char(Incident.created_at, "Dy"))
        .order_by(func.min(Incident.created_at))
    )

    rows = db.execute(stmt).all()

    return [
        {
            "day":   r.day,
            "count": r.count,
        }
        for r in rows
    ]


# =========================================================
# INCIDENT STATUS DISTRIBUTION
# =========================================================

def get_incident_status_counts(db: Session):

    stmt = (
        select(
            Incident.status,
            func.count(Incident.id),
        )
        .group_by(Incident.status)
    )

    rows = db.execute(stmt).all()

    return {
        str(status): count
        for status, count in rows
    }


# =========================================================
# ZONE RISK DISTRIBUTION
# =========================================================

def get_zone_risk_counts(db: Session):

    stmt = (
        select(
            ZoneStatus.risk_level,
            func.count(ZoneStatus.zone_id),
        )
        .group_by(ZoneStatus.risk_level)
    )

    rows = db.execute(stmt).all()

    return {
        str(level): count
        for level, count in rows
    }


# =========================================================
# DEVICE HEALTH STATUS
# =========================================================

def get_device_status_counts(db: Session):

    stmt = (
        select(
            IoTDevice.status,
            func.count(IoTDevice.id),
        )
        .where(IoTDevice.is_deleted == False)  # noqa: E712
        .group_by(IoTDevice.status)
    )

    rows = db.execute(stmt).all()

    return {
        str(status): count
        for status, count in rows
    }


# =========================================================
# DEVICE BATTERY DISTRIBUTION
# =========================================================

def get_device_battery_distribution(db: Session):

    battery_range = case(
        (IoTDevice.battery_percentage < 20,  "0-20"),
        (IoTDevice.battery_percentage < 50,  "20-50"),
        (IoTDevice.battery_percentage < 80,  "50-80"),
        else_="80-100",
    )

    stmt = (
        select(
            battery_range.label("range"),
            func.count(IoTDevice.id),
        )
        .where(IoTDevice.battery_percentage.isnot(None))
        .group_by(battery_range)
    )

    rows = db.execute(stmt).all()

    return [
        {
            "range": r.range,
            "count": r.count,
        }
        for r in rows
    ]