import { getConfig } from "@repo/config";
import { upgradeProxy } from "../../../helpers";
import { EnvConfig, getContractsConfig } from "@repo/config/contracts";
import { SimpleAccountFactory } from "../../../../typechain-types";
import { ethers } from "hardhat";

async function main() {
  if (!process.env.VITE_APP_ENV) {
    throw new Error("Missing VITE_APP_ENV");
  }

  const config = getConfig(process.env.VITE_APP_ENV as EnvConfig);
  const contractsConfig = getContractsConfig(
    process.env.VITE_APP_ENV as EnvConfig
  );

  console.log(
    `Upgrading SimpleAccountFactory contract at address: ${config.simpleAccountFactoryContractAddress} on network: ${config.network.name}`
  );

  // Deploy the V3 version of SimpleAccount separately because we will need it
  // when reinitializing the SimpleAccountFactory v3
  console.log("Deploying the V3 version of SimpleAccount...");
  const SimpleAccount = await ethers.getContractFactory("SimpleAccount");
  const simpleAccountImpl = await SimpleAccount.deploy();
  await simpleAccountImpl.waitForDeployment();
  console.log(
    "V3 version of SimpleAccount deployed at:",
    await simpleAccountImpl.getAddress()
  );

  const simpleAccountFactory = (await upgradeProxy(
    "SimpleAccountFactoryV2",
    "SimpleAccountFactory",
    config.simpleAccountFactoryContractAddress,
    [await simpleAccountImpl.getAddress(), contractsConfig.B3TR_TOKEN_ADDRESS],
    {
      version: 3,
    }
  )) as SimpleAccountFactory;

  console.log(`SimpleAccountFactory upgraded`);

  // check that upgrade was successful
  const version = await simpleAccountFactory.version();
  console.log(`New SimpleAccountFactory version: ${version}`);

  if (version !== 3n) {
    throw new Error(
      `SimpleAccountFactory version is not the expected one: ${version}`
    );
  }

  console.log("Execution completed");
  process.exit(0);
}

// Execute the main function
main();
