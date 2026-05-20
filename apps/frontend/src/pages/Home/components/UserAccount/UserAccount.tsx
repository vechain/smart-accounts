import {
  Box,
  Card,
  CardBody,
  Divider,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
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
    <Card
      w="full"
      transition="all 0.25s ease"
      _hover={{
        transform: "translateY(-2px)",
        borderColor: "border.brand",
      }}
    >
      <CardBody p={6}>
        <VStack align="stretch" spacing={5}>
          <NetworkBadge env={env} />

          <Box>
            <Text
              fontSize="xs"
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

          <Divider />

          <HStack justify="space-between">
            <Text fontSize="sm" color="text.muted" fontWeight={500}>
              Status
            </Text>
            <HStack spacing={2}>
              <Box
                as={isAccountDeployed ? FaCheckCircle : FaCircleXmark}
                color={isAccountDeployed ? "brand.400" : "text.subtle"}
                boxSize="14px"
              />
              <Text
                fontSize="sm"
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
            <Text fontSize="sm" color="text.muted" fontWeight={500}>
              Version
            </Text>
            <Box
              px={2.5}
              py={0.5}
              rounded="md"
              bg="whiteAlpha.100"
              _light={{ bg: "blackAlpha.50" }}
              border="1px solid"
              borderColor="border.subtle"
            >
              <Text
                fontSize="xs"
                fontFamily="mono"
                fontWeight={600}
                color="text.secondary"
              >
                {accountVersion ? `v${accountVersion}` : "—"}
              </Text>
            </Box>
          </HStack>
        </VStack>
      </CardBody>
    </Card>
  );
};
