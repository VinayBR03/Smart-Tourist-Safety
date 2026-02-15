import React, { useState } from 'react';
import { X, MapPin, Clock, User, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { getStatusColor } from '../constants/theme';

const IncidentDetailModal = ({ incident, onClose, onStatusUpdate }) => {
  const [updating, setUpdating] = useState(false);

  const handleStatusChange = async (newStatus) => {
    if (window.confirm(`Change status to "${newStatus}"?`)) {
      setUpdating(true);
      try {
        await onStatusUpdate(incident.id, newStatus);
      } catch (error) {
        alert('Failed to update: ' + error.message);
      } finally {
        setUpdating(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Incident #{incident.id}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <div className="flex gap-2">
              {['open', 'in_progress', 'resolved'].map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  disabled={updating || incident.status === status}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    incident.status === status
                      ? 'bg-opacity-100'
                      : 'bg-opacity-50 hover:bg-opacity-75'
                  } disabled:cursor-not-allowed`}
                  style={{
                    backgroundColor: getStatusColor(status),
                    color: 'white',
                  }}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-900">{incident.description}</p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <User size={16} />
                <span>Tourist ID</span>
              </div>
              <p className="font-semibold text-gray-900">{incident.tourist_id}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <Clock size={16} />
                <span>Reported</span>
              </div>
              <p className="font-semibold text-gray-900">
                {format(new Date(incident.created_at), 'MMM dd, yyyy HH:mm')}
              </p>
            </div>
          </div>

          {/* Location */}
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <MapPin size={16} />
              <span>Location</span>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-mono text-sm text-gray-900">
                Latitude: {incident.latitude.toFixed(6)}
              </p>
              <p className="font-mono text-sm text-gray-900">
                Longitude: {incident.longitude.toFixed(6)}
              </p>
              <a
                href={`https://www.google.com/maps?q=${incident.latitude},${incident.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
              >
                Open in Google Maps →
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncidentDetailModal;