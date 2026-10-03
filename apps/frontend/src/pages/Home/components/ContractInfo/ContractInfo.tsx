import {
  Box,
  Card,
  HStack,
  IconButton,
  Separator,
  Skeleton,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  AddressButtonGhostVariant,
  NetworkBadge,
} from "../../../../components";
import {
  getAccountCreatedEventsQueryKey,
  useAccountCreatedEvents,
} from "../../../../hooks";
import { EnvConfig } from "@repo/config/contracts";
import { useContractVersion } from "../../../../hooks/useContractVersion";
import { FaSync } from "react-icons/fa";
import { useQueryClient } from "@tanstack/react-query";

type ContractInfoProps = {
  address: string;
  env: EnvConfig;
};

export const ContractInfo = ({ address, env }: ContractInfoProps) => {
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

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: getAccountCreatedEventsQueryKey(env),
    });
    await queryClient.refetchQueries({
      queryKey: getAccountCreatedEventsQueryKey(env),
    });
  };

  const totalCreated = accountsCreatedEvents?.totalCreated;

  return (
    <Card.Root
      w="full"
      h="full"
      role="group"
      transition="all 0.25s ease"
      _hover={{
        transform: "translateY(-2px)",
        borderColor: "border.brand",
      }}
    >
      <Card.Body p={6}>
        <VStack align="stretch" gap={6} h="full">
          <HStack justify="space-between" align="flex-start">
            <NetworkBadge env={env} />
            <IconButton
              aria-label="Refresh"
              size="sm"
              variant="ghost"
              loading={isLoading}
              onClick={refresh}
              borderRadius="lg"
            >
              <FaSync />
            </IconButton>
          </HStack>

          <Box>
            <Text
              textStyle="xs"
              fontWeight={600}
              letterSpacing="0.12em"
              textTransform="uppercase"
              color="text.subtle"
              mb={2}
            >
              Accounts Created
            </Text>
            <Skeleton
              loading={isLoadingCreatedAccoounts}
              borderRadius="lg"
              minH="56px"
              w={isLoadingCreatedAccoounts ? "60%" : "auto"}
            >
              <HStack align="baseline" gap={2}>
                <Text
                  fontSize={{ base: "4xl", md: "5xl" }}
                  fontWeight={800}
                  letterSpacing="-0.04em"
                  lineHeight="1"
                  fontFamily="mono"
                >
                  {totalCreated?.toLocaleString() ?? "—"}
                </Text>
              </HStack>
            </Skeleton>
          </Box>

          <Separator borderColor="border.subtle" />

          <VStack align="stretch" gap={3}>
            <HStack justify="space-between">
              <Text textStyle="sm" color="text.muted" fontWeight={500}>
                Factory
              </Text>
              <AddressButtonGhostVariant address={address} />
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
                  v{contractVersion ?? "—"}
                </Text>
              </Box>
            </HStack>
          </VStack>

          <Text textStyle="xs" color="text.subtle" mt="auto">
            Updated{" "}
            {dataUpdatedAt
              ? new Date(dataUpdatedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </Text>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
