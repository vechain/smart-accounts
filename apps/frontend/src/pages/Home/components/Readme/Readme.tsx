import {
  Text,
  VStack,
  List,
  ListItem,
  Card,
  CardBody,
  Heading,
  useMediaQuery,
  Link,
  Icon,
  Divider,
} from "@chakra-ui/react";
import { FaExternalLinkAlt } from "react-icons/fa";

export const Readme = () => {
  const [isDesktop] = useMediaQuery("(min-width: 800px)");
  return (
    <Card w={"full"} variant={"outline"}>
      <CardBody>
        <VStack align="stretch" gap={4} px={isDesktop ? 20 : 4} spacing={4}>
          <VStack align="center" spacing={4}>
            <Heading size={"lg"} mt={4}>
              Smart Accounts for Social Login
            </Heading>
            <Text mt={4}>
              A simplified version of the Account Abstraction pattern for the
              VeChain blockchain.
            </Text>
          </VStack>

          {/* <HStack justify="space-between">
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "0px",
                paddingBottom: "56.250%",
              }}
            >
              <iframe
                allow="fullscreen;autoplay"
                allowFullScreen
                height="100%"
                src="https://streamable.com/e/yuzm44?autoplay=1&muted=1"
                width="100%"
                style={{
                  border: "none",
                  width: "100%",
                  height: "100%",
                  position: "absolute",
                  left: "0px",
                  top: "0px",
                  overflow: "hidden",
                }}
              ></iframe>
            </div>
          </HStack> */}

          <Text>The system consists of 2 main contracts working together:</Text>

          <List spacing={3} styleType="disc">
            <ListItem>
              <Text as="b">SimpleAccount</Text>: A smart contract wallet owned
              by the user that can:
              <List ml={5} mt={2} spacing={2} styleType="circle">
                <ListItem>
                  Execute transactions directly from the owner or through signed
                  messages
                </ListItem>
                <ListItem>Handle both single and batch transactions</ListItem>
                <ListItem>Be upgraded by the owner</ListItem>
                <ListItem>Transfer ownership to another address</ListItem>
                <ListItem>
                  Use time-based validity windows for transactions
                </ListItem>
                <ListItem>
                  Prevent replay attacks using nonces for batch transactions
                </ListItem>
              </List>
            </ListItem>
            <ListItem>
              <Text as="b">SimpleAccountFactory</Text>: Factory contract that
              creates and manages SimpleAccount contracts:
              <List ml={5} mt={2} spacing={2} styleType="circle">
                <ListItem>
                  Creates new accounts with deterministic addresses using
                  CREATE2
                </ListItem>
                <ListItem>
                  Supports multiple accounts per owner through custom salts
                </ListItem>
                <ListItem>
                  Manages different versions of the SimpleAccount implementation
                </ListItem>
                <ListItem>
                  Maintains compatibility with legacy accounts
                </ListItem>
              </List>
            </ListItem>
          </List>

          <Text fontWeight="medium" mt={4}>
            Important Note about Nonces:
          </Text>
          <Text>
            When using executeBatchWithAuthorization, proper nonce management is
            crucial to protect users against replay attacks:
            <List ml={5} mt={2} spacing={2} styleType="circle">
              <ListItem>
                Generate the nonce when requesting the signature (recommended to
                use Date.now())
              </ListItem>
              <ListItem>Each nonce can only be used once per account</ListItem>
              <ListItem>
                Without proper nonce management, signed transactions could be
                replayed multiple times by malicious actors
              </ListItem>
              <ListItem>
                Nonces are only required and validated for the
                executeBatchWithAuthorization method
              </ListItem>
            </List>
          </Text>

          <Text>
            You can fork the contracts and deploy them on your own, but we
            recommend using the contracts deployed by us for a better cross-app
            compatibility.
          </Text>

          <Divider />

          <Heading size="md">Version Management</Heading>
          <Text>
            The system has evolved through multiple versions to improve
            functionality and security:
          </Text>

          <List spacing={3} styleType="disc">
            <ListItem>
              <Text as="b">SimpleAccount</Text>:
              <List ml={5} mt={2} spacing={2} styleType="circle">
                <ListItem>
                  V1: Basic account functionality with single transaction
                  execution
                </ListItem>
                <ListItem>
                  V2: Skipped for misconfiguration during upgrade
                </ListItem>
                <ListItem>
                  V3: Introduced batch transactions with nonce-based replay
                  protection, ownership transfer and version tracking
                </ListItem>
              </List>
            </ListItem>
            <ListItem>
              <Text as="b">SimpleAccountFactory</Text>:
              <List ml={5} mt={2} spacing={2} styleType="circle">
                <ListItem>V1: Basic account creation and management</ListItem>
                <ListItem>
                  V2: Added support for multiple accounts per owner using custom
                  salts
                </ListItem>
                <ListItem>
                  V3: Support for V3 SimpleAccounts, enhanced version management
                  and backward compatibility with legacy accounts
                </ListItem>
              </List>
            </ListItem>
          </List>

          <Text>
            The factory maintains compatibility with all account versions,
            ensuring a smooth experience across different dApps and versions.
          </Text>

          <Divider />

          <Text>
            The contracts are deployed on the following networks:
            <List spacing={3} styleType="disc">
              <ListItem>
                <b>Mainnet</b>:{" "}
                <Link
                  isExternal
                  href="https://vechainstats.com/account/0xc06ad8573022e2be416ca89da47e8c592971679a/"
                >
                  0xC06Ad8573022e2BE416CA89DA47E8c592971679A
                </Link>
              </ListItem>
              <ListItem>
                <b>Testnet</b>:{" "}
                <Link
                  isExternal
                  href="https://explore-testnet.vechain.org/accounts/0x713b908Bcf77f3E00EFEf328E50b657a1A23AeaF"
                >
                  0x713b908Bcf77f3E00EFEf328E50b657a1A23AeaF
                </Link>
              </ListItem>
            </List>
          </Text>

          <Text>
            For detailed documentation and implementation details, check out the{" "}
            <Link
              fontWeight={"bold"}
              isExternal
              href="https://github.com/vechain/smart-accounts"
            >
              Github repository
              <Icon as={FaExternalLinkAlt} />
            </Link>
          </Text>

          <Text>
            Implement the Social Login with Smart Accounts in your app with{" "}
            <Link
              fontWeight={"bold"}
              isExternal
              href="https://github.com/vechain/vechain-kit"
            >
              VeChain Kit
              <Icon as={FaExternalLinkAlt} />
            </Link>
          </Text>
        </VStack>
      </CardBody>
    </Card>
  );
};
