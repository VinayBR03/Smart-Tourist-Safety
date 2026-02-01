import os
import pathlib

def create_project_structure():
    # Define the root directory name
    root_dir = "frontend"

    # Define the structure as a nested dictionary
    # Keys are folder/file names. 
    # Values are dictionaries for subdirectories, or None for files.
    project_structure = {
  "name": "react-native-app",
  "type": "directory",
  "children": [
    {
      "name": "android",
      "type": "directory",
      "children": [
        {
          "name": "app",
          "type": "directory",
          "children": [
            {
              "name": "src",
              "type": "directory",
              "children": [
                {
                  "name": "main",
                  "type": "directory",
                  "children": [
                    {
                      "name": "AndroidManifest.xml",
                      "type": "file"
                    },
                    {
                      "name": "java",
                      "type": "directory",
                      "children": [
                        {
                          "name": "com",
                          "type": "directory",
                          "children": [
                            {
                              "name": "touristsafety",
                              "type": "directory",
                              "children": [
                                {
                                  "name": "app",
                                  "type": "directory",
                                  "children": [
                                    { "name": "MainActivity.java", "type": "file" },
                                    { "name": "MainApplication.java", "type": "file" }
                                  ]
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    },
                    {
                      "name": "res",
                      "type": "directory",
                      "children": [
                        { "name": "drawable", "type": "directory" },
                        { "name": "mipmap-hdpi", "type": "directory" },
                        { "name": "mipmap-mdpi", "type": "directory" },
                        { "name": "mipmap-xhdpi", "type": "directory" },
                        { "name": "mipmap-xxhdpi", "type": "directory" },
                        { "name": "mipmap-xxxhdpi", "type": "directory" },
                        {
                          "name": "values",
                          "type": "directory",
                          "children": [
                            { "name": "styles.xml", "type": "file" },
                            { "name": "colors.xml", "type": "file" }
                          ]
                        }
                      ]
                    }
                  ]
                },
                { "name": "debug", "type": "directory" },
                { "name": "release", "type": "directory" }
              ]
            },
            { "name": "build.gradle", "type": "file" },
            { "name": "google-services.json", "type": "file" }
          ]
        },
        {
          "name": "gradle",
          "type": "directory",
          "children": [
            {
              "name": "wrapper",
              "type": "directory",
              "children": [
                { "name": "gradle-wrapper.jar", "type": "file" },
                { "name": "gradle-wrapper.properties", "type": "file" }
              ]
            }
          ]
        },
        { "name": "build.gradle", "type": "file" },
        { "name": "gradle.properties", "type": "file" },
        { "name": "settings.gradle", "type": "file" }
      ]
    },
    {
      "name": "ios",
      "type": "directory",
      "children": [
        {
          "name": "TouristSafetyApp",
          "type": "directory",
          "children": [
            { "name": "AppDelegate.h", "type": "file" },
            { "name": "AppDelegate.m", "type": "file" },
            { "name": "Info.plist", "type": "file" },
            { "name": "main.m", "type": "file" },
            {
              "name": "Images.xcassets",
              "type": "directory",
              "children": [
                {
                  "name": "AppIcon.appiconset",
                  "type": "directory"
                }
              ]
            }
          ]
        },
        { "name": "TouristSafetyApp.xcodeproj", "type": "file" },
        { "name": "TouristSafetyApp.xcworkspace", "type": "file" },
        { "name": "Podfile", "type": "file" },
        { "name": "Podfile.lock", "type": "file" }
      ]
    },
    {
      "name": "src",
      "type": "directory",
      "children": [
        {
          "name": "assets",
          "type": "directory",
          "children": [
            {
              "name": "images",
              "type": "directory",
              "children": [
                { "name": "login.png", "type": "file" },
                { "name": "dashboard.png", "type": "file" },
                { "name": "map_placeholder.png", "type": "file" }
              ]
            },
            {
              "name": "icons",
              "type": "directory",
              "children": [
                { "name": "sos.png", "type": "file" },
                { "name": "alert.png", "type": "file" },
                { "name": "location.png", "type": "file" }
              ]
            },
            {
              "name": "fonts",
              "type": "directory",
              "children": [
                { "name": "Poppins-Regular.ttf", "type": "file" },
                { "name": "Poppins-Bold.ttf", "type": "file" }
              ]
            }
          ]
        },
        {
          "name": "components",
          "type": "directory",
          "children": [
            {
              "name": "buttons",
              "type": "directory",
              "children": [
                { "name": "PrimaryButton.js", "type": "file" },
                { "name": "SosButton.js", "type": "file" }
              ]
            },
            {
              "name": "cards",
              "type": "directory",
              "children": [
                { "name": "IncidentCard.js", "type": "file" },
                { "name": "ZoneStatusCard.js", "type": "file" }
              ]
            },
            {
              "name": "dialogs",
              "type": "directory",
              "children": [
                { "name": "ConfirmationDialog.js", "type": "file" },
                { "name": "ErrorDialog.js", "type": "file" }
              ]
            },
            {
              "name": "loaders",
              "type": "directory",
              "children": [
                { "name": "Loader.js", "type": "file" },
                { "name": "FullScreenLoader.js", "type": "file" }
              ]
            }
          ]
        },
        {
          "name": "screens",
          "type": "directory",
          "children": [
            {
              "name": "auth",
              "type": "directory",
              "children": [
                { "name": "LoginScreen.js", "type": "file" },
                { "name": "RegisterScreen.js", "type": "file" }
              ]
            },
            {
              "name": "dashboard",
              "type": "directory",
              "children": [
                { "name": "DashboardScreen.js", "type": "file" }
              ]
            },
            {
              "name": "sos",
              "type": "directory",
              "children": [
                { "name": "SosScreen.js", "type": "file" }
              ]
            },
            {
              "name": "tracking",
              "type": "directory",
              "children": [
                { "name": "LocationTrackingScreen.js", "type": "file" }
              ]
            },
            {
              "name": "reports",
              "type": "directory",
              "children": [
                { "name": "IncidentHistoryScreen.js", "type": "file" }
              ]
            }
          ]
        },
        {
          "name": "navigation",
          "type": "directory",
          "children": [
            { "name": "AppNavigator.js", "type": "file" },
            { "name": "AuthNavigator.js", "type": "file" }
          ]
        },
        {
          "name": "services",
          "type": "directory",
          "children": [
            { "name": "apiService.js", "type": "file" },
            { "name": "authService.js", "type": "file" },
            { "name": "locationService.js", "type": "file" },
            { "name": "sosService.js", "type": "file" },
            { "name": "iotService.js", "type": "file" }
          ]
        },
        {
          "name": "state",
          "type": "directory",
          "children": [
            { "name": "store.js", "type": "file" },
            { "name": "authSlice.js", "type": "file" },
            { "name": "incidentSlice.js", "type": "file" }
          ]
        },
        {
          "name": "utils",
          "type": "directory",
          "children": [
            { "name": "constants.js", "type": "file" },
            { "name": "helpers.js", "type": "file" }
          ]
        },
        { "name": "App.js", "type": "file" }
      ]
    },
    { "name": "index.js", "type": "file" },
    { "name": "package.json", "type": "file" },
    { "name": "babel.config.js", "type": "file" },
    { "name": "metro.config.js", "type": "file" },
    { "name": ".env", "type": "file" },
    { "name": "README.md", "type": "file" }
  ]
}


    def create_items(base_path, items):
        for name, content in items.items():
            path = os.path.join(base_path, name)
            
            if isinstance(content, dict):
                # It is a directory
                try:
                    os.makedirs(path, exist_ok=True)
                    # print(f"Created directory: {path}")
                    create_items(path, content)
                except OSError as e:
                    print(f"Error creating directory {path}: {e}")
            else:
                # It is a file
                try:
                    # Create parent directory if it doesn't exist (safety check)
                    os.makedirs(os.path.dirname(path), exist_ok=True)
                    
                    # Create empty file
                    with open(path, 'w') as f:
                        pass 
                    # print(f"Created file: {path}")
                except OSError as e:
                    print(f"Error creating file {path}: {e}")

    # Start creation
    print(f"Generating project structure for '{root_dir}'...")
    
    # Create the root directory first
    try:
        os.makedirs(root_dir, exist_ok=True)
        create_items(root_dir, project_structure)
        print("\nStructure created successfully!")
        print(f"Location: {os.path.abspath(root_dir)}")
    except OSError as e:
        print(f"Error creating root directory: {e}")

if __name__ == "__main__":
    create_project_structure()
