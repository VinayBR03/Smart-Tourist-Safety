// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IncidentLedger {
    struct StatusChange {
        uint256 incidentId;
        string  oldStatus;
        string  newStatus;
        uint256 changedBy;
        uint256 timestamp;
        bytes32 dataHash;
    }

    StatusChange[] public history;

    event IncidentStatusChanged(
        uint256 indexed incidentId,
        string  oldStatus,
        string  newStatus,
        uint256 changedBy,
        uint256 timestamp,
        bytes32 dataHash
    );

    function logStatusChange(
        uint256 _incidentId,
        string  memory _oldStatus,
        string  memory _newStatus,
        uint256 _changedBy,
        bytes32 _dataHash
    ) external {
        history.push(StatusChange({
            incidentId: _incidentId,
            oldStatus:  _oldStatus,
            newStatus:  _newStatus,
            changedBy:  _changedBy,
            timestamp:  block.timestamp,
            dataHash:   _dataHash
        }));
        emit IncidentStatusChanged(
            _incidentId, _oldStatus, _newStatus,
            _changedBy, block.timestamp, _dataHash
        );
    }

    function getRecord(uint256 index) external view returns (StatusChange memory) {
        return history[index];
    }

    function total() external view returns (uint256) {
        return history.length;
    }
}