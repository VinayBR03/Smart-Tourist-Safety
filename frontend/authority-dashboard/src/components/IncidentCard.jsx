// src/components/IncidentCard.jsx - FIXED VERSION

import React from 'react';
import { MapPin, Clock, User } from 'lucide-react';
import { getStatusColor, getStatusBadgeClass } from '../constants/theme';
import { STATUS_LABELS } from '../constants/config';
import { format } from 'date-fns';

const IncidentCard = ({ incident, onClick }) => {
  return (
    <div
      onClick={() => onClick(incident)}
      className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow cursor-pointer border-l-4"
      style={{ borderLeftColor: getStatusColor(incident.status) }}
    >
      <div className="flex justify-between items-start mb-3">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(incident.status)}`}>
          {STATUS_LABELS[incident.status] || incident.status}
        </span>
        <span className="text-sm text-gray-500">#{incident.id}</span>
      </div>

      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
        {incident.description}
      </h3>

      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <User size={14} />
          <span>Tourist ID: {incident.tourist_id}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={14} />
          <span>{incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={14} />
          <span>{format(new Date(incident.created_at), 'MMM dd, yyyy HH:mm')}</span>
        </div>
      </div>
    </div>
  );
};

export default IncidentCard;