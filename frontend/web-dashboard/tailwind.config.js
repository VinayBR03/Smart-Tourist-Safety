/** @type {import('tailwindcss').Config} */

export default {

  darkMode: "class",

  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {

    container: {
      center: true,
      padding: "1.5rem",
    },

    extend: {

      /* ========================================
         COLORS
         ======================================== */

      colors: {

        primary: {
          DEFAULT: "#2563EB",
          dark: "#1E40AF",
          light: "#3B82F6"
        },

        success: "#16A34A",
        warning: "#F59E0B",
        danger: "#DC2626",

        background: "#F8FAFC",
        card: "#FFFFFF",

        sidebar: "#0F172A",

        text: {
          primary: "#0F172A",
          secondary: "#475569",
        },

        border: "#E2E8F0",
      },


      /* ========================================
         FONT FAMILY
         ======================================== */

      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "sans-serif"
        ],
      },


      /* ========================================
         FONT SIZE SCALE
         ======================================== */

      fontSize: {

        xs: ["12px", "16px"],
        sm: ["14px", "20px"],
        base: ["16px", "24px"],
        lg: ["18px", "26px"],
        xl: ["20px", "28px"],
        "2xl": ["24px", "32px"],
        "3xl": ["30px", "38px"],
        "4xl": ["36px", "42px"],
      },


      /* ========================================
         BOX SHADOWS (Dashboard cards)
         ======================================== */

      boxShadow: {

        sm: "0 1px 2px rgba(0,0,0,0.05)",

        md: "0 4px 10px rgba(0,0,0,0.08)",

        lg: "0 10px 25px rgba(0,0,0,0.12)",

        card: "0 2px 8px rgba(0,0,0,0.06)",

        floating: "0 12px 32px rgba(0,0,0,0.15)"
      },


      /* ========================================
         BORDER RADIUS
         ======================================== */

      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "18px"
      },


      /* ========================================
         SPACING SCALE
         ======================================== */

      spacing: {
        18: "4.5rem",
        22: "5.5rem",
        26: "6.5rem",
        30: "7.5rem"
      },


      /* ========================================
         GRADIENT BACKGROUNDS
         ======================================== */

      backgroundImage: {

        "gradient-primary":
          "linear-gradient(135deg,#2563EB,#1D4ED8)",

        "gradient-danger":
          "linear-gradient(135deg,#EF4444,#DC2626)",

        "gradient-success":
          "linear-gradient(135deg,#22C55E,#16A34A)"
      },


      /* ========================================
         ANIMATIONS
         ======================================== */

      keyframes: {

        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 }
        },

        slideUp: {
          "0%": {
            opacity: 0,
            transform: "translateY(10px)"
          },
          "100%": {
            opacity: 1,
            transform: "translateY(0)"
          }
        },

        pulseSlow: {
          "0%,100%": { opacity: 1 },
          "50%": { opacity: 0.6 }
        }

      },


      animation: {

        fadeIn: "fadeIn 0.3s ease",

        slideUp: "slideUp 0.3s ease",

        pulseSlow: "pulseSlow 2s infinite"
      },


      /* ========================================
         GRID LAYOUTS
         ======================================== */

      gridTemplateColumns: {

        dashboard: "260px 1fr",

        analytics: "2fr 1fr",

        cards: "repeat(auto-fill,minmax(260px,1fr))"
      }
    }
  },

  plugins: [],
};