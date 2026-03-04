# tests/conftest.py

import pytest
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

class DummyModel:
    metadata = {
        "model_version": "v1",
        "model_type": "dummy"
    }

    def predict(self, features):
        return {"risk_score": 0.65, "risk_level": "MEDIUM"}


@pytest.fixture
def dummy_model():
    return DummyModel()