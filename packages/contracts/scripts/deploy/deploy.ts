import { ContractsConfig } from "@repo/config/contracts";
import { ethers, network } from "hardhat";
import { deployAndUpgrade } from "../helpers";
import { SimpleAccountFactory } from "../../typechain-types";

export async function deployAll(config: ContractsConfig): Promise<{
  simpleAccountFactory: string;
}> {
  const [deployer] = await ethers.getSigners();

  console.log(
    `Deploying on ${network.name}  with account ${deployer.address}...`
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

  console.log("Deploying the SimpleAccountFactory...");
  const smartAccountFactory = (await deployAndUpgrade(
    [
      "SimpleAccountFactoryV1",
      "SimpleAccountFactoryV2",
      "SimpleAccountFactory",
    ],
    [[], [], [await simpleAccountImpl.getAddress(), config.B3TR_TOKEN_ADDRESS]],
    {
      versions: [undefined, 2, 3],
      logOutput: true,
    }
  )) as SimpleAccountFactory;

  return {
    simpleAccountFactory: await smartAccountFactory.getAddress(),
  };
}
