import { Box, Flex, HStack, Image, Text } from "@chakra-ui/react";
import { WalletButton } from "@vechain/vechain-kit";
import logo from "../../assets/logo.png";

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
        <HStack spacing={3}>
          <Box
            position="relative"
            boxSize="40px"
            rounded="full"
            overflow="hidden"
            boxShadow="0 0 0 1px rgba(19,229,197,0.25), 0 8px 24px -8px rgba(19,229,197,0.4)"
          >
            <Image src={logo} alt="logo" boxSize="40px" objectFit="cover" />
          </Box>
          <Box>
            <Text
              fontSize={{ base: "sm", md: "md" }}
              fontWeight={700}
              letterSpacing="-0.02em"
              lineHeight="1.1"
            >
              Smart Accounts
            </Text>
            <Text
              fontSize="xs"
              color="text.muted"
              fontWeight={500}
              letterSpacing="0.04em"
              textTransform="uppercase"
            >
              VeChain
            </Text>
          </Box>
        </HStack>

        <HStack spacing={3}>
          <WalletButton mobileVariant="icon" connectionVariant="popover" />
        </HStack>
      </Flex>
    </Box>
  );
};
