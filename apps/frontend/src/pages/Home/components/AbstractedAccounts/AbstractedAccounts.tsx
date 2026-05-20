import {
  Box,
  Card,
  CardBody,
  Heading,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import { FaWallet } from "react-icons/fa";
import { useWallet, WalletButton } from "@vechain/vechain-kit";
import { UserAccount } from "../UserAccount/UserAccount";
import { useGetAccountAddress } from "../../../../hooks";
import { SectionHeading } from "../../../../components";

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
    <VStack align="stretch" spacing={5}>
      <SectionHeading
        eyebrow="Your account"
        title="Your smart accounts"
        description="Every wallet on VeChain can own a smart account. The address is deterministic and can be deployed at any time."
      />

      {!connectedWallet ? (
        <Card variant="glow">
          <CardBody p={{ base: 8, md: 12 }}>
            <VStack spacing={5} textAlign="center">
              <Box
                p={4}
                rounded="2xl"
                bg="rgba(19,229,197,0.08)"
                border="1px solid"
                borderColor="border.brand"
                color="brand.400"
              >
                <Box as={FaWallet} boxSize="28px" />
              </Box>
              <VStack spacing={2}>
                <Heading size="md" letterSpacing="-0.02em">
                  Connect your wallet
                </Heading>
                <Text color="text.muted" maxW="380px">
                  Connect to view your deterministic smart account addresses on
                  both mainnet and testnet.
                </Text>
              </VStack>
              <WalletButton />
            </VStack>
          </CardBody>
        </Card>
      ) : !testnetAccountAddress && !mainnetAccountAddress ? (
        <Card variant="outline">
          <CardBody p={8} textAlign="center">
            <Heading size="md">No smart account found</Heading>
          </CardBody>
        </Card>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
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
        </SimpleGrid>
      )}
    </VStack>
  );
};
