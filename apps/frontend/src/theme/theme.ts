import {
  createSystem,
  defaultConfig,
  defineConfig,
  defineSlotRecipe,
} from "@chakra-ui/react";
import { cardAnatomy } from "@chakra-ui/react/anatomy";

const cardSlotRecipe = defineSlotRecipe({
  slots: cardAnatomy.keys(),
  base: {
    root: {
      bg: "bg.surface",
      borderWidth: "1px",
      borderColor: "border.subtle",
      borderRadius: "2xl",
      boxShadow: "card",
      transition: "border-color 0.2s ease, transform 0.2s ease",
    },
    body: { padding: "0" },
    header: { padding: "0", pb: "4" },
    footer: { padding: "0", pt: "4" },
  },
  variants: {
    variant: {
      elevated: {
        root: { bg: "bg.surface" },
      },
      outline: {
        root: { bg: "bg.surface.outline" },
      },
      glow: {
        root: {
          bg: "bg.surface.raised",
          borderColor: "border.brand",
          boxShadow: "glow",
        },
      },
    },
  },
  defaultVariants: { variant: "elevated" },
});

const config = defineConfig({
  preflight: true,
  cssVarsPrefix: "sa",
  globalCss: {
    "html, body, #root": { height: "100%" },
    body: {
      bg: "bg.canvas",
      color: "text.primary",
      fontFeatureSettings: '"cv02", "cv03", "cv04", "cv11"',
    },
    "::selection": { bg: "brand.400", color: "ink.900" },
    ":where(button, [role=button], [type=button], a)": { cursor: "pointer" },
  },
  theme: {
    tokens: {
      fonts: {
        heading: {
          value: "'Inter', system-ui, -apple-system, sans-serif",
        },
        body: { value: "'Inter', system-ui, -apple-system, sans-serif" },
        mono: {
          value: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
        },
      },
      colors: {
        brand: {
          50: { value: "#E6FFFB" },
          100: { value: "#B3FFF1" },
          200: { value: "#82F2DE" },
          300: { value: "#3DEFC9" },
          400: { value: "#13E5C5" },
          500: { value: "#08C9AC" },
          600: { value: "#02A38B" },
          700: { value: "#017A67" },
          800: { value: "#005245" },
          900: { value: "#002C25" },
        },
        accent: {
          50: { value: "#F5F3FF" },
          100: { value: "#EDE9FE" },
          200: { value: "#DDD6FE" },
          300: { value: "#C4B5FD" },
          400: { value: "#A78BFA" },
          500: { value: "#8B5CF6" },
          600: { value: "#7B3FE4" },
          700: { value: "#6D28D9" },
          800: { value: "#5B21B6" },
          900: { value: "#4C1D95" },
        },
        ink: {
          400: { value: "#3A4565" },
          500: { value: "#252E48" },
          600: { value: "#1A2238" },
          700: { value: "#11172A" },
          800: { value: "#0A0E1A" },
          900: { value: "#05070F" },
        },
      },
      shadows: {
        card: {
          value:
            "0 1px 2px rgba(15,23,42,0.04), 0 12px 32px -12px rgba(15,23,42,0.08)",
        },
        glow: {
          value:
            "0 0 0 1px rgba(19,229,197,0.2), 0 12px 40px -8px rgba(19,229,197,0.25)",
        },
      },
    },
    semanticTokens: {
      colors: {
        "bg.canvas": { value: { base: "#F7F9FC", _dark: "#05070F" } },
        "bg.surface": {
          value: {
            base: "rgba(255,255,255,0.85)",
            _dark: "rgba(17,23,42,0.55)",
          },
        },
        "bg.surface.raised": {
          value: { base: "white", _dark: "rgba(255,255,255,0.04)" },
        },
        "bg.surface.outline": {
          value: {
            base: "rgba(255,255,255,0.6)",
            _dark: "rgba(255,255,255,0.025)",
          },
        },
        "bg.surface.hover": {
          value: {
            base: "rgba(255,255,255,0.95)",
            _dark: "rgba(255,255,255,0.07)",
          },
        },
        "bg.chip": {
          value: {
            base: "rgba(15,23,42,0.06)",
            _dark: "rgba(255,255,255,0.06)",
          },
        },
        "border.subtle": {
          value: {
            base: "rgba(15,23,42,0.08)",
            _dark: "rgba(255,255,255,0.08)",
          },
        },
        "border.muted": {
          value: {
            base: "rgba(15,23,42,0.14)",
            _dark: "rgba(255,255,255,0.14)",
          },
        },
        "border.brand": {
          value: {
            base: "rgba(19,229,197,0.4)",
            _dark: "rgba(19,229,197,0.35)",
          },
        },
        "text.primary": { value: { base: "{colors.gray.900}", _dark: "rgba(255,255,255,0.92)" } },
        "text.secondary": { value: { base: "{colors.gray.700}", _dark: "rgba(255,255,255,0.78)" } },
        "text.muted": { value: { base: "{colors.gray.600}", _dark: "rgba(255,255,255,0.58)" } },
        "text.subtle": { value: { base: "{colors.gray.500}", _dark: "rgba(255,255,255,0.42)" } },
        "graph.v3": { value: { base: "{colors.brand.500}", _dark: "{colors.brand.400}" } },
        "graph.upgraded": {
          value: { base: "{colors.accent.500}", _dark: "{colors.accent.400}" },
        },
        "graph.v1": {
          value: { base: "#F59E0B", _dark: "#FBBF24" },
        },
        "graph.grid": {
          value: {
            base: "rgba(15,23,42,0.08)",
            _dark: "rgba(255,255,255,0.06)",
          },
        },
        "graph.axis": {
          value: {
            base: "rgba(15,23,42,0.5)",
            _dark: "rgba(255,255,255,0.5)",
          },
        },
      },
    },
    slotRecipes: {
      card: cardSlotRecipe,
    },
  },
});

export const system = createSystem(defaultConfig, config);
