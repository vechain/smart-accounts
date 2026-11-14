import { ethers, network } from "hardhat";
import { deployAll } from "./deploy/deploy";
import { getConfig, getContractsConfig } from "@repo/config";
import { AppConfig } from "@repo/config";
import fs from "fs";
import path from "path";
import { Network } from "@repo/constants";
import { EnvConfig } from "@repo/config/contracts";

const env = process.env.VITE_APP_ENV as EnvConfig;
if (!env) throw new Error("VITE_APP_ENV env variable must be set");
const config = getConfig();

const isSoloNetwork = network.name === "vechain_solo";
const isTestnetNetwork = network.name === "vechain_testnet";

async function main() {
  console.log(
    `Checking contracts deployment on ${network.name} (${config.network.urls[0]})...`
  );
  await checkContractsDeployment();
  process.exit(0);
}

// check if the contracts specified in the config file are deployed on the network, if not, deploy them (only on solo network)
async function checkContractsDeployment() {
  try {
    const simpleAccountFactory = config.simpleAccountFactoryContractAddress;
    const code = simpleAccountFactory
      ? await ethers.provider.getCode(simpleAccountFactory)
      : "0x";
    if (code === "0x") {
      console.log(
        `SimpleAccountFactory not deployed at address ${simpleAccountFactory}`
      );
      if (isSoloNetwork || isTestnetNetwork) {
        // deploy the contracts and override the config file
        const newAddresses = await deployAll(getContractsConfig(env));

        return await overrideLocalConfigWithNewContracts(
          newAddresses,
          config.network
        );
      } else
        console.log(
          `Skipping deployment on ${network.name}. Not solo or testnet.`
        );
    } else
      console.log(
        `SimpleAccountFactory contract already deployed, skipping deployment...`
      );
  } catch (e) {
    console.log(e);
  }
}

async function overrideLocalConfigWithNewContracts(
  contracts: Awaited<ReturnType<typeof deployAll>>,
  network: Network
) {
  const newConfig: AppConfig = {
    ...config,
    simpleAccountFactoryContractAddress: contracts.simpleAccountFactory,
  };

  console.log(`Overriding local config with new contracts...`, newConfig);

  // eslint-disable-next-line
  const toWrite = `import { AppConfig } from \".\" \n const config: AppConfig = ${JSON.stringify(newConfig, null, 2)};
  export default config;`;

  const configFiles: { [key: string]: string } = {
    solo: "local.ts",
    testnet: "testnet.ts",
    main: "mainnet.ts",
  };
  const fileToWrite = configFiles[network.name];
  const localConfigPath = path.resolve(`../config/${fileToWrite}`);
  console.log(`Writing new config file to ${localConfigPath}`);
  fs.writeFileSync(localConfigPath, toWrite);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
