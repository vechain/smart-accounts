import {
  Box,
  Heading,
  HStack,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { motion } from "framer-motion";

const MotionBox = motion(Box);

export const Hero = () => {
  const gradient = useColorModeValue(
    "linear-gradient(120deg, #08C9AC 0%, #7B3FE4 100%)",
    "linear-gradient(120deg, #3DEFC9 0%, #A78BFA 100%)"
  );

  return (
    <Box position="relative" py={{ base: 8, md: 12 }} textAlign="center">
      <MotionBox
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <VStack spacing={5} maxW="780px" mx="auto">
          <HStack
            spacing={2}
            px={3}
            py={1.5}
            rounded="full"
            border="1px solid"
            borderColor="border.brand"
            bg="rgba(19,229,197,0.06)"
          >
            <Box
              boxSize="6px"
              rounded="full"
              bg="brand.400"
              boxShadow="0 0 8px rgba(19,229,197,0.8)"
            />
            <Text
              fontSize="xs"
              fontWeight={600}
              letterSpacing="0.08em"
              textTransform="uppercase"
              color="brand.300"
              _light={{ color: "brand.600" }}
            >
              Account Abstraction · Live on VeChain
            </Text>
          </HStack>

          <Heading
            as="h1"
            fontSize={{ base: "4xl", md: "6xl" }}
            fontWeight={800}
            letterSpacing="-0.04em"
            lineHeight="1.05"
          >
            Smart Accounts,
            <Box as="span" display="block" bgGradient={gradient} bgClip="text">
              made simple.
            </Box>
          </Heading>

          <Text
            fontSize={{ base: "md", md: "lg" }}
            color="text.muted"
            maxW="580px"
            lineHeight="1.6"
          >
            A simplified, gas-efficient account abstraction pattern for
            VeChain — built for social login, batch transactions and a
            seamless on-chain UX.
          </Text>
        </VStack>
      </MotionBox>
    </Box>
  );
};
