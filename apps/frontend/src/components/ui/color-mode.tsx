import { ClientOnly, IconButton, Skeleton, Span } from "@chakra-ui/react";
import type { IconButtonProps, SpanProps } from "@chakra-ui/react";
import { ThemeProvider, useTheme } from "next-themes";
import type { ThemeProviderProps } from "next-themes";
import * as React from "react";
import { FaMoon, FaSun } from "react-icons/fa";

export type ColorModeProviderProps = ThemeProviderProps;

export const ColorModeProvider = (props: ColorModeProviderProps) => (
  <ThemeProvider attribute="class" disableTransitionOnChange {...props} />
);

export type ColorMode = "light" | "dark";

export interface UseColorModeReturn {
  colorMode: ColorMode;
  setColorMode: (colorMode: ColorMode) => void;
  toggleColorMode: () => void;
}

export const useColorMode = (): UseColorModeReturn => {
  const { resolvedTheme, setTheme, forcedTheme } = useTheme();
  const colorMode = (forcedTheme || resolvedTheme) as ColorMode;
  return {
    colorMode,
    setColorMode: setTheme as (value: ColorMode) => void,
    toggleColorMode: () =>
      setTheme(resolvedTheme === "dark" ? "light" : "dark"),
  };
};

export const useColorModeValue = <T,>(light: T, dark: T): T => {
  const { colorMode } = useColorMode();
  // Default theme is "dark" — treat undefined (pre-hydration) as dark so
  // first-paint values match the eventual theme.
  return colorMode === "light" ? light : dark;
};

export const ColorModeIcon = () => {
  const { colorMode } = useColorMode();
  return colorMode === "light" ? <FaMoon /> : <FaSun />;
};

type ColorModeButtonProps = Omit<IconButtonProps, "aria-label">;

export const ColorModeButton = React.forwardRef<
  HTMLButtonElement,
  ColorModeButtonProps
>(function ColorModeButton(props, ref) {
  const { toggleColorMode } = useColorMode();
  return (
    <ClientOnly fallback={<Skeleton boxSize="8" />}>
      <IconButton
        onClick={toggleColorMode}
        variant="ghost"
        aria-label="Toggle color mode"
        size="sm"
        ref={ref}
        {...props}
      >
        <ColorModeIcon />
      </IconButton>
    </ClientOnly>
  );
});

export const LightMode = React.forwardRef<HTMLSpanElement, SpanProps>(
  function LightMode(props, ref) {
    return (
      <Span
        color="fg"
        display="contents"
        className="chakra-theme light"
        colorPalette="gray"
        ref={ref}
        {...props}
      />
    );
  }
);

export const DarkMode = React.forwardRef<HTMLSpanElement, SpanProps>(
  function DarkMode(props, ref) {
    return (
      <Span
        color="fg"
        display="contents"
        className="chakra-theme dark"
        colorPalette="gray"
        ref={ref}
        {...props}
      />
    );
  }
);
