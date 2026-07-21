import json
import hashlib
from pathlib import Path

_BLOCKCHAIN_ENABLED = False
_account = None
w3 = None
ADDRESSES = {}

try:
    from web3 import Web3

    _blockchain_dir = Path(__file__).resolve().parents[3] / "blockchain"
    _addresses_file = _blockchain_dir / "deployed_addresses.json"

    if _addresses_file.exists():
        with open(_addresses_file) as f:
            raw_addresses = json.load(f)

        ADDRESSES = {
            name: Web3.to_checksum_address(addr)
            for name, addr in raw_addresses.items()
        }

        w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:8545"))

        def _load_abi(contract_name: str) -> list:
            p = _blockchain_dir / f"artifacts/contracts/{contract_name}.sol/{contract_name}.json"
            with open(p) as f:
                return json.load(f)["abi"]

        def _get_contract(name: str):
            return w3.eth.contract(address=ADDRESSES[name], abi=_load_abi(name))

        _account = w3.eth.accounts[0]
        _BLOCKCHAIN_ENABLED = True

except Exception as e:
    print(f"[blockchain] Disabled: {e}")


def _hash(data: dict) -> bytes:
    raw = json.dumps(data, sort_keys=True, default=str).encode()
    return hashlib.sha256(raw).digest()


def _send(fn) -> str:
    try:
        tx = fn.transact({"from": _account})
        w3.eth.wait_for_transaction_receipt(tx)
        return tx.hex()
    except Exception as e:
        return f"blockchain_error:{str(e)}"


def _disabled() -> str:
    return "blockchain_disabled"


# ── Incident Status ───────────────────────────────────────
def log_incident_status(incident_id: int, old_status: str, new_status: str, changed_by: int, extra: dict = {}) -> str:
    if not _BLOCKCHAIN_ENABLED:
        return _disabled()
    dh = _hash({"incident_id": incident_id, "old": old_status, "new": new_status, "by": changed_by, **extra})
    return _send(_get_contract("IncidentLedger").functions.logStatusChange(
        incident_id, old_status or "", new_status, changed_by or 0, dh
    ))


# ── Zone Risk ─────────────────────────────────────────────
def log_zone_risk(zone_id: int, old_level: str, new_level: str, risk_score: float, source: str, extra: dict = {}) -> str:
    if not _BLOCKCHAIN_ENABLED:
        return _disabled()
    dh = _hash({"zone_id": zone_id, "old": old_level, "new": new_level, "score": risk_score, **extra})
    return _send(_get_contract("ZoneLedger").functions.logRiskChange(
        zone_id, old_level or "", new_level, int(risk_score * 100), source, dh
    ))


# ── Audit ─────────────────────────────────────────────────
def log_audit(user_id: int, action: str, entity_type: str, entity_id: int, extra: dict = {}) -> str:
    if not _BLOCKCHAIN_ENABLED:
        return _disabled()
    dh = _hash({"user": user_id, "action": action, "entity": entity_type, "id": entity_id, **extra})
    return _send(_get_contract("AuditLedger").functions.logAction(
        user_id or 0, action, entity_type, entity_id or 0, dh
    ))


# ── Assignment ────────────────────────────────────────────
def log_assignment(incident_id: int, assigned_to: int, assigned_by: int, action: str, extra: dict = {}) -> str:
    if not _BLOCKCHAIN_ENABLED:
        return _disabled()
    dh = _hash({"incident": incident_id, "to": assigned_to, "by": assigned_by, "action": action, **extra})
    return _send(_get_contract("AssignmentLedger").functions.logAssignment(
        incident_id, assigned_to or 0, assigned_by or 0, action, dh
    ))


# ── Health Alert ──────────────────────────────────────────
def log_health_alert(tourist_id: int, device_id: int, alert_type: str, heart_rate: float, spo2: float, body_temperature: float, extra: dict = {}) -> str:
    if not _BLOCKCHAIN_ENABLED:
        return _disabled()
    dh = _hash({"tourist": tourist_id, "device": device_id, "alert": alert_type,
                 "hr": heart_rate, "spo2": spo2 or 0, "temp": body_temperature or 0, **extra})
    return _send(_get_contract("HealthAlertLedger").functions.logAlert(
        tourist_id,
        device_id or 0,
        alert_type,
        int(heart_rate or 0),
        int((spo2 or 0) * 10),
        int((body_temperature or 0) * 10),
        dh
    ))


# ── Evidence (Media) ──────────────────────────────────────
def log_evidence(incident_id: int, uploaded_by: int, media_type: str, storage_key: str, extra: dict = {}) -> str:
    if not _BLOCKCHAIN_ENABLED:
        return _disabled()
    file_hash = hashlib.sha256(storage_key.encode()).digest()
    dh = _hash({"incident": incident_id, "by": uploaded_by, "type": media_type, "key": storage_key, **extra})
    return _send(_get_contract("EvidenceLedger").functions.logEvidence(
        incident_id or 0, uploaded_by or 0, media_type, storage_key, file_hash, dh
    ))