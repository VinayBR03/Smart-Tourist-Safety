
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func, case
from sqlalchemy.orm import Session

from app.models.incident import Incident
from app.models.zone_status import ZoneStatus
from app.models.iot_device import IoTDevice


# =========================================================
# INCIDENT TREND (Mon–Sun)
# =========================================================

def get_incident_trend(db: Session):
    """
    Calculates the number of incidents for every day that has incidents.
    The frontend chart is responsible for windowing this data into a 30-day view
    anchored to the latest incident, so we provide all available daily counts.
    Filtering by the last 30 days from `now()` here would fail if the dataset
    is historical or for a different time period (e.g., during testing).
    """

    # Use to_char to guarantee a YYYY-MM-DD string response from PostgreSQL directly
    date_col = func.to_char(Incident.created_at, "YYYY-MM-DD")

    stmt = (
        select(
            date_col.label("date"),
            func.count(Incident.id).label("count")
        )
        .where(Incident.deleted_at.is_(None))
        .group_by(date_col)
        .order_by(date_col.asc())
    )

    rows = db.execute(stmt).all()

    return [
        {"date": r.date, "count": r.count}
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
        str(status).split('.')[-1]: count
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
        str(level).split('.')[-1]: count
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
        str(status).split('.')[-1]: count
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