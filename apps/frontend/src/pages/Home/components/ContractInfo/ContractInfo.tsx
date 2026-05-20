import {
  Box,
  Card,
  CardBody,
  Divider,
  HStack,
  IconButton,
  Skeleton,
  Text,
  Tooltip,
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
    <Card
      w="full"
      h="full"
      role="group"
      transition="all 0.25s ease"
      _hover={{
        transform: "translateY(-2px)",
        borderColor: "border.brand",
      }}
    >
      <CardBody p={6}>
        <VStack align="stretch" spacing={6} h="full">
          <HStack justify="space-between" align="flex-start">
            <NetworkBadge env={env} />
            <Tooltip label="Refresh" placement="top">
              <IconButton
                aria-label="Refresh"
                icon={<FaSync />}
                size="sm"
                variant="ghost"
                isLoading={isLoading}
                onClick={refresh}
                borderRadius="lg"
              />
            </Tooltip>
          </HStack>

          <Box>
            <Text
              fontSize="xs"
              fontWeight={600}
              letterSpacing="0.12em"
              textTransform="uppercase"
              color="text.subtle"
              mb={2}
            >
              Accounts Created
            </Text>
            <Skeleton
              isLoaded={!isLoadingCreatedAccoounts}
              startColor="whiteAlpha.100"
              endColor="whiteAlpha.300"
              borderRadius="lg"
              minH="56px"
              w={isLoadingCreatedAccoounts ? "60%" : "auto"}
            >
              <HStack align="baseline" spacing={2}>
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

          <Divider />

          <VStack align="stretch" spacing={3}>
            <HStack justify="space-between">
              <Text fontSize="sm" color="text.muted" fontWeight={500}>
                Factory
              </Text>
              <AddressButtonGhostVariant address={address} />
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
                  v{contractVersion ?? "—"}
                </Text>
              </Box>
            </HStack>
          </VStack>

          <Text fontSize="xs" color="text.subtle" mt="auto">
            Updated{" "}
            {dataUpdatedAt
              ? new Date(dataUpdatedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </Text>
        </VStack>
      </CardBody>
    </Card>
  );
};
