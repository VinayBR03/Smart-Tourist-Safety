// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HealthAlertLedger {
    struct HealthAlert {
        uint256 touristId;
        uint256 deviceId;
        string  alertType;
        uint256 heartRate;
        uint256 spo2;
        uint256 bodyTemperature;
        uint256 timestamp;
        bytes32 dataHash;
    }

    HealthAlert[] public alerts;

    event HealthAlertTriggered(
        uint256 indexed touristId,
        uint256 deviceId,
        string  alertType,
        uint256 heartRate,
        uint256 spo2,
        uint256 bodyTemperature,
        uint256 timestamp,
        bytes32 dataHash
    );

    function logAlert(
        uint256 _touristId,
        uint256 _deviceId,
        string  memory _alertType,
        uint256 _heartRate,
        uint256 _spo2,
        uint256 _bodyTemperature,
        bytes32 _dataHash
    ) external {
        alerts.push(HealthAlert({
            touristId:       _touristId,
            deviceId:        _deviceId,
            alertType:       _alertType,
            heartRate:       _heartRate,
            spo2:            _spo2,
            bodyTemperature: _bodyTemperature,
            timestamp:       block.timestamp,
            dataHash:        _dataHash
        }));
        emit HealthAlertTriggered(
            _touristId, _deviceId, _alertType,
            _heartRate, _spo2, _bodyTemperature,
            block.timestamp, _dataHash
        );
    }

    function getRecord(uint256 index) external view returns (HealthAlert memory) {
        return alerts[index];
    }

    function total() external view returns (uint256) {
        return alerts.length;
    }
}