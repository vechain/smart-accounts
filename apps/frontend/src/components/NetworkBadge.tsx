import { Box, HStack, Text } from "@chakra-ui/react";
import type { EnvConfig } from "@repo/config/contracts";

interface NetworkBadgeProps {
  env: EnvConfig;
  size?: "sm" | "md";
}

const palette = {
  mainnet: {
    label: "Mainnet",
    dot: "#13E5C5",
    glow: "0 0 10px rgba(19,229,197,0.8)",
    bg: "rgba(19,229,197,0.08)",
    border: "rgba(19,229,197,0.35)",
    color: "#3DEFC9",
  },
  testnet: {
    label: "Testnet",
    dot: "#FBBF24",
    glow: "0 0 10px rgba(251,191,36,0.7)",
    bg: "rgba(251,191,36,0.08)",
    border: "rgba(251,191,36,0.35)",
    color: "#FCD34D",
  },
} as const;

export const NetworkBadge = ({ env, size = "sm" }: NetworkBadgeProps) => {
  const cfg = palette[env];
  const px = size === "sm" ? 2.5 : 3;
  const fontSize = size === "sm" ? "2xs" : "xs";

  return (
    <HStack
      gap={2}
      px={px}
      py={1}
      rounded="full"
      border="1px solid"
      borderColor={cfg.border}
      bg={cfg.bg}
      display="inline-flex"
      alignSelf="flex-start"
      w="fit-content"
    >
      <Box
        boxSize={size === "sm" ? "6px" : "7px"}
        rounded="full"
        bg={cfg.dot}
        boxShadow={cfg.glow}
      />
      <Text
        textStyle={fontSize}
        fontWeight={600}
        letterSpacing="0.08em"
        textTransform="uppercase"
        color={cfg.color}
      >
        {cfg.label}
      </Text>
    </HStack>
  );
};
