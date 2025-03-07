import {
  Button,
  Card,
  CardBody,
  HStack,
  Link,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { EnvConfig } from "@repo/config/contracts";
import { AddressButtonGhostVariant } from "../../../../components";
import {
  useIsAccountDeployed,
  useCreateAccount,
  useGetAccountAddress,
  useSmartAccountVersion,
} from "../../../../hooks";
import { useCallback, useEffect, useState } from "react";
import { useTxReceipt } from "../../../../utils/hooks/useTxReceipt";

type UserAccountProps = {
  env: EnvConfig;
  ownerAddress?: string;
  showDeployButton?: boolean;
};

export const UserAccount = ({
  env,
  ownerAddress,
  showDeployButton = true,
}: UserAccountProps) => {
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

  console.log("accountVersion", accountVersion);

  const toast = useToast();
  const [isTxLoading, setIsTxLoading] = useState(false);

  const { sendTransaction, sendTransactionTx, sendTransactionError } =
    useCreateAccount({});

  const onCreateAccount = useCallback(() => {
    if (!ownerAddress) return;

    setIsTxLoading(true);
    sendTransaction({ owner: ownerAddress, env });
  }, [sendTransaction, ownerAddress, env]);

  const { data: txReceipt } = useTxReceipt(sendTransactionTx?.txid ?? "");

  useEffect(() => {
    if (sendTransactionError) {
      setIsTxLoading(false);
      return;
    }

    if (!txReceipt) return;

    if (!txReceipt.reverted) {
      toast({
        title: "Success",
        description: (
          <Text>
            Account created successfully. Tx:{" "}
            <Link
              href={
                "https://vechainstats.com/transaction/" + txReceipt.meta.txID
              }
              isExternal
            >
              {txReceipt.meta.txID}
            </Link>
          </Text>
        ),
        status: "success",
        duration: 9000,
        isClosable: true,
        position: "bottom-left",
      });
    } else if (txReceipt?.reverted) {
      toast({
        title: "Error",
        description: (
          <Text>
            Account created failed. Tx:{" "}
            <Link
              href={
                "https://vechainstats.com/transaction/" + txReceipt.meta.txID
              }
              isExternal
            >
              {txReceipt.meta.txID}
            </Link>
          </Text>
        ),
        status: "error",
        duration: 9000,
        isClosable: true,
        position: "bottom-left",
      });
    }
    setIsTxLoading(false);
  }, [txReceipt, toast, setIsTxLoading, sendTransactionError]);

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
            <HStack w="full" justify={"end"}>
              {!isAccountDeployed && showDeployButton && (
                <Button
                  w={"full"}
                  variant={"outline"}
                  onClick={onCreateAccount}
                  isLoading={isTxLoading}
                >
                  Deploy now
                </Button>
              )}
            </HStack>
          </VStack>
        </VStack>
      </CardBody>
    </Card>
  );
};
