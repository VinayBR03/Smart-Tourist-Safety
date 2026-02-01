from fastapi import APIRouter
from app.services.geofence_service import is_outside_geofence

router = APIRouter()

@router.post("/check")
def check_geofence(
    latitude: float,
    longitude: float
):
    # Example fixed zone (airport / city center)
    outside = is_outside_geofence(
        latitude,
        longitude,
        center_lat=12.9716,
        center_lng=77.5946
    )
    return {"outside_geofence": outside}
