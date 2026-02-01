from datetime import datetime
from sqlalchemy.orm import Session

from app.models.zone_status import ZoneStatus


def update_zone_status(
    db: Session,
    zone_id: int,
    risk_score: float
) -> ZoneStatus:
    """
    Store ML inference output for dashboard & alerts.
    """

    if risk_score > 0.7:
        level = "high"
    elif risk_score > 0.4:
        level = "medium"
    else:
        level = "low"

    zone = db.query(ZoneStatus).filter_by(zone_id=zone_id).first()

    if not zone:
        zone = ZoneStatus(
            zone_id=zone_id,
            risk_level=level,
            risk_score=risk_score,
            updated_at=datetime.utcnow()
        )
        db.add(zone)
    else:
        zone.risk_level = level
        zone.risk_score = risk_score
        zone.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(zone)
    return zone
