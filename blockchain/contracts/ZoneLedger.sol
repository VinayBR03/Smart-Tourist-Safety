// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ZoneLedger {
    struct RiskChange {
        uint256 zoneId;
        string  oldRiskLevel;
        string  newRiskLevel;
        uint256 riskScore;
        string  source;
        uint256 timestamp;
        bytes32 dataHash;
    }

    RiskChange[] public history;

    event ZoneRiskChanged(
        uint256 indexed zoneId,
        string  oldRiskLevel,
        string  newRiskLevel,
        uint256 riskScore,
        string  source,
        uint256 timestamp,
        bytes32 dataHash
    );

    function logRiskChange(
        uint256 _zoneId,
        string  memory _oldRiskLevel,
        string  memory _newRiskLevel,
        uint256 _riskScore,
        string  memory _source,
        bytes32 _dataHash
    ) external {
        history.push(RiskChange({
            zoneId:       _zoneId,
            oldRiskLevel: _oldRiskLevel,
            newRiskLevel: _newRiskLevel,
            riskScore:    _riskScore,
            source:       _source,
            timestamp:    block.timestamp,
            dataHash:     _dataHash
        }));
        emit ZoneRiskChanged(
            _zoneId, _oldRiskLevel, _newRiskLevel,
            _riskScore, _source, block.timestamp, _dataHash
        );
    }

    function getRecord(uint256 index) external view returns (RiskChange memory) {
        return history[index];
    }

    function total() external view returns (uint256) {
        return history.length;
    }
}