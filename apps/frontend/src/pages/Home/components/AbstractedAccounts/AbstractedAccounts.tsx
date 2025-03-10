import {
  Card,
  CardBody,
  CardHeader,
  Heading,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { UserAccount } from "../UserAccount/UserAccount";
import { useWallet, WalletButton } from "@vechain/vechain-kit";
import { useGetAccountAddress } from "../../../../hooks";

export const AbstractedAccounts = () => {
  const { connectedWallet } = useWallet();
  const { data: testnetAccountAddress } = useGetAccountAddress(
    connectedWallet?.address ?? "",
    "testnet"
  );
  const { data: mainnetAccountAddress } = useGetAccountAddress(
    connectedWallet?.address ?? "",
    "mainnet"
  );

  return (
    <Card variant={"outline"}>
      <CardHeader>
        <Heading size={"sm"}>Your smart accounts</Heading>
        <Text fontSize="sm" mt={2}>
          Every wallet on VeChain can own a smart account. The address of your
          smart account is deterministic, and it can be deployed at any time.
        </Text>
      </CardHeader>

      <CardBody>
        {!connectedWallet ? (
          <VStack spacing={4}>
            <Heading size={"sm"}>
              Connect your wallet to see your smart accounts
            </Heading>
            <WalletButton />
          </VStack>
        ) : !testnetAccountAddress && !mainnetAccountAddress ? (
          <VStack spacing={4}>
            <Heading size={"md"}>No smart account found</Heading>
          </VStack>
        ) : (
          <VStack spacing={4}>
            <Stack
              direction={["column", "row"]}
              w="full"
              justify={"space-between"}
            >
              <UserAccount
                env="mainnet"
                ownerAddress={connectedWallet?.address ?? ""}
                showDeployButton={true}
              />
              <UserAccount
                env="testnet"
                ownerAddress={connectedWallet?.address ?? ""}
                showDeployButton={false}
              />
            </Stack>
          </VStack>
        )}
      </CardBody>
    </Card>
  );
};
