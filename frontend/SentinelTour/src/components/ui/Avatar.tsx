import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors, Radius } from '@/constants/theme';

interface AvatarProps {
  name?: string | null;
  imageUri?: string | null;
  size?: number;
}

function getInitials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFromName(name?: string | null): string {
  const colors = [
    '#3B82F6', '#8B5CF6', '#EC4899', '#10B981',
    '#F59E0B', '#06B6D4', '#EF4444', '#6366F1',
  ];
  if (!name) return colors[0];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

export function Avatar({ name, imageUri, size = 40 }: AvatarProps) {
  const radius = size / 4;
  const fontSize = size * 0.35;
  const bg = colorFromName(name);

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: radius, backgroundColor: bg }]}>
      <Text style={[styles.initials, { fontSize }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontFamily: 'SpaceGrotesk_700Bold' },
});