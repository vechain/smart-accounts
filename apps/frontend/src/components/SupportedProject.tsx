import { Box, HStack, Image, Link, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import CleanifyLogo from "../assets/cleanify.png";
import MugshotLogo from "../assets/mugshot.png";
import EVEarnLogo from "../assets/evearn.png";
import GreenCartLogo from "../assets/greencart.png";
import VeChainLogo from "../assets/vechain.png";

export interface SupportedProjectProps {
  href: string;
  logo: string;
  name: string;
}

export const SupportedProject = () => {
  const projects = [
    { href: "https://cleanify.vet", logo: CleanifyLogo, name: "Cleanify" },
    { href: "https://mugshot.vet", logo: MugshotLogo, name: "Mugshot" },
    { href: "https://evearn.io", logo: EVEarnLogo, name: "EVEarn" },
    { href: "https://greencart.ai", logo: GreenCartLogo, name: "GreenCart" },
    { href: "https://www.vechain.org", logo: VeChainLogo, name: "VeChain" },
  ];

  return (
    <VStack align="stretch" gap={6}>
      <Text color="text.muted" textStyle="sm" textAlign="center">
        Projects already building on Smart Accounts.
      </Text>

      {/* Mobile: horizontal swipe with snap points */}
      <VStack
        display={{ base: "flex", sm: "none" }}
        align="stretch"
        gap={2}
        position="relative"
      >
        <HStack
          gap={3}
          overflowX="auto"
          scrollSnapType="x mandatory"
          mr={-4}
          pl={6}
          pr={10}
          pb={1}
          css={{
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {projects.map((project) => (
            <Box
              key={project.name}
              flexShrink={0}
              w="140px"
              scrollSnapAlign="start"
            >
              <SupportedProjectItem {...project} />
            </Box>
          ))}
        </HStack>

        {/* Right-edge fade — visual hint that content extends past the viewport */}
        <Box
          position="absolute"
          top={0}
          bottom={4}
          right={-4}
          w="48px"
          pointerEvents="none"
          bgImage="linear-gradient(to left, rgba(5,7,15,0.95), transparent)"
          _light={{
            bgImage:
              "linear-gradient(to left, rgba(247,249,252,0.95), transparent)",
          }}
        />

        <HStack justify="center" gap={1.5} pt={1}>
          <Text
            textStyle="2xs"
            color="text.subtle"
            letterSpacing="0.08em"
            textTransform="uppercase"
            fontWeight={500}
          >
            Swipe to see more
          </Text>
          <Box
            as="span"
            color="text.subtle"
            css={{
              animation: "nudge 1.4s ease-in-out infinite",
              "@keyframes nudge": {
                "0%, 100%": { transform: "translateX(0)" },
                "50%": { transform: "translateX(3px)" },
              },
            }}
          >
            →
          </Box>
        </HStack>
      </VStack>

      {/* Tablet and up: 5-column grid */}
      <SimpleGrid
        display={{ base: "none", sm: "grid" }}
        columns={5}
        gap={{ base: 4, md: 6 }}
      >
        {projects.map((project) => (
          <SupportedProjectItem key={project.name} {...project} />
        ))}
      </SimpleGrid>
    </VStack>
  );
};

const SupportedProjectItem = ({ href, logo, name }: SupportedProjectProps) => {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      display="block"
      w="full"
      _hover={{ textDecoration: "none" }}
      role="group"
    >
      <VStack
        gap={3}
        p={4}
        rounded="2xl"
        border="1px solid"
        borderColor="border.subtle"
        bg="bg.surface"
        transition="all 0.25s ease"
        _hover={{
          borderColor: "border.brand",
          transform: "translateY(-3px)",
          bg: "bg.surface.hover",
        }}
      >
        <Image
          src={logo}
          alt={`${name} logo`}
          boxSize="64px"
          objectFit="contain"
          rounded="xl"
          transition="transform 0.25s ease"
          _groupHover={{ transform: "scale(1.06)" }}
        />
        <Text
          textStyle="xs"
          fontWeight={600}
          color="text.secondary"
          letterSpacing="-0.01em"
        >
          {name}
        </Text>
      </VStack>
    </Link>
  );
};
