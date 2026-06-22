// HeroUI v2 Tailwind v4 plugin export (CSS-first approach; no tailwind.config.js needed).
//
// Calm, neutral light theme — the run's single source of taste lives in
// docs/runs/2026-06-22-heroui-calm-redesign/design-system.md. We lean into stock
// HeroUI: a soft warm off-white canvas, white surfaces, a desaturated slate-blue
// accent (replacing the loud indigo), muted status colors, gentle radii, and
// barely-there shadows. HeroUI emits the light theme under `:root,[data-theme=light]`,
// so these values apply globally even though the app also sets data-theme="vapor".
import { heroui } from "@heroui/react";

export default heroui({
  themes: {
    light: {
      colors: {
        // Canvas & surfaces
        background: "#F7F7F6", // soft warm off-white app canvas
        content1: "#FFFFFF", // cards / surfaces
        content2: "#F3F3F2",
        content3: "#EBEBEA",
        content4: "#E2E2E0",

        // Text
        foreground: {
          DEFAULT: "#1A1A19", // soft near-black
          foreground: "#FFFFFF",
        },

        // Hairlines
        divider: "rgba(0,0,0,0.08)",

        // Neutral / default scale (quiet grays)
        default: {
          50: "#F7F7F6",
          100: "#EFEFEE",
          200: "#E2E2E0",
          300: "#D2D2CF",
          400: "#A8A8A4",
          500: "#6B7280", // muted text
          600: "#52525B",
          700: "#3F3F46",
          800: "#27272A",
          900: "#18181B",
          DEFAULT: "#E2E2E0",
          foreground: "#1A1A19",
        },

        // Calm accent — desaturated slate-blue (replaces #5b5bd6 indigo)
        primary: {
          50: "#EEF2F6",
          100: "#D7E0E9",
          200: "#B6C7D6",
          300: "#92ABC0",
          400: "#6E8DA6",
          500: "#4E6E8E",
          600: "#42607E",
          700: "#374E66",
          800: "#2B3C4E",
          900: "#1F2B38",
          DEFAULT: "#4E6E8E",
          foreground: "#FFFFFF",
        },

        // Muted status colors (low saturation)
        success: {
          50: "#ECF5F1",
          100: "#D2E8DF",
          200: "#A6D1BE",
          300: "#79B99D",
          400: "#5AA384",
          500: "#3F8F6F", // muted sage
          600: "#347A5E",
          700: "#2A614B",
          800: "#1F4838",
          900: "#143025",
          DEFAULT: "#3F8F6F",
          foreground: "#FFFFFF",
        },
        warning: {
          50: "#FAF3E6",
          100: "#F2E2C2",
          200: "#E6C788",
          300: "#D9AC4F",
          400: "#C99633",
          500: "#B7791F", // muted amber
          600: "#9C661A",
          700: "#7C5115",
          800: "#5C3C0F",
          900: "#3C270A",
          DEFAULT: "#B7791F",
          foreground: "#FFFFFF",
        },
        danger: {
          50: "#F8ECEB",
          100: "#EFD2CF",
          200: "#DFA6A1",
          300: "#CF7A72",
          400: "#C5645B",
          500: "#C2554D", // muted terracotta
          600: "#A64841",
          700: "#853A34",
          800: "#632B27",
          900: "#421D1A",
          DEFAULT: "#C2554D",
          foreground: "#FFFFFF",
        },

        // Focus ring = primary
        focus: "#4E6E8E",
      },
      layout: {
        radius: {
          small: "8px",
          medium: "12px",
          large: "16px",
        },
        // Barely-there shadows for a calm surface separation.
        boxShadow: {
          small: "0px 1px 2px 0px rgb(0 0 0 / 0.04), 0px 1px 3px 0px rgb(0 0 0 / 0.05)",
          medium: "0px 2px 8px 0px rgb(0 0 0 / 0.05), 0px 1px 3px 0px rgb(0 0 0 / 0.04)",
          large: "0px 8px 24px 0px rgb(0 0 0 / 0.07), 0px 2px 6px 0px rgb(0 0 0 / 0.05)",
        },
      },
    },
  },
});
