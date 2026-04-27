// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AssignmentLedger {
    struct AssignmentEntry {
        uint256 incidentId;
        uint256 assignedTo;
        uint256 assignedBy;
        string  action;
        uint256 timestamp;
        bytes32 dataHash;
    }

    AssignmentEntry[] public history;

    event AssignmentChanged(
        uint256 indexed incidentId,
        uint256 assignedTo,
        uint256 assignedBy,
        string  action,
        uint256 timestamp,
        bytes32 dataHash
    );

    function logAssignment(
        uint256 _incidentId,
        uint256 _assignedTo,
        uint256 _assignedBy,
        string  memory _action,
        bytes32 _dataHash
    ) external {
        history.push(AssignmentEntry({
            incidentId: _incidentId,
            assignedTo: _assignedTo,
            assignedBy: _assignedBy,
            action:     _action,
            timestamp:  block.timestamp,
            dataHash:   _dataHash
        }));
        emit AssignmentChanged(
            _incidentId, _assignedTo, _assignedBy,
            _action, block.timestamp, _dataHash
        );
    }

    function getRecord(uint256 index) external view returns (AssignmentEntry memory) {
        return history[index];
    }

    function total() external view returns (uint256) {
        return history.length;
    }
}