import { Box, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  rightSlot?: ReactNode;
}

export const SectionHeading = ({
  eyebrow,
  title,
  description,
  rightSlot,
}: SectionHeadingProps) => (
  <HStack
    align={{ base: "flex-start", md: "center" }}
    justify="space-between"
    gap={4}
    flexDir={{ base: "column", md: "row" }}
  >
    <VStack align="flex-start" gap={1}>
      {eyebrow && (
        <Text
          textStyle="xs"
          fontWeight={600}
          letterSpacing="0.12em"
          textTransform="uppercase"
          color="brand.300"
          _light={{ color: "brand.600" }}
        >
          {eyebrow}
        </Text>
      )}
      <Heading
        fontSize={{ base: "2xl", md: "3xl" }}
        letterSpacing="-0.03em"
        fontWeight={700}
      >
        {title}
      </Heading>
      {description && (
        <Text color="text.muted" textStyle="sm" maxW="640px">
          {description}
        </Text>
      )}
    </VStack>
    {rightSlot && <Box>{rightSlot}</Box>}
  </HStack>
);
