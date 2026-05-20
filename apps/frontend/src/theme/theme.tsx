import {
  ThemeConfig,
  extendTheme,
  type StyleFunctionProps,
} from "@chakra-ui/react";
import { mode } from "@chakra-ui/theme-tools";

const themeConfig: ThemeConfig = {
  useSystemColorMode: false,
  disableTransitionOnChange: false,
  initialColorMode: "dark",
  cssVarPrefix: "chakra",
};

const colors = {
  brand: {
    50: "#E6FFFB",
    100: "#B3FFF1",
    200: "#82F2DE",
    300: "#3DEFC9",
    400: "#13E5C5",
    500: "#08C9AC",
    600: "#02A38B",
    700: "#017A67",
    800: "#005245",
    900: "#002C25",
  },
  accent: {
    50: "#F5F3FF",
    100: "#EDE9FE",
    200: "#DDD6FE",
    300: "#C4B5FD",
    400: "#A78BFA",
    500: "#8B5CF6",
    600: "#7B3FE4",
    700: "#6D28D9",
    800: "#5B21B6",
    900: "#4C1D95",
  },
  ink: {
    900: "#05070F",
    800: "#0A0E1A",
    700: "#11172A",
    600: "#1A2238",
    500: "#252E48",
    400: "#3A4565",
  },
};

const theme = extendTheme({
  ...themeConfig,
  colors,
  fonts: {
    heading: `'Inter', system-ui, -apple-system, sans-serif`,
    body: `'Inter', system-ui, -apple-system, sans-serif`,
    mono: `'JetBrains Mono', ui-monospace, SFMono-Regular, monospace`,
  },
  semanticTokens: {
    colors: {
      "bg.canvas": { _light: "#F7F9FC", _dark: "#05070F" },
      "bg.surface": {
        _light: "rgba(255,255,255,0.7)",
        _dark: "rgba(255,255,255,0.03)",
      },
      "bg.surface.raised": {
        _light: "white",
        _dark: "rgba(255,255,255,0.05)",
      },
      "bg.surface.hover": {
        _light: "rgba(255,255,255,0.95)",
        _dark: "rgba(255,255,255,0.07)",
      },
      "border.subtle": {
        _light: "rgba(15,23,42,0.08)",
        _dark: "rgba(255,255,255,0.08)",
      },
      "border.muted": {
        _light: "rgba(15,23,42,0.14)",
        _dark: "rgba(255,255,255,0.14)",
      },
      "border.brand": {
        _light: "rgba(19,229,197,0.4)",
        _dark: "rgba(19,229,197,0.35)",
      },
      "text.primary": { _light: "gray.900", _dark: "whiteAlpha.900" },
      "text.secondary": { _light: "gray.700", _dark: "whiteAlpha.800" },
      "text.muted": { _light: "gray.600", _dark: "whiteAlpha.600" },
      "text.subtle": { _light: "gray.500", _dark: "whiteAlpha.500" },
    },
  },
  styles: {
    global: (props: StyleFunctionProps) => ({
      "html, body, #root": {
        height: "100%",
      },
      body: {
        bg: mode("#F7F9FC", "#05070F")(props),
        color: mode("gray.800", "whiteAlpha.900")(props),
        backgroundImage: mode(
          "radial-gradient(900px circle at 10% -10%, rgba(19,229,197,0.18) 0%, transparent 55%), radial-gradient(900px circle at 100% 20%, rgba(123,63,228,0.12) 0%, transparent 55%)",
          "radial-gradient(900px circle at 10% -10%, rgba(19,229,197,0.18) 0%, transparent 50%), radial-gradient(900px circle at 90% 20%, rgba(123,63,228,0.22) 0%, transparent 50%), radial-gradient(700px circle at 50% 100%, rgba(19,229,197,0.08) 0%, transparent 60%)"
        )(props),
        backgroundAttachment: "fixed",
        fontFeatureSettings: '"cv02", "cv03", "cv04", "cv11"',
      },
      "::selection": {
        bg: "brand.400",
        color: "ink.900",
      },
    }),
  },
  components: {
    Card: {
      baseStyle: (props: StyleFunctionProps) => ({
        container: {
          bg: mode("rgba(255,255,255,0.65)", "rgba(255,255,255,0.03)")(props),
          backdropFilter: "blur(20px) saturate(140%)",
          border: "1px solid",
          borderColor: mode(
            "rgba(15,23,42,0.08)",
            "rgba(255,255,255,0.08)"
          )(props),
          borderRadius: "2xl",
          boxShadow: mode(
            "0 1px 2px rgba(15,23,42,0.04), 0 12px 32px -12px rgba(15,23,42,0.08)",
            "0 1px 2px rgba(0,0,0,0.4), 0 12px 32px -8px rgba(0,0,0,0.4)"
          )(props),
          transition: "border-color 0.2s ease, transform 0.2s ease",
        },
      }),
      variants: {
        outline: (props: StyleFunctionProps) => ({
          container: {
            bg: mode("rgba(255,255,255,0.6)", "rgba(255,255,255,0.025)")(props),
          },
        }),
        glow: (props: StyleFunctionProps) => ({
          container: {
            bg: mode("white", "rgba(255,255,255,0.04)")(props),
            borderColor: mode(
              "rgba(19,229,197,0.4)",
              "rgba(19,229,197,0.3)"
            )(props),
            boxShadow: mode(
              "0 0 0 1px rgba(19,229,197,0.15), 0 12px 40px -8px rgba(19,229,197,0.2)",
              "0 0 0 1px rgba(19,229,197,0.2), 0 12px 40px -8px rgba(19,229,197,0.25)"
            )(props),
          },
        }),
      },
    },
    Heading: {
      baseStyle: {
        letterSpacing: "-0.02em",
        fontWeight: 700,
      },
    },
    Button: {
      baseStyle: {
        fontWeight: 600,
        borderRadius: "xl",
        letterSpacing: "-0.01em",
      },
      variants: {
        brand: () => ({
          bg: "brand.400",
          color: "ink.900",
          _hover: {
            bg: "brand.300",
            transform: "translateY(-1px)",
            boxShadow: "0 8px 24px -8px rgba(19,229,197,0.5)",
          },
          _active: { bg: "brand.500", transform: "translateY(0)" },
          transition: "all 0.2s ease",
        }),
        ghost: (props: StyleFunctionProps) => ({
          _hover: {
            bg: mode(
              "rgba(15,23,42,0.04)",
              "rgba(255,255,255,0.06)"
            )(props),
          },
        }),
      },
    },
    Link: {
      baseStyle: {
        color: "brand.400",
        _hover: { color: "brand.300", textDecoration: "none" },
        transition: "color 0.15s ease",
      },
    },
    Divider: {
      baseStyle: {
        borderColor: "border.subtle",
        opacity: 1,
      },
    },
  },
});

export { theme };
