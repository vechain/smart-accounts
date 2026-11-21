import { Signer } from "ethers";
import { ethers } from "hardhat";
import { B3TR_Mock, SimpleAccountFactory } from "../../typechain-types";
import { deployAndUpgrade } from "../../scripts/helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

interface DeployedContracts {
  simpleAccountFactory: SimpleAccountFactory;
  deployer: Signer;
  otherAccounts: HardhatEthersSigner[];
  b3tr: B3TR_Mock;
}

let cachedDeployment: DeployedContracts | undefined = undefined;

export async function getOrDeployContracts(
  forceDeploy = false
): Promise<DeployedContracts> {
  // Return cached deployment if available and force deploy is not requested
  if (!forceDeploy && cachedDeployment !== undefined) {
    return cachedDeployment;
  }

  const [deployer, ...otherAccounts] = await ethers.getSigners();

  // Deploy the B3TR mocked token
  const B3TR = await ethers.getContractFactory("B3TR_Mock");
  const b3tr = await B3TR.deploy();
  await b3tr.waitForDeployment();

  // Deploy the V3 version of SimpleAccount separately because we will need it
  // when reinitializing the SimpleAccountFactory v3
  const SimpleAccount = await ethers.getContractFactory("SimpleAccount");
  const simpleAccountImpl = await SimpleAccount.deploy();
  await simpleAccountImpl.waitForDeployment();

  const smartAccountFactory = (await deployAndUpgrade(
    [
      "SimpleAccountFactoryV1",
      "SimpleAccountFactoryV2",
      "SimpleAccountFactory",
    ],
    [[], [], [await simpleAccountImpl.getAddress(), await b3tr.getAddress()]],
    {
      versions: [undefined, 2, 3],
      logOutput: false,
    }
  )) as SimpleAccountFactory;

  // Cache the deployment
  cachedDeployment = {
    simpleAccountFactory: smartAccountFactory,
    deployer,
    otherAccounts,
    b3tr,
  };

  return cachedDeployment;
}
