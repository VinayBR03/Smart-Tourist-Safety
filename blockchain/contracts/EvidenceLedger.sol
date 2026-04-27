// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EvidenceLedger {
    struct EvidenceEntry {
        uint256 incidentId;
        uint256 uploadedBy;
        string  mediaType;
        string  storageKey;
        bytes32 fileHash;
        uint256 timestamp;
        bytes32 dataHash;
    }

    EvidenceEntry[] public evidence;

    event EvidenceLogged(
        uint256 indexed incidentId,
        uint256 uploadedBy,
        string  mediaType,
        string  storageKey,
        bytes32 fileHash,
        uint256 timestamp,
        bytes32 dataHash
    );

    function logEvidence(
        uint256 _incidentId,
        uint256 _uploadedBy,
        string  memory _mediaType,
        string  memory _storageKey,
        bytes32 _fileHash,
        bytes32 _dataHash
    ) external {
        evidence.push(EvidenceEntry({
            incidentId: _incidentId,
            uploadedBy: _uploadedBy,
            mediaType:  _mediaType,
            storageKey: _storageKey,
            fileHash:   _fileHash,
            timestamp:  block.timestamp,
            dataHash:   _dataHash
        }));
        emit EvidenceLogged(
            _incidentId, _uploadedBy, _mediaType,
            _storageKey, _fileHash, block.timestamp, _dataHash
        );
    }

    function getRecord(uint256 index) external view returns (EvidenceEntry memory) {
        return evidence[index];
    }

    function total() external view returns (uint256) {
        return evidence.length;
    }
}