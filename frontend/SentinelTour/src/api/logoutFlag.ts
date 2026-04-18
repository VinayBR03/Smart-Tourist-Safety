// src/api/logoutFlag.ts
//
// A tiny, dependency-free module that owns the "logout in progress" flag.
// Keeping it here breaks the require cycle:
//
//   client.ts → authStore.ts → locationService.ts → location.ts → client.ts
//
// Both client.ts and authStore.ts can import from this leaf without
// introducing any new edges in the dependency graph.

let _isLoggingOut = false;

export const logoutFlag = {
  get isLoggingOut(): boolean {
    return _isLoggingOut;
  },
  set(value: boolean): void {
    _isLoggingOut = value;
  },
};