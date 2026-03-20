// src/utils/permissions.ts

import { UserRole } from '../types/enums';

export function canAccessAdmin(role: UserRole | undefined): boolean {
  return role === UserRole.ADMIN;
}

export function canAccessAuthority(role: UserRole | undefined): boolean {
  return role === UserRole.ADMIN || role === UserRole.AUTHORITY;
}

export function canManageDevices(role: UserRole | undefined): boolean {
  return role === UserRole.ADMIN;
}

export function canUpdateIncidentStatus(role: UserRole | undefined): boolean {
  return role === UserRole.ADMIN || role === UserRole.AUTHORITY;
}

export function canViewMap(role: UserRole | undefined): boolean {
  return role === UserRole.ADMIN || role === UserRole.AUTHORITY;
}

export function canViewAnalytics(role: UserRole | undefined): boolean {
  return role === UserRole.ADMIN || role === UserRole.AUTHORITY;
}

export function canManageUsers(role: UserRole | undefined): boolean {
  return role === UserRole.ADMIN;
}

export function canCreateZone(role: UserRole | undefined): boolean {
  return role === UserRole.ADMIN;
}