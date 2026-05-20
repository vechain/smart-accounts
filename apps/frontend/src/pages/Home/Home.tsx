import { SimpleGrid, VStack } from "@chakra-ui/react";
import { ContractInfo } from "./components/ContractInfo";
import { getConfig } from "@repo/config";
import { AbstractedAccounts } from "./components/AbstractedAccounts/AbstractedAccounts";
import { Readme } from "./components/Readme";
import { SupportedProject, SectionHeading } from "../../components";
import { Hero } from "./components/Hero/Hero";

export const Home = () => {
  return (
    <VStack align="stretch" spacing={{ base: 12, md: 16 }}>
      <Hero />

      <VStack align="stretch" spacing={5}>
        <SectionHeading
          eyebrow="Live data"
          title="Network stats"
          description="Account creation activity across the deployed factories."
        />
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
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

      <AbstractedAccounts />

      <Readme />

      <SupportedProject />
    </VStack>
  );
};
