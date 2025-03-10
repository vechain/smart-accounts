import { Card, CardBody, HStack, Text, VStack } from "@chakra-ui/react";
import { EnvConfig } from "@repo/config/contracts";
import { AddressButtonGhostVariant } from "../../../../components";
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
    <Card w={"full"}>
      <CardBody>
        <VStack spacing={4}>
          <HStack w="full" justify={"space-between"}>
            <Text fontSize="md" wordBreak={"break-word"} fontWeight={600}>
              Address
            </Text>
            <AddressButtonGhostVariant address={smartAccountAddress ?? ""} />
          </HStack>

          <HStack w="full" justify={"space-between"}>
            <Text fontSize="md" wordBreak={"break-word"} fontWeight={600}>
              Network
            </Text>
            <Text fontSize="md">
              {env === "mainnet" ? "Mainnet" : "Testnet"}
            </Text>
          </HStack>

          <VStack w="full" justify={"space-between"}>
            <HStack w="full" justify={"space-between"}>
              <Text fontSize="md" wordBreak={"break-word"} fontWeight={600}>
                Deployed
              </Text>
              <Text fontSize="md">{isAccountDeployed ? "Yes" : "No"}</Text>
            </HStack>
            <HStack w="full" justify={"space-between"}>
              <Text fontSize="md" wordBreak={"break-word"} fontWeight={600}>
                Version
              </Text>
              <Text fontSize="md">{accountVersion}</Text>
            </HStack>
          </VStack>
        </VStack>
      </CardBody>
    </Card>
  );
};
