import React from 'react';
import { User, Phone, AlertCircle } from 'lucide-react';

const TouristCard = ({ tourist, onClick }) => {
  return (
    <div
      onClick={() => onClick(tourist)}
      className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className="p-3 bg-blue-100 rounded-full">
          <User className="text-blue-600" size={24} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">
            {tourist.full_name || 'Unknown Tourist'}
          </h3>
          <p className="text-sm text-gray-600">{tourist.email}</p>

          {tourist.phone && (
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
              <Phone size={14} />
              <span>{tourist.phone}</span>
            </div>
          )}

          {tourist.emergency_contact && (
            <div className="flex items-center gap-2 mt-1 text-sm text-green-600">
              <AlertCircle size={14} />
              <span>Emergency: {tourist.emergency_contact}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TouristCard;