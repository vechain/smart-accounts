import { expect } from "chai";
import { getOrDeployContracts } from "./helpers/deploy";
import { ethers } from "hardhat";
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { deployProxy, upgradeProxy } from "../scripts/helpers/";
import {
  SimpleAccount,
  SimpleAccountFactory,
  SimpleAccountFactoryV1,
  SimpleAccountFactoryV2,
} from "../typechain-types";

describe("SimpleAccountFactory", () => {
  describe("Deployment", () => {
    it("Can get the contract version", async () => {
      const { simpleAccountFactory } = await getOrDeployContracts(true);
      const version = await simpleAccountFactory.version();
      expect(version).to.equal(3n);
    });
  });

  describe("Contract upgradeablity", () => {
    it("Contract can be upgraded correctly by admin", async () => {
      const { simpleAccountFactory, deployer } =
        await getOrDeployContracts(true);

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("SimpleAccountFactory");
      const implementation = await Contract.deploy();
      await implementation.waitForDeployment();

      const currentImplAddress = await getImplementationAddress(
        ethers.provider,
        await simpleAccountFactory.getAddress()
      );

      const DEFAULT_ADMIN_ROLE =
        await simpleAccountFactory.DEFAULT_ADMIN_ROLE();

      expect(
        await simpleAccountFactory.hasRole(
          DEFAULT_ADMIN_ROLE,
          await deployer.getAddress()
        )
      ).to.eql(true);

      await expect(
        simpleAccountFactory
          .connect(deployer)
          .upgradeToAndCall(await implementation.getAddress(), "0x")
      ).to.not.be.reverted;

      const newImplAddress = await getImplementationAddress(
        ethers.provider,
        await simpleAccountFactory.getAddress()
      );

      expect(newImplAddress.toUpperCase()).to.not.eql(
        currentImplAddress.toUpperCase()
      );
      expect(newImplAddress.toUpperCase()).to.eql(
        (await implementation.getAddress()).toUpperCase()
      );
    });

    it("Non admin cannot upgrade the contract", async () => {
      const { simpleAccountFactory, deployer, otherAccounts } =
        await getOrDeployContracts(true);

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("SimpleAccountFactory");
      const implementation = await Contract.deploy();
      await implementation.waitForDeployment();

      const currentImplAddress = await getImplementationAddress(
        ethers.provider,
        await simpleAccountFactory.getAddress()
      );

      const DEFAULT_ADMIN_ROLE =
        await simpleAccountFactory.DEFAULT_ADMIN_ROLE();

      expect(
        await simpleAccountFactory.hasRole(
          DEFAULT_ADMIN_ROLE,
          await otherAccounts[0].getAddress()
        )
      ).to.eql(false);

      await expect(
        simpleAccountFactory
          .connect(otherAccounts[0])
          .upgradeToAndCall(await implementation.getAddress(), "0x")
      ).to.be.reverted;

      const newImplAddress = await getImplementationAddress(
        ethers.provider,
        await simpleAccountFactory.getAddress()
      );

      expect(newImplAddress.toUpperCase()).to.eql(
        currentImplAddress.toUpperCase()
      );
    });

    it("cannot initialize or reinitialize the contract", async () => {
      const { simpleAccountFactory, deployer, b3tr } =
        await getOrDeployContracts(true);

      // contract is already initialized in getOrDeployContracts
      await expect(simpleAccountFactory.initialize()).to.be.reverted;

      await expect(
        simpleAccountFactory
          .connect(deployer)
          .initializeV3(await deployer.getAddress(), await b3tr.getAddress())
      ).to.be.reverted;
    });

    it("can successfully upgrade to v3 (storage should be preserved and SimpleAccount should be updated)", async () => {
      const [deployer, ...otherAccounts] = await ethers.getSigners();

      const { b3tr } = await getOrDeployContracts(true);

      // Deploy V1 factory
      const simpleAccountFactory = (await deployProxy(
        "SimpleAccountFactoryV1",
        [] // initialize with no args
      )) as SimpleAccountFactoryV1;

      // Create first account (V1)
      const owner1 = otherAccounts[0];
      await simpleAccountFactory.createAccount(await owner1.getAddress());
      const account1Address = await simpleAccountFactory.getAccountAddress(
        await owner1.getAddress()
      );
      const account1 = (await ethers.getContractAt(
        "SimpleAccount",
        account1Address
      )) as SimpleAccount;
      // should be reverted because version was not available in V1
      await expect(account1.version()).to.be.reverted;

      // Upgrade factory to V2
      const simpleAccountFactoryV2 = (await upgradeProxy(
        "SimpleAccountFactoryV1",
        "SimpleAccountFactoryV2",
        await simpleAccountFactory.getAddress(),
        [] // no initialization needed for V2
      )) as SimpleAccountFactoryV2;
      expect(await simpleAccountFactoryV2.version()).to.equal("2");

      // Create second account (should still be V1)
      const owner2 = otherAccounts[1];
      await simpleAccountFactoryV2.createAccount(await owner2.getAddress());
      const account2Address = await simpleAccountFactoryV2.getAccountAddress(
        await owner2.getAddress()
      );
      const account2 = (await ethers.getContractAt(
        "SimpleAccount",
        account2Address
      )) as SimpleAccount;
      // should be reverted because version was not available in V1
      await expect(account2.version()).to.be.reverted;

      // Upgrade factory to V3
      const SmartAccountV3 = await ethers.getContractFactory("SimpleAccount");
      const smartAccountV3 = await SmartAccountV3.deploy();
      await smartAccountV3.waitForDeployment();

      const simpleAccountFactoryV3 = (await upgradeProxy(
        "SimpleAccountFactoryV2",
        "SimpleAccountFactory",
        await simpleAccountFactoryV2.getAddress(),
        [await smartAccountV3.getAddress(), await b3tr.getAddress()], // V3 initialization args
        { version: 3 } // specify V3 initialization
      )) as SimpleAccountFactory;
      expect(await simpleAccountFactoryV3.version()).to.equal(3n);

      const latestAccountImplementation =
        await simpleAccountFactoryV3.currentAccountImplementationAddress();
      expect(latestAccountImplementation).to.equal(
        await smartAccountV3.getAddress()
      );
      expect(
        await simpleAccountFactoryV3.currentAccountImplementationVersion()
      ).to.equal(3n);

      // Create third account (should be V3)
      const owner3 = otherAccounts[2];
      await simpleAccountFactoryV3.createAccount(await owner3.getAddress());
      const account3Address = await simpleAccountFactoryV3.getAccountAddress(
        await owner3.getAddress()
      );
      const account3 = (await ethers.getContractAt(
        "SimpleAccount",
        account3Address
      )) as SimpleAccount;
      expect(await account3.version()).to.equal(3n);

      // Upgrade account1 to V3 using signature
      const chainId = await ethers.provider.getNetwork().then((n) => n.chainId);
      const upgradeData = account1.interface.encodeFunctionData(
        "upgradeToAndCall",
        [latestAccountImplementation, "0x"]
      );

      const domain = {
        name: "Wallet",
        version: "1",
        chainId: Number(chainId),
        verifyingContract: account1Address,
      };

      const types = {
        ExecuteWithAuthorization: [
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
        ],
      };

      // Upgrade first account
      const message1 = {
        to: account1Address,
        value: ethers.parseEther("0"),
        data: upgradeData,
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 360,
      };

      const signature1 = await owner1.signTypedData(domain, types, message1);
      await account1.executeWithAuthorization(
        message1.to,
        message1.value,
        message1.data,
        message1.validAfter,
        message1.validBefore,
        signature1
      );
      expect(await account1.version()).to.equal(3n);

      // Upgrade second account similarly
      domain.verifyingContract = account2Address;
      const message2 = {
        to: account2Address,
        value: ethers.parseEther("0"),
        data: upgradeData,
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 360,
      };

      const signature2 = await owner2.signTypedData(domain, types, message2);
      await account2.executeWithAuthorization(
        message2.to,
        message2.value,
        message2.data,
        message2.validAfter,
        message2.validBefore,
        signature2
      );
      expect(await account2.version()).to.equal(3n);
    });

    it("After upgrading to V3, new created accounts must have the v3 abi", async () => {
      const { simpleAccountFactory, otherAccounts } =
        await getOrDeployContracts(true);

      const owner = otherAccounts[0];

      const accountAddress = await simpleAccountFactory.getAccountAddress(
        await owner.getAddress()
      );

      await simpleAccountFactory.createAccount(await owner.getAddress());

      const account = (await ethers.getContractAt(
        "SimpleAccount",
        accountAddress
      )) as SimpleAccount;

      const version = await account.version();

      expect(version).to.equal(3n);
    });
  });

  describe("SimpleAccount creation", () => {
    it("Can create a SimpleAccount", async () => {
      const { simpleAccountFactory, otherAccounts } =
        await getOrDeployContracts(true);

      const smartAccountOwner = otherAccounts[0];

      const smartAccountAddress = await simpleAccountFactory.getAccountAddress(
        await smartAccountOwner.getAddress()
      );

      const smartAccountContract = await ethers.getContractAt(
        "SimpleAccount",
        smartAccountAddress
      );

      // Check that there's no code at the address before deployment
      const codeBefore = await ethers.provider.getCode(smartAccountAddress);
      expect(codeBefore).to.equal("0x");

      await simpleAccountFactory.createAccount(
        await smartAccountOwner.getAddress()
      );

      // Check that there is code at the address after deployment
      const codeAfter = await ethers.provider.getCode(smartAccountAddress);
      expect(codeAfter).to.not.equal("0x");
      expect(codeAfter.length).to.be.greaterThan(2);

      const owner = await smartAccountContract.owner();

      expect(owner).to.equal(await smartAccountOwner.getAddress());
    });

    it("Can get implementation address", async () => {
      const { simpleAccountFactory } = await getOrDeployContracts(true);

      const implementationAddress =
        await simpleAccountFactory.currentAccountImplementationAddress();
      expect(implementationAddress).to.not.equal("0x");
    });

    it("Can deposit b3tr and VET even if account is not created yet", async () => {
      const { b3tr, otherAccounts } = await getOrDeployContracts(true);

      // Deploy V1 factory
      const simpleAccountFactory = (await deployProxy(
        "SimpleAccountFactoryV1",
        [] // initialize with no args
      )) as SimpleAccountFactoryV1;

      console.log("V1 FACTORY DEPLOYED");

      // create account with v1 factory
      const legacySmartAccountOwner = otherAccounts[0];
      console.log(
        "LEGACY SMART ACCOUNT OWNER",
        await legacySmartAccountOwner.getAddress()
      );
      console.log(
        "LEGACY SMART ACCOUNT ADDRESS",
        await simpleAccountFactory.getAccountAddress(
          await legacySmartAccountOwner.getAddress()
        )
      );

      await simpleAccountFactory.createAccount(
        await legacySmartAccountOwner.getAddress()
      );

      console.log("LEGACY ACCOUNT CREATED");
      console.log("\n\n");

      console.log(
        "Creating a legacy account without deployment but with a balance"
      );

      const legacyWithoutDeploymentOwner = otherAccounts[9];
      const legacyWithoutDeploymentAccountAddress =
        await simpleAccountFactory.getAccountAddress(
          await legacyWithoutDeploymentOwner.getAddress()
        );

      console.log(
        "LEGACY WITHOUT DEPLOYMENT OWNER",
        await legacyWithoutDeploymentOwner.getAddress()
      );
      console.log(
        "LEGACY WITHOUT DEPLOYMENT ADDRESS",
        legacyWithoutDeploymentAccountAddress
      );

      await legacyWithoutDeploymentOwner.sendTransaction({
        to: legacyWithoutDeploymentAccountAddress,
        value: ethers.parseEther("1"),
      });

      console.log("\n\n");

      // Upgrade factory to V2
      const simpleAccountFactoryV2 = (await upgradeProxy(
        "SimpleAccountFactoryV1",
        "SimpleAccountFactoryV2",
        await simpleAccountFactory.getAddress(),
        [] // no initialization needed for V2
      )) as SimpleAccountFactoryV2;
      expect(await simpleAccountFactoryV2.version()).to.equal("2");

      // Upgrade factory to V3
      const SmartAccountV3 = await ethers.getContractFactory("SimpleAccount");
      const smartAccountV3 = await SmartAccountV3.deploy();
      await smartAccountV3.waitForDeployment();

      const simpleAccountFactoryV3 = (await upgradeProxy(
        "SimpleAccountFactoryV2",
        "SimpleAccountFactory",
        await simpleAccountFactoryV2.getAddress(),
        [await smartAccountV3.getAddress(), await b3tr.getAddress()], // V3 initialization args
        { version: 3 } // specify V3 initialization
      )) as SimpleAccountFactory;
      expect(await simpleAccountFactoryV3.version()).to.equal(3n);

      console.log("FACTORY UPGRADED");
      console.log("CALCULATING NEW SMART ACCOUNT ADDRESS");

      const smartAccountOwner = otherAccounts[5];
      console.log("SMART ACCOUNT OWNER", await smartAccountOwner.getAddress());

      const smartAccountAddress =
        await simpleAccountFactoryV3.getAccountAddress(
          await smartAccountOwner.getAddress()
        );

      console.log("SMART ACCOUNT ADDRESS", smartAccountAddress);

      // Ensure contract is not deployed yet
      const codeBefore = await ethers.provider.getCode(smartAccountAddress);
      expect(codeBefore).to.equal("0x");

      // console.log(
      //   "SMART ACCOUNT IS LEGACY: ",
      //   await simpleAccountFactoryV3.isLegacyAccount(smartAccountAddress)
      // );

      const balanceBefore =
        await ethers.provider.getBalance(smartAccountAddress);
      expect(balanceBefore).to.equal(0);

      console.log("SENDING ETH and B3TR to smart account");

      // Send ETH
      await otherAccounts[0].sendTransaction({
        to: smartAccountAddress,
        value: ethers.parseEther("1"),
      });

      // Send B3TR
      await b3tr.transfer(smartAccountAddress, ethers.parseEther("1"));

      const balanceAfter =
        await ethers.provider.getBalance(smartAccountAddress);
      expect(balanceAfter).to.equal(ethers.parseEther("1"));

      const b3trBalanceAfter = await b3tr.balanceOf(smartAccountAddress);
      expect(b3trBalanceAfter).to.equal(ethers.parseEther("1"));

      console.log("TRANSFERRED ETH and B3TR");

      // console.log(
      //   "SMART ACCOUNT IS LEGACY: ",
      //   await simpleAccountFactoryV3.isLegacyAccount(smartAccountAddress)
      // );

      console.log(
        "Check if smart account address is generated same as before for same owner",
        "owner",
        await smartAccountOwner.getAddress(),
        "address",
        smartAccountAddress,
        "getAccountAddress",
        await simpleAccountFactoryV3.getAccountAddress(
          await smartAccountOwner.getAddress()
        )
      );

      // let's deploy the account now
      const txCreateAccount = await simpleAccountFactoryV3
        .connect(smartAccountOwner)
        .createAccount(await smartAccountOwner.getAddress());

      const receiptCreateAccount = await txCreateAccount.wait();
      // console.log("RECEIPT CREATE ACCOUNT", receiptCreateAccount);
      // console.log("RECEIPT STATUS CREATE ACCOUNT", receiptCreateAccount?.logs);
      // console.log("Expected address ", smartAccountAddress);
      // console.log("Expected owner ", await smartAccountOwner.getAddress());

      const codeAfter2 = await ethers.provider.getCode(smartAccountAddress);
      expect(codeAfter2).to.not.equal("0x");

      console.log("SMART ACCOUNT CREATED");

      // console.log(
      //   "SMART ACCOUNT IS LEGACY: ",
      //   await simpleAccountFactoryV3.isLegacyAccount(smartAccountAddress)
      // );

      // Let's check that the balance is still the same
      const balanceAfter2 =
        await ethers.provider.getBalance(smartAccountAddress);
      expect(balanceAfter2).to.equal(ethers.parseEther("1"));

      const b3trBalanceAfter2 = await b3tr.balanceOf(smartAccountAddress);
      expect(b3trBalanceAfter2).to.equal(ethers.parseEther("1"));

      // console.log("B3TR BALANCE on SA AFTER create", b3trBalanceAfter2);
      // console.log("ETH BALANCE on SA AFTER create", balanceAfter2);

      // check that owner can move those funds by calling execute
      const smartAccountContract = (await ethers.getContractAt(
        "SimpleAccount",
        smartAccountAddress
      )) as SimpleAccount;

      console.log(
        "SMART ACCOUNT CONTRACT VERSION",
        await smartAccountContract.version()
      );

      // console.log(
      //   "ETH BALANCE on SA BEFORE execute",
      //   ethers.formatEther(
      //     await ethers.provider.getBalance(smartAccountAddress)
      //   )
      // );

      const tx = await smartAccountContract
        .connect(smartAccountOwner)
        .execute(
          await smartAccountOwner.getAddress(),
          ethers.parseEther("0.5"),
          "0x"
        );
      const receipt = await tx.wait();
      // console.log("RECEIPT", receipt);
      // console.log("RECEIPT STATUS", receipt?.logs);

      // Verify both balances
      const balanceAfter3 =
        await ethers.provider.getBalance(smartAccountAddress);
      expect(balanceAfter3).to.equal(ethers.parseEther("0.5"));

      const b2trTx = await smartAccountContract
        .connect(smartAccountOwner)
        .execute(
          await b3tr.getAddress(),
          0,
          b3tr.interface.encodeFunctionData("transfer", [
            await smartAccountOwner.getAddress(),
            ethers.parseEther("1"),
          ])
        );
      const receipt2 = await b2trTx.wait();
      // console.log("RECEIPT 2", receipt2);
      // console.log("RECEIPT STATUS 2", receipt2?.logs);

      const b3trBalanceAfter3 = await b3tr.balanceOf(smartAccountAddress);
      expect(b3trBalanceAfter3).to.equal(ethers.parseEther("0"));

      // Add some debug logs
      // console.log(
      //   "B3TR balance before transfer:",
      //   ethers.formatEther(await b3tr.balanceOf(smartAccountAddress))
      // );
      // console.log("Transfer receipt status:", receipt2?.status);
      // console.log(
      //   "B3TR balance after transfer:",
      //   ethers.formatEther(b3trBalanceAfter3)
      // );

      console.log(
        "SMART ACCOUNT ADDRESS: ",
        await simpleAccountFactoryV3.getAccountAddress(
          await smartAccountOwner.getAddress()
        )
      );
      // console.log(
      //   "IS LEGACY: ",
      //   await simpleAccountFactoryV3.isLegacyAccount(smartAccountAddress)
      // );

      console.log(
        "LEGACY GET ACCOUNT ADDRESS: ",
        await simpleAccountFactoryV3.getAccountAddress(
          await legacySmartAccountOwner.getAddress()
        )
      );
      try {
        const legacySmartAccount = await ethers.getContractAt(
          "SimpleAccount",
          await simpleAccountFactoryV3.getAccountAddress(
            await legacySmartAccountOwner.getAddress()
          )
        );
        console.log(
          "LEGACY ACCOUNT VERSION 1",
          await legacySmartAccount.version()
        );
      } catch {
        console.log("LEGACY ACCOUNT VERSION 1");
      }
      // console.log(
      //   "IS LEGACY: ",
      //   await simpleAccountFactoryV3.isLegacyAccount(
      //     await simpleAccountFactory.getAccountAddress(
      //       await legacySmartAccountOwner.getAddress()
      //     )
      //   )
      // );

      // If I generate an address now, it should not be legacy, and it should keep not being legacy after I transfer ETH
      const newAddress = await simpleAccountFactoryV3.getAccountAddress(
        await otherAccounts[6].getAddress()
      );
      console.log("NEW ADDRESS", newAddress);
      // console.log(
      //   "IS LEGACY: ",
      //   await simpleAccountFactoryV3.isLegacyAccount(newAddress)
      // );

      // Send ETH to the new address
      await otherAccounts[0].sendTransaction({
        to: newAddress,
        value: ethers.parseEther("1"),
      });

      console.log("DEPOSITED in NEW ADDRESS");

      // Check that the new address is not legacy
      // console.log(
      //   "IS LEGACY: ",
      //   await simpleAccountFactoryV3.isLegacyAccount(newAddress)
      // );

      // create account
      const txCreateAccount2 = await simpleAccountFactoryV3
        .connect(otherAccounts[6])
        .createAccount(await otherAccounts[6].getAddress());

      const receiptCreateAccount2 = await txCreateAccount2.wait();
      console.log("ACCOUNT CREATED");

      console.log("GET VERSION");
      const newAccountContract = await ethers.getContractAt(
        "SimpleAccount",
        newAddress
      );
      console.log("VERSION", await newAccountContract.version());

      console.log("GET OWNER");
      const owner = await newAccountContract.owner();
      console.log("OWNER", owner);

      console.log("\n\n");
      console.log(
        "Deployin the legacy account created at the beginning, not deployed but with a balance"
      );

      const txCreateAccount3 = await simpleAccountFactoryV3
        .connect(legacyWithoutDeploymentOwner)
        .createAccount(await legacyWithoutDeploymentOwner.getAddress());

      const receiptCreateAccount3 = await txCreateAccount3.wait();
      console.log("LEGACY ACCOUNT CREATED");

      const legacyWithoutDeploymentAccount = await ethers.getContractAt(
        "SimpleAccount",
        legacyWithoutDeploymentAccountAddress
      );

      try {
        console.log(
          "LEGACY ACCOUNT VERSION",
          await legacyWithoutDeploymentAccount.version()
        );
      } catch {
        console.log("LEGACY ACCOUNT VERSION 1");
      }

      console.log("Upgrade this legacy account to V3");
      const implementationV3Address =
        await simpleAccountFactoryV3.accountImplementationV3();

      const txUpgradeLegacyAccount = await legacyWithoutDeploymentAccount
        .connect(legacyWithoutDeploymentOwner)
        .upgradeToAndCall(implementationV3Address, "0x");
      const receiptUpgradeLegacyAccount = await txUpgradeLegacyAccount.wait();
      console.log("LEGACY ACCOUNT UPGRADED to V3");

      console.log(
        "LEGACY ACCOUNT VERSION",
        await legacyWithoutDeploymentAccount.version()
      );

      console.log("\n\n");
    });

    it("Can create an account with salt", async () => {
      const { simpleAccountFactory, otherAccounts } =
        await getOrDeployContracts(true);

      const smartAccountOwner = otherAccounts[0];

      const smartAccountAddress =
        await simpleAccountFactory.getAccountAddressWithSalt(
          await smartAccountOwner.getAddress(),
          2
        );

      const codeBefore = await ethers.provider.getCode(smartAccountAddress);
      expect(codeBefore).to.equal("0x");

      await simpleAccountFactory.createAccountWithSalt(
        await smartAccountOwner.getAddress(),
        2
      );

      const codeAfter = await ethers.provider.getCode(smartAccountAddress);
      expect(codeAfter).to.not.equal("0x");
      expect(codeAfter.length).to.be.greaterThan(2);

      const smartAccountContract = await ethers.getContractAt(
        "SimpleAccount",
        smartAccountAddress
      );
      const owner = await smartAccountContract.owner();
      expect(owner).to.equal(await smartAccountOwner.getAddress());
    });
  });

  describe("SimpleAccount management", () => {
    it("Can get the account address", async () => {
      const { simpleAccountFactory, deployer } =
        await getOrDeployContracts(true);

      const smartAccountAddress = await simpleAccountFactory.getAccountAddress(
        await deployer.getAddress()
      );

      expect(smartAccountAddress).to.not.equal("0x");
    });

    it("Can get the current simpleaccount implementation address and version", async () => {
      const { simpleAccountFactory } = await getOrDeployContracts(true);

      const implementationAddress =
        await simpleAccountFactory.currentAccountImplementationAddress();
      expect(implementationAddress).to.not.equal("0x");

      const version =
        await simpleAccountFactory.currentAccountImplementationVersion();
      expect(version).to.not.equal(0n);
    });
  });

  describe("Smart Account addresses consistency", () => {
    it("Upgrading contract to V3 should not change the address of the account if already created", async () => {
      const [deployer, ...otherAccounts] = await ethers.getSigners();
      const { b3tr } = await getOrDeployContracts(true);

      // Deploy V1 factory
      const simpleAccountFactory = (await deployProxy(
        "SimpleAccountFactoryV1",
        [] // initialize with no args
      )) as SimpleAccountFactoryV1;

      // Create the account
      const addressWithV1Factory = await simpleAccountFactory.getAccountAddress(
        await deployer.getAddress()
      );
      await simpleAccountFactory.createAccount(await deployer.getAddress());

      // Upgrade factory to V3
      const SmartAccountV3 = await ethers.getContractFactory("SimpleAccount");
      const smartAccountV3 = await SmartAccountV3.deploy();
      await smartAccountV3.waitForDeployment();

      const simpleAccountFactoryV3 = (await upgradeProxy(
        "SimpleAccountFactoryV1",
        "SimpleAccountFactory",
        await simpleAccountFactory.getAddress(),
        [await smartAccountV3.getAddress(), await b3tr.getAddress()], // V3 initialization args
        { version: 3 } // specify V3 initialization
      )) as SimpleAccountFactory;
      expect(await simpleAccountFactoryV3.version()).to.equal(3n);

      const addressWithV3Factory =
        await simpleAccountFactoryV3.getAccountAddress(
          await deployer.getAddress()
        );

      expect(addressWithV3Factory).to.equal(addressWithV1Factory);

      // Check that there's code at the address after deployment
      const codeAfter = await ethers.provider.getCode(addressWithV3Factory);
      expect(codeAfter).to.not.equal("0x");
    });

    it("Upgrading contract to V3 should not change the address if the account is not deployed but has a positive B3TR balance", async () => {
      const [deployer, ...otherAccounts] = await ethers.getSigners();
      const { b3tr } = await getOrDeployContracts(true);

      const simpleAccountFactory = (await deployProxy(
        "SimpleAccountFactoryV1",
        [] // initialize with no args
      )) as SimpleAccountFactoryV1;

      const addressWithV1Factory = await simpleAccountFactory.getAccountAddress(
        await deployer.getAddress()
      );

      // Send B3TR to the address
      await b3tr.transfer(addressWithV1Factory, ethers.parseEther("1"));

      // Upgrade factory to V3
      const SmartAccountV3 = await ethers.getContractFactory("SimpleAccount");
      const smartAccountV3 = await SmartAccountV3.deploy();
      await smartAccountV3.waitForDeployment();

      const simpleAccountFactoryV3 = (await upgradeProxy(
        "SimpleAccountFactoryV1",
        "SimpleAccountFactory",
        await simpleAccountFactory.getAddress(),
        [await smartAccountV3.getAddress(), await b3tr.getAddress()], // V3 initialization args
        { version: 3 } // specify V3 initialization
      )) as SimpleAccountFactory;
      expect(await simpleAccountFactoryV3.version()).to.equal(3n);

      const addressWithV3Factory =
        await simpleAccountFactoryV3.getAccountAddress(
          await deployer.getAddress()
        );

      expect(addressWithV3Factory).to.equal(addressWithV1Factory);
    });

    it("After upgrading to V3, if account is not deployed and does not have a positive B3TR balance, the address should change to latest implementation address", async () => {
      const [deployer, ...otherAccounts] = await ethers.getSigners();
      const { b3tr } = await getOrDeployContracts(true);

      const simpleAccountFactory = (await deployProxy(
        "SimpleAccountFactoryV1",
        [] // initialize with no args
      )) as SimpleAccountFactoryV1;

      const addressWithV1Factory = await simpleAccountFactory.getAccountAddress(
        await deployer.getAddress()
      );

      // Upgrade factory to V3
      const SmartAccountV3 = await ethers.getContractFactory("SimpleAccount");
      const smartAccountV3 = await SmartAccountV3.deploy();
      await smartAccountV3.waitForDeployment();

      const simpleAccountFactoryV3 = (await upgradeProxy(
        "SimpleAccountFactoryV1",
        "SimpleAccountFactory",
        await simpleAccountFactory.getAddress(),
        [await smartAccountV3.getAddress(), await b3tr.getAddress()], // V3 initialization args
        { version: 3 } // specify V3 initialization
      )) as SimpleAccountFactory;

      const addressWithV3Factory =
        await simpleAccountFactoryV3.getAccountAddress(
          await deployer.getAddress()
        );

      expect(addressWithV3Factory).to.not.equal(addressWithV1Factory);
    });
  });
});
