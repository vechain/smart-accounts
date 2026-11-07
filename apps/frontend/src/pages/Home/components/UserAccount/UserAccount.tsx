import { Box, Card, HStack, Separator, Text, VStack } from "@chakra-ui/react";
import { FaCheckCircle } from "react-icons/fa";
import { FaCircleXmark } from "react-icons/fa6";
import { EnvConfig } from "@repo/config/contracts";
import {
  AddressButtonGhostVariant,
  NetworkBadge,
} from "../../../../components";
import {
  useIsAccountDeployed,
  useGetAccountAddress,
  useSmartAccountVersion,
} from "../../../../hooks";

type UserAccountProps = {
  env: EnvConfig;
  ownerAddress?: string;
  showDeployButton?: boolean;
};

export const UserAccount = ({ env, ownerAddress }: UserAccountProps) => {
  const { data: smartAccountAddress } = useGetAccountAddress(
    ownerAddress ?? "",
    env
  );
  const { data: isAccountDeployed } = useIsAccountDeployed(
    env,
    smartAccountAddress
  );
  const { data: accountVersion } = useSmartAccountVersion(
    smartAccountAddress ?? "",
    ownerAddress ?? "",
    env
  );

  if (!ownerAddress) {
    return null;
  }

  return (
    <Card.Root
      w="full"
      transition="all 0.25s ease"
      _hover={{
        transform: "translateY(-2px)",
        borderColor: "border.brand",
      }}
    >
      <Card.Body p={6}>
        <VStack align="stretch" gap={5}>
          <NetworkBadge env={env} />

          <Box>
            <Text
              textStyle="xs"
              fontWeight={600}
              letterSpacing="0.12em"
              textTransform="uppercase"
              color="text.subtle"
              mb={2}
            >
              Smart Account Address
            </Text>
            <AddressButtonGhostVariant address={smartAccountAddress ?? ""} />
          </Box>

          <Separator borderColor="border.subtle" />

          <HStack justify="space-between">
            <Text textStyle="sm" color="text.muted" fontWeight={500}>
              Status
            </Text>
            <HStack gap={2}>
              <Box
                color={isAccountDeployed ? "brand.400" : "text.subtle"}
                fontSize="14px"
                display="inline-flex"
              >
                {isAccountDeployed ? <FaCheckCircle /> : <FaCircleXmark />}
              </Box>
              <Text
                textStyle="sm"
                fontWeight={600}
                color={isAccountDeployed ? "brand.300" : "text.muted"}
                _light={{
                  color: isAccountDeployed ? "brand.600" : "text.muted",
                }}
              >
                {isAccountDeployed ? "Deployed" : "Not deployed"}
              </Text>
            </HStack>
          </HStack>

          <HStack justify="space-between">
            <Text textStyle="sm" color="text.muted" fontWeight={500}>
              Version
            </Text>
            <Box
              px={2.5}
              py={0.5}
              rounded="md"
              bg="bg.chip"
              border="1px solid"
              borderColor="border.subtle"
            >
              <Text
                textStyle="xs"
                fontFamily="mono"
                fontWeight={600}
                color="text.secondary"
              >
                {accountVersion ? `v${accountVersion}` : "—"}
              </Text>
            </Box>
          </HStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
