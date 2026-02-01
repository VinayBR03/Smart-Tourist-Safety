def is_outside_geofence(
    latitude: float,
    longitude: float,
    center_lat: float,
    center_lng: float,
    radius_km: float = 2.0
) -> bool:
    from math import radians, cos, sin, sqrt, atan2

    R = 6371  # Earth radius in km

    dlat = radians(latitude - center_lat)
    dlng = radians(longitude - center_lng)

    a = sin(dlat / 2)**2 + cos(radians(center_lat)) * \
        cos(radians(latitude)) * sin(dlng / 2)**2

    distance = R * 2 * atan2(sqrt(a), sqrt(1 - a))
    return distance > radius_km
