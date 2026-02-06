// src/components/IncidentMapView.tsx

import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Incident } from '../types';

type Props = {
  incidents: Incident[];
};

export default function IncidentMapView({ incidents }: Props) {
  if (incidents.length === 0) return null;

  const coordinates = incidents.map(i => ({
    latitude: i.latitude,
    longitude: i.longitude,
  }));

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      initialRegion={{
        latitude: coordinates[0].latitude,
        longitude: coordinates[0].longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
    >
      {incidents.map((incident, index) => (
        <Marker
          key={incident.id}
          coordinate={{
            latitude: incident.latitude,
            longitude: incident.longitude,
          }}
          title={`Incident ${index + 1}`}
          description={incident.status}
        />
      ))}

      <Polyline
        coordinates={coordinates}
        strokeColor="#2563EB"
        strokeWidth={3}
      />
    </MapView>
  );
}
