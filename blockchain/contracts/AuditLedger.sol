// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AuditLedger {
    struct AuditEntry {
        uint256 userId;
        string  action;
        string  entityType;
        uint256 entityId;
        uint256 timestamp;
        bytes32 dataHash;
    }

    AuditEntry[] public logs;

    event AuditLogged(
        uint256 indexed userId,
        string  action,
        string  entityType,
        uint256 indexed entityId,
        uint256 timestamp,
        bytes32 dataHash
    );

    function logAction(
        uint256 _userId,
        string  memory _action,
        string  memory _entityType,
        uint256 _entityId,
        bytes32 _dataHash
    ) external {
        logs.push(AuditEntry({
            userId:     _userId,
            action:     _action,
            entityType: _entityType,
            entityId:   _entityId,
            timestamp:  block.timestamp,
            dataHash:   _dataHash
        }));
        emit AuditLogged(
            _userId, _action, _entityType,
            _entityId, block.timestamp, _dataHash
        );
    }

    function getRecord(uint256 index) external view returns (AuditEntry memory) {
        return logs[index];
    }

    function total() external view returns (uint256) {
        return logs.length;
    }
}