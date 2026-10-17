import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme/theme";
import {
  ColorModeProvider,
  type ColorModeProviderProps,
} from "./color-mode";

export const Provider = (props: ColorModeProviderProps) => (
  <ChakraProvider value={system}>
    <ColorModeProvider defaultTheme="dark" {...props} />
  </ChakraProvider>
);
