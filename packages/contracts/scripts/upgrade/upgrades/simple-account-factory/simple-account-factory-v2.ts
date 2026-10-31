import { getConfig } from "@repo/config";
import { upgradeProxy } from "../../../helpers";
import { EnvConfig } from "@repo/config/contracts";
import { SimpleAccountFactory } from "../../../../typechain-types";

async function main() {
  if (!process.env.VITE_APP_ENV) {
    throw new Error("Missing VITE_APP_ENV");
  }

  const config = getConfig(process.env.VITE_APP_ENV as EnvConfig);

  console.log(
    `Upgrading SimpleAccountFactory contract at address: ${config.simpleAccountFactoryContractAddress} on network: ${config.network.name}`
  );

  const simpleAccountFactory = (await upgradeProxy(
    "SimpleAccountFactoryV1",
    "SimpleAccountFactoryV2",
    config.simpleAccountFactoryContractAddress,
    [],
    {
      version: 2,
    }
  )) as SimpleAccountFactory;

  console.log(`SimpleAccountFactory upgraded`);

  // check that upgrade was successful
  const version = await simpleAccountFactory.version();
  console.log(`New SimpleAccountFactory version: ${version}`);

  if (version !== 2n) {
    throw new Error(
      `SimpleAccountFactory version is not the expected one: ${version}`
    );
  }

  console.log("Execution completed");
  process.exit(0);
}

// Execute the main function
main();
