from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.location_event import LocationEvent


def aggregate_zone_features(
    db: Session,
    zone_id: int,
    window_minutes: int = 10
) -> dict:
    """
    Aggregate raw location events into ML-ready features.
    """

    result = (
        db.query(
            func.count(LocationEvent.id).label("event_count"),
            func.avg(LocationEvent.rssi).label("avg_rssi"),
        )
        .filter(LocationEvent.zone_id == zone_id)
        .all()
    )

    event_count, avg_rssi = result[0]

    return {
        "zone_id": zone_id,
        "event_count": event_count or 0,
        "avg_rssi": avg_rssi or 0.0,
    }
