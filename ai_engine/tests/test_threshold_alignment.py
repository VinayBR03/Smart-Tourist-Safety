# tests/test_threshold_alignment.py

def test_threshold_boundaries():
    # Example logic — adjust if needed
    def map_level(score):
        if score < 0.4:
            return "LOW"
        elif score < 0.7:
            return "MEDIUM"
        return "HIGH"

    assert map_level(0.39) == "LOW"
    assert map_level(0.4) == "MEDIUM"
    assert map_level(0.69) == "MEDIUM"
    assert map_level(0.7) == "HIGH"