// src/screens/MyReportsScreen.tsx
// Tourist - My Reports (Correct numbering + Filters + Timeline)

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import incidentService from '../services/incidentService';
import { Incident } from '../types';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../constants/config';

type Props = NativeStackScreenProps<any, 'MyReports'>;

type SortOrder = 'latest' | 'oldest';
type ViewMode = 'card' | 'timeline';
type StatusFilter = 'all' | 'pending' | 'in_progress' | 'resolved';

export default function MyReportsScreen({ navigation }: Props) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [sortOrder, setSortOrder] = useState<SortOrder>('latest');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await incidentService.getMyIncidents();
      setIncidents(data);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  };

  /**
   * 1️⃣ Always compute chronological order FIRST
   * Oldest → Latest (this defines incident numbers)
   */
  const chronologicalIncidents = useMemo(() => {
    return [...incidents].reverse(); // backend gives latest first
  }, [incidents]);

  /**
   * 2️⃣ Apply status filter
   */
  const filteredIncidents = useMemo(() => {
    if (statusFilter === 'all') return chronologicalIncidents;
    return chronologicalIncidents.filter(
      (i) => i.status === statusFilter
    );
  }, [chronologicalIncidents, statusFilter]);

  /**
   * 3️⃣ Apply sort for display only
   */
  const displayIncidents = useMemo(() => {
    return sortOrder === 'latest'
      ? [...filteredIncidents].reverse()
      : filteredIncidents;
  }, [filteredIncidents, sortOrder]);

  /**
   * Render Incident
   */
  const renderIncident = ({
    item,
    index,
  }: {
    item: Incident;
    index: number;
  }) => {
    // Correct incident number (chronological)
    const incidentNumber =
      chronologicalIncidents.findIndex((i) => i.id === item.id) + 1;

    return (
      <View style={viewMode === 'card' ? styles.card : styles.timelineItem}>
        {/* Timeline indicator */}
        {viewMode === 'timeline' && (
          <View style={styles.timelineDot} />
        )}

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.incidentTitle}>
              Incident {incidentNumber}
            </Text>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    incidentService.getStatusColor(item.status),
                },
              ]}
            >
              <Text style={styles.statusText}>
                {incidentService.getStatusText(item.status)}
              </Text>
            </View>
          </View>

          <Text style={styles.description}>{item.description}</Text>

          <Text style={styles.metaText}>
            📍 {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
          </Text>
          <Text style={styles.metaText}>
            🕒 {incidentService.formatIncidentDate(item)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Controls */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() =>
            setSortOrder(sortOrder === 'latest' ? 'oldest' : 'latest')
          }
        >
          <Text style={styles.controlText}>
            {sortOrder === 'latest' ? 'Latest First' : 'Oldest First'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={() =>
            setViewMode(viewMode === 'card' ? 'timeline' : 'card')
          }
        >
          <Text style={styles.controlText}>
            {viewMode === 'card' ? 'Timeline View' : 'Card View'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status Filters */}
      <View style={styles.filterRow}>
        {['all', 'open', 'in_progress', 'resolved'].map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.filterChip,
              statusFilter === s && styles.filterChipActive,
            ]}
            onPress={() => setStatusFilter(s as StatusFilter)}
          >
            <Text
              style={[
                styles.filterText,
                statusFilter === s && styles.filterTextActive,
              ]}
            >
              {s.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {displayIncidents.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>No reports found</Text>
        </View>
      ) : (
        <FlatList
          data={displayIncidents}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderIncident}
          contentContainerStyle={{ padding: SPACING.md }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: SPACING.md, color: COLORS.textSecondary },

  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },

  controlButton: {
    backgroundColor: COLORS.surface,
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
  },

  controlText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
  },

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },

  filterChip: {
    paddingVertical: 4,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  filterChipActive: {
    backgroundColor: COLORS.primary,
  },

  filterText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
  },

  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },

  timelineItem: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },

  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginTop: 12,
    marginRight: SPACING.md,
  },

  cardContent: { flex: 1 },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },

  incidentTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },

  statusText: {
    color: '#FFF',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  description: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },

  metaText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
  },
});
