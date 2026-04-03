import os
from pathlib import Path

def create_project_structure():
    # Define the base structure
    # Folders end with /
    structure = [
        # App Directory (Expo Router)
        "app/_layout.tsx",
        "app/index.tsx",
        "app/(auth)/_layout.tsx",
        "app/(auth)/login.tsx",
        "app/(auth)/register.tsx",
        "app/(auth)/language-select.tsx",
        "app/(tabs)/_layout.tsx",
        "app/(tabs)/index.tsx",
        "app/(tabs)/map.tsx",
        "app/(tabs)/health.tsx",
        "app/(tabs)/sos.tsx",
        "app/(tabs)/notifications.tsx",
        "app/incidents/index.tsx",
        "app/incidents/[id].tsx",
        "app/devices/index.tsx",
        "app/profile/index.tsx",
        "app/settings/index.tsx",

        # Src Directory
        "src/api/client.ts",
        "src/api/auth.ts",
        "src/api/health.ts",
        "src/api/location.ts",
        "src/api/incidents.ts",
        "src/api/notifications.ts",
        "src/api/zones.ts",
        "src/api/devices.ts",
        "src/api/media.ts",
        
        "src/store/authStore.ts",
        "src/store/deviceStore.ts",
        "src/store/notificationStore.ts",

        "src/hooks/useAuth.ts",
        "src/hooks/useHealth.ts",
        "src/hooks/useLocation.ts",
        "src/hooks/useIncidents.ts",
        "src/hooks/useNotifications.ts",
        "src/hooks/useZones.ts",
        "src/hooks/useBluetooth.ts",

        "src/components/ui/Button.tsx",
        "src/components/ui/Card.tsx",
        "src/components/ui/Input.tsx",
        "src/components/ui/Badge.tsx",
        "src/components/ui/Avatar.tsx",
        "src/components/ui/HealthMetricCard.tsx",
        "src/components/layout/Header.tsx",
        "src/components/layout/ScreenWrapper.tsx",
        "src/components/map/ZoneOverlay.tsx",
        "src/components/map/MapSearchBar.tsx",

        "src/constants/theme.ts",
        "src/constants/config.ts",

        "src/types/api.ts",
        "src/types/auth.ts",
        "src/types/health.ts",

        "src/utils/storage.ts",
        "src/utils/websocket.ts",
        "src/utils/i18n.ts",

        "src/services/locationService.ts",
        "src/services/bluetoothService.ts",
    ]

    for path_str in structure:
        path = Path(path_str)
        # Create parent directories if they don't exist
        path.parent.mkdir(parents=True, exist_ok=True)
        # Create the file
        path.touch(exist_ok=True)
        print(f"Created: {path_str}")

if __name__ == "__main__":
    # Ensure you are in your project root before running
    create_project_structure()
    print("\n✅ Structure created successfully!")
