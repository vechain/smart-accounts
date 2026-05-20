import {
  Box,
  Card,
  CardBody,
  Divider,
  Heading,
  HStack,
  Icon,
  Link,
  List,
  ListItem,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import { FaBolt, FaGithub } from "react-icons/fa";
import { NetworkBadge, SectionHeading } from "../../../../components";

const BulletText = ({ children }: { children: React.ReactNode }) => (
  <Text fontSize="sm" color="text.secondary" lineHeight="1.7">
    {children}
  </Text>
);

const Bullet = ({ children }: { children: React.ReactNode }) => (
  <ListItem display="flex" gap={3} alignItems="flex-start">
    <Box
      mt="9px"
      boxSize="5px"
      rounded="full"
      bg="brand.400"
      flexShrink={0}
    />
    <Box>{children}</Box>
  </ListItem>
);

const DeployedNetwork = ({
  env,
  address,
  href,
}: {
  env: "mainnet" | "testnet";
  address: string;
  href: string;
}) => (
  <Card variant="outline" w="full">
    <CardBody p={5}>
      <VStack align="stretch" spacing={3}>
        <NetworkBadge env={env} />
        <Link
          href={href}
          isExternal
          fontFamily="mono"
          fontSize="xs"
          color="text.secondary"
          wordBreak="break-all"
          _hover={{ color: "brand.300" }}
        >
          {address}
        </Link>
      </VStack>
    </CardBody>
  </Card>
);

export const Readme = () => {
  return (
    <VStack align="stretch" spacing={6}>
      <SectionHeading
        eyebrow="Documentation"
        title="How it works"
        description="A simplified Account Abstraction pattern for VeChain — two contracts, deterministic addresses, full version compatibility."
      />

      <Card>
        <CardBody p={{ base: 6, md: 8 }}>
          <VStack align="stretch" spacing={8}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              <VStack align="stretch" spacing={3}>
                <HStack spacing={2}>
                  <Box
                    px={2}
                    py={0.5}
                    rounded="md"
                    bg="brand.400"
                    color="ink.900"
                  >
                    <Text
                      fontSize="2xs"
                      fontFamily="mono"
                      fontWeight={800}
                      letterSpacing="0.04em"
                    >
                      CONTRACT
                    </Text>
                  </Box>
                  <Heading size="md" letterSpacing="-0.02em">
                    SimpleAccount
                  </Heading>
                </HStack>
                <Text fontSize="sm" color="text.muted">
                  A smart contract wallet owned by the user that can:
                </Text>
                <List spacing={2.5}>
                  <Bullet>
                    <BulletText>
                      Execute transactions directly from the owner or through
                      signed messages
                    </BulletText>
                  </Bullet>
                  <Bullet>
                    <BulletText>
                      Handle both single and batch transactions
                    </BulletText>
                  </Bullet>
                  <Bullet>
                    <BulletText>Transfer ownership to another address</BulletText>
                  </Bullet>
                </List>
              </VStack>

              <VStack align="stretch" spacing={3}>
                <HStack spacing={2}>
                  <Box
                    px={2}
                    py={0.5}
                    rounded="md"
                    bg="accent.500"
                    color="white"
                  >
                    <Text
                      fontSize="2xs"
                      fontFamily="mono"
                      fontWeight={800}
                      letterSpacing="0.04em"
                    >
                      FACTORY
                    </Text>
                  </Box>
                  <Heading size="md" letterSpacing="-0.02em">
                    SimpleAccountFactory
                  </Heading>
                </HStack>
                <Text fontSize="sm" color="text.muted">
                  Factory contract that creates and manages SimpleAccounts:
                </Text>
                <List spacing={2.5}>
                  <Bullet>
                    <BulletText>
                      Deterministic addresses using CREATE2
                    </BulletText>
                  </Bullet>
                  <Bullet>
                    <BulletText>
                      Get the account address without deploying it
                    </BulletText>
                  </Bullet>
                  <Bullet>
                    <BulletText>
                      Multiple accounts per owner via custom salts
                    </BulletText>
                  </Bullet>
                  <Bullet>
                    <BulletText>
                      Manages different SimpleAccount implementation versions
                    </BulletText>
                  </Bullet>
                </List>
              </VStack>
            </SimpleGrid>

            <Divider />

            <VStack align="stretch" spacing={4}>
              <Heading size="md" letterSpacing="-0.02em">
                Deployed Contracts
              </Heading>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <DeployedNetwork
                  env="mainnet"
                  address="0xC06Ad8573022e2BE416CA89DA47E8c592971679A"
                  href="https://vechainstats.com/account/0xc06ad8573022e2be416ca89da47e8c592971679a/"
                />
                <DeployedNetwork
                  env="testnet"
                  address="0x713b908Bcf77f3E00EFEf328E50b657a1A23AeaF"
                  href="https://explore-testnet.vechain.org/accounts/0x713b908Bcf77f3E00EFEf328E50b657a1A23AeaF"
                />
              </SimpleGrid>
            </VStack>

          </VStack>
        </CardBody>
      </Card>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <CtaCard
          href="https://github.com/vechain/smart-accounts"
          eyebrow="Source code"
          title="Explore on GitHub"
          description="Contracts, deployment scripts and integration examples."
          icon={FaGithub}
          accent="brand"
        />
        <CtaCard
          href="https://github.com/vechain/vechain-kit"
          eyebrow="Integrate"
          title="Build with VeChain Kit"
          description="Drop-in social login and smart accounts for your dApp."
          icon={FaBolt}
          accent="violet"
        />
      </SimpleGrid>
    </VStack>
  );
};

type CtaCardProps = {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ElementType;
  accent: "brand" | "violet";
};

const CtaCard = ({
  href,
  eyebrow,
  title,
  description,
  icon: IconCmp,
  accent,
}: CtaCardProps) => {
  const isBrand = accent === "brand";
  const gradient = isBrand
    ? "linear-gradient(135deg, rgba(19,229,197,0.18) 0%, rgba(19,229,197,0.04) 60%, transparent 100%)"
    : "linear-gradient(135deg, rgba(167,139,250,0.22) 0%, rgba(123,63,228,0.06) 60%, transparent 100%)";
  const borderColor = isBrand
    ? "rgba(19,229,197,0.35)"
    : "rgba(167,139,250,0.4)";
  const eyebrowColor = isBrand ? "brand.300" : "accent.300";
  const arrowColor = isBrand ? "brand.300" : "accent.300";
  const iconBg = isBrand
    ? "linear-gradient(135deg, #13E5C5 0%, #08C9AC 100%)"
    : "linear-gradient(135deg, #A78BFA 0%, #7B3FE4 100%)";

  return (
    <Link
      href={href}
      isExternal
      _hover={{ textDecoration: "none" }}
      role="group"
    >
      <Box
        position="relative"
        overflow="hidden"
        rounded="2xl"
        p="1px"
        bg={borderColor}
        transition="all 0.25s ease"
        _hover={{ transform: "translateY(-3px)" }}
      >
        <Box
          rounded="calc(1rem - 1px)"
          bg="ink.800"
          _light={{ bg: "white" }}
          backgroundImage={gradient}
          p={{ base: 5, md: 6 }}
          h="full"
        >
          <HStack align="flex-start" spacing={4}>
            <Box
              boxSize="48px"
              rounded="xl"
              backgroundImage={iconBg}
              display="flex"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
              boxShadow={
                isBrand
                  ? "0 8px 24px -8px rgba(19,229,197,0.4)"
                  : "0 8px 24px -8px rgba(123,63,228,0.5)"
              }
            >
              <Icon
                as={IconCmp}
                boxSize="22px"
                color={isBrand ? "ink.900" : "white"}
              />
            </Box>
            <Box flex="1">
              <Text
                fontSize="2xs"
                fontWeight={700}
                letterSpacing="0.14em"
                textTransform="uppercase"
                color={eyebrowColor}
                mb={1.5}
              >
                {eyebrow}
              </Text>
              <Heading
                size="md"
                letterSpacing="-0.02em"
                color="text.primary"
                mb={1.5}
              >
                {title}
              </Heading>
              <Text fontSize="sm" color="text.muted" lineHeight="1.5">
                {description}
              </Text>
              <HStack
                mt={4}
                spacing={1.5}
                color={arrowColor}
                fontSize="sm"
                fontWeight={600}
                transition="transform 0.25s ease"
                _groupHover={{ transform: "translateX(4px)" }}
              >
                <Text>Open</Text>
                <Box
                  as="span"
                  transition="transform 0.25s ease"
                  _groupHover={{ transform: "translateX(2px)" }}
                >
                  →
                </Box>
              </HStack>
            </Box>
          </HStack>
        </Box>
      </Box>
    </Link>
  );
};
