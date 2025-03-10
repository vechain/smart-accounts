import {
  Card,
  CardBody,
  CardHeader,
  HStack,
  Heading,
  IconButton,
  Text,
  VStack,
} from "@chakra-ui/react";
import { AddressButtonGhostVariant } from "../../../../components";
import {
  getAccountCreatedEventsQueryKey,
  useAccountCreatedEvents,
} from "../../../../hooks";
import { EnvConfig } from "@repo/config/contracts";
import { useContractVersion } from "../../../../hooks/useContractVersion";
import { FaSync } from "react-icons/fa";
import { useQueryClient } from "@tanstack/react-query";

type ContractAddressAndBalanceCardProps = {
  title: string;
  address: string;
  env: EnvConfig;
};

export const ContractInfo = ({
  title,
  address,
  env,
}: ContractAddressAndBalanceCardProps) => {
  const queryClient = useQueryClient();
  const { data: contractVersion } = useContractVersion(address, env);

  const {
    data: accountsCreatedEvents,
    isLoading: isLoadingCreatedAccoounts,
    isFetching: isFetchingCreatedAccoounts,
    isFetchedAfterMount: isFetchedAfterMountCreatedAccoounts,
    dataUpdatedAt,
  } = useAccountCreatedEvents(env);

  const isLoading =
    isLoadingCreatedAccoounts ||
    isFetchingCreatedAccoounts ||
    !isFetchedAfterMountCreatedAccoounts;

  return (
    <Card w="full" p={2}>
      <CardHeader>
        <Heading size={"sm"}>{title}</Heading>
      </CardHeader>
      <CardBody>
        <VStack spacing={4}>
          <HStack w="full" justify={"space-between"}>
            <Text fontSize="md" wordBreak={"break-word"} fontWeight={600}>
              Factory
            </Text>
            <AddressButtonGhostVariant address={address} />
          </HStack>
          <HStack w="full" justify={"space-between"}>
            <Text fontSize="md" fontWeight={600}>
              Version
            </Text>
            <Text fontSize="md" fontWeight={600}>
              {contractVersion}
            </Text>
          </HStack>

          <HStack w="full" justify={"space-between"}>
            <HStack>
              <Text fontSize="md" fontWeight={600}>
                Accounts created
              </Text>
              <IconButton
                aria-label="Refresh"
                icon={<FaSync />}
                size={"sm"}
                variant={"ghost"}
                isLoading={isLoading}
                onClick={async () => {
                  await queryClient.invalidateQueries({
                    queryKey: getAccountCreatedEventsQueryKey(env),
                  });
                  await queryClient.refetchQueries({
                    queryKey: getAccountCreatedEventsQueryKey(env),
                  });
                }}
              />
            </HStack>
            <Text fontSize="md" fontWeight={600}>
              {isLoadingCreatedAccoounts
                ? "Loading..."
                : accountsCreatedEvents?.totalCreated}
            </Text>
          </HStack>
          <Text fontSize="xs" color="gray.500" w="full">
            Last updated:{" "}
            {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString() : "-"}
          </Text>
        </VStack>
      </CardBody>
    </Card>
  );
};
