import { Box, Flex, HStack, Text } from "@chakra-ui/react";
import { WalletButton } from "@vechain/vechain-kit";
import { Logo } from "../Logo";

export const Navbar = () => {
  return (
    <Box
      as="header"
      position="sticky"
      top={0}
      zIndex={50}
      borderBottom="1px solid"
      borderColor="border.subtle"
      bg="rgba(5, 7, 15, 0.85)"
      backdropFilter="blur(2px)"
      _light={{ bg: "rgba(247, 249, 252, 0.92)" }}
    >
      <Flex
        maxW="1200px"
        mx="auto"
        px={{ base: 4, md: 8 }}
        py={3}
        align="center"
        justify="space-between"
      >
        <HStack gap={3}>
          <Logo size="40px" />
          <Box>
            <Text
              textStyle={{ base: "sm", md: "md" }}
              fontWeight={700}
              letterSpacing="-0.02em"
              lineHeight="1.1"
            >
              Smart Accounts
            </Text>
            <Text
              textStyle="xs"
              color="text.muted"
              fontWeight={500}
              letterSpacing="0.04em"
            >
              on VeChain
            </Text>
          </Box>
        </HStack>

        <HStack gap={3}>
          <WalletButton mobileVariant="icon" connectionVariant="popover" />
        </HStack>
      </Flex>
    </Box>
  );
};
