import expoConfig from "eslint-config-expo/flat.js"
import react from "eslint-plugin-react"
import * as tseslint from "typescript-eslint"

export default tseslint.config(
  // 1. Global Ignores for Expo build folders
  { 
    ignores: [
      "dist/*",
      ".expo/*",
      "ios/*",
      "android/*",
      "web-build/*"
    ] 
  },
  
  // 2. Load the official Expo Flat Config settings
  ...expoConfig,

  // 3. Custom rules for your TypeScript React Native project
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    plugins: {
      react,
      // Map the TypeScript plugin explicitly so its rules are recognized
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      // Use the TypeScript parser for type-aware linting
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // Disables older web-only rules that conflict with React Native environments
      "react/react-in-jsx-scope": "off", 
      "react/jsx-uses-react": "off",
      
      // Clean up handling of unused parameters/variables safely
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    },
  }
)
