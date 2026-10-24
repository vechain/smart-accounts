import { SimpleGrid, VStack } from "@chakra-ui/react";
import { ContractInfo } from "./components/ContractInfo";
import { getConfig } from "@repo/config";
import { AbstractedAccounts } from "./components/AbstractedAccounts/AbstractedAccounts";
import { NetworkInsights } from "./components/NetworkInsights";
import { Readme } from "./components/Readme";
import { SupportedProject, SectionHeading } from "../../components";
import { Hero } from "./components/Hero/Hero";

export const Home = () => {
  return (
    <VStack align="stretch" gap={{ base: 12, md: 16 }}>
      <Hero />

      <SupportedProject />

      <Readme />

      <VStack align="stretch" gap={5}>
        <SectionHeading
          eyebrow="Live data"
          title="Network stats"
          description="Account creation activity across the deployed factories."
        />
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          <ContractInfo
            address={getConfig("mainnet").simpleAccountFactoryContractAddress}
            env="mainnet"
          />
          <ContractInfo
            address={getConfig("testnet").simpleAccountFactoryContractAddress}
            env="testnet"
          />
        </SimpleGrid>
      </VStack>

      <NetworkInsights />

      <AbstractedAccounts />
    </VStack>
  );
};
