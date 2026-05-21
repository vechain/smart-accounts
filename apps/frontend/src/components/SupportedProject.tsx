import { Image, Link, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import CleanifyLogo from "../assets/cleanify.png";
import MugshotLogo from "../assets/mugshot.png";
import EVEarnLogo from "../assets/evearn.png";
import GreenCartLogo from "../assets/greencart.png";
import VeChainLogo from "../assets/vechain.png";
import { SectionHeading } from "./SectionHeading";

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
      <SectionHeading
        eyebrow="Ecosystem"
        title="Supported by"
        description="Projects already building on Smart Accounts."
      />

      <SimpleGrid
        columns={{ base: 3, sm: 5 }}
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
