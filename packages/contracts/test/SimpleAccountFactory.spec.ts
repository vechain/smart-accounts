import { expect } from "chai";
import { getOrDeployContracts } from "./helpers/deploy";
import { ethers } from "hardhat";
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import {
  deployAndUpgrade,
  deployProxy,
  getInitializerData,
  upgradeProxy,
} from "../scripts/helpers/";
import {
  SimpleAccount,
  SimpleAccountFactory,
  SimpleAccountFactoryV1,
  SimpleAccountFactoryV2,
} from "../typechain-types";
import { ZeroAddress } from "ethers";
import { EventLog } from "ethers";
import { createSmartAccountThroughFactory } from "./helpers/common";

describe("SimpleAccountFactory", () => {
  describe("Deployment", () => {
    it("Can get the contract version", async () => {
      const { simpleAccountFactory } = await getOrDeployContracts(true);
      const version = await simpleAccountFactory.version();
      expect(version).to.equal(3n);
    });

    it("should be able to deploy and upgrade all versions", async () => {
      const [deployer, ...otherAccounts] = await ethers.getSigners();

      // Deploy the B3TR mocked token
      const B3TR = await ethers.getContractFactory("B3TR_Mock");
      const b3tr = await B3TR.deploy();
      await b3tr.waitForDeployment();

      // --- Deploy the SimpleAccountFactoryV1 ---
      const SimpleAccountFactoryV1 = await ethers.getContractFactory(
        "SimpleAccountFactoryV1"
      );
      const smartAccountFactoryImplV1 = await SimpleAccountFactoryV1.deploy();
      await smartAccountFactoryImplV1.waitForDeployment();

      // Deploy the proxy contract, link it to the implementation and call the initializer
      const proxyFactory = await ethers.getContractFactory("AAProxy");
      const proxy = (await proxyFactory.deploy(
        await smartAccountFactoryImplV1.getAddress(),
        getInitializerData(SimpleAccountFactoryV1.interface, [], undefined)
      )) as SimpleAccountFactory;
      await proxy.waitForDeployment();

      // --- Deploy the SimpleAccountFactoryV2 ---
      const SimpleAccountFactoryV2 = await ethers.getContractFactory(
        "SimpleAccountFactoryV2"
      );
      const smartAccountFactoryImplV2 = await SimpleAccountFactoryV2.deploy();
      await smartAccountFactoryImplV2.waitForDeployment();

      // Get the proxy with V1 ABI to perform the upgrade
      const proxyV1 = await ethers.getContractAt(
        "SimpleAccountFactoryV1",
        await proxy.getAddress()
      );

      // Upgrade to V2 without initialization data since V2 doesn't need initialization
      await proxyV1.upgradeToAndCall(
        await smartAccountFactoryImplV2.getAddress(),
        "0x"
      );

      // --- Deploy the SimpleAccountFactoryV3 ---
      const SimpleAccount = await ethers.getContractFactory("SimpleAccount");
      const simpleAccountImpl = await SimpleAccount.deploy();
      await simpleAccountImpl.waitForDeployment();

      const SimpleAccountFactoryV3 = await ethers.getContractFactory(
        "SimpleAccountFactory"
      );
      const smartAccountFactoryImplV3 = await SimpleAccountFactoryV3.deploy();
      await smartAccountFactoryImplV3.waitForDeployment();

      // Get the proxy with V2 ABI to perform the upgrade
      const proxyV2 = await ethers.getContractAt(
        "SimpleAccountFactoryV2",
        await proxy.getAddress()
      );

      // Upgrade to V3 with initialization data
      await proxyV2.upgradeToAndCall(
        await smartAccountFactoryImplV3.getAddress(),
        getInitializerData(
          SimpleAccountFactoryV3.interface,
          [await simpleAccountImpl.getAddress(), await b3tr.getAddress()],
          3
        )
      );

      // Get the proxy with V3 interface
      const proxyV3 = await ethers.getContractAt(
        "SimpleAccountFactory", // Use V3 interface
        await proxy.getAddress()
      );
    });

    it("Factory is initialized correctly", async () => {
      const { simpleAccountFactory, deployer } =
        await getOrDeployContracts(true);

      const simpleAccountImplementationAddress =
        await simpleAccountFactory.accountImplementationV3();
      expect(simpleAccountImplementationAddress).to.not.equal(
        "0x0000000000000000000000000000000000000000"
      );

      // role is correctly granted to deployer
      const DEFAULT_ADMIN_ROLE =
        await simpleAccountFactory.DEFAULT_ADMIN_ROLE();
      expect(
        await simpleAccountFactory.hasRole(
          DEFAULT_ADMIN_ROLE,
          await deployer.getAddress()
        )
      ).to.be.true;
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

    it("cannot reinitialize the contract", async () => {
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

    it("Cannot initializeV3 with wrong args", async () => {
      // Deploy the V3 version of SimpleAccount separately because we will need it
      // when reinitializing the SimpleAccountFactory v3
      const SimpleAccount = await ethers.getContractFactory("SimpleAccount");
      const simpleAccountImpl = await SimpleAccount.deploy();
      await simpleAccountImpl.waitForDeployment();

      // Test first case with ZeroAddress
      await expect(
        deployAndUpgrade(
          [
            "SimpleAccountFactoryV1",
            "SimpleAccountFactoryV2",
            "SimpleAccountFactory",
          ],
          [[], [], [await simpleAccountImpl.getAddress(), ZeroAddress]],
          {
            versions: [undefined, 2, 3],
            logOutput: false,
          }
        )
      ).to.be.reverted;

      // Test second case with wrong address
      await expect(
        deployAndUpgrade(
          [
            "SimpleAccountFactoryV1",
            "SimpleAccountFactoryV2",
            "SimpleAccountFactory",
          ],
          [[], [], [ZeroAddress, await simpleAccountImpl.getAddress()]],
          {
            versions: [undefined, 2, 3],
            logOutput: false,
          }
        )
      ).to.be.reverted;
    });

    it("should call .initialize() directly for coverage", async () => {
      const [deployer] = await ethers.getSigners();

      // Deploy the logic/implementation contract
      const Factory = await ethers.getContractFactory("SimpleAccountFactory");
      const factoryImpl = await Factory.deploy();
      await factoryImpl.waitForDeployment();

      const Proxy = await ethers.getContractFactory("AAProxy");
      const proxy = await Proxy.deploy(await factoryImpl.getAddress(), "0x");
      await proxy.waitForDeployment();

      const proxyContract = await ethers.getContractAt(
        "SimpleAccountFactory",
        await proxy.getAddress()
      );

      // Call initialize on the implementation directly
      const tx = await proxyContract.initialize();
      await tx.wait();

      // Verify that DEFAULT_ADMIN_ROLE is granted to deployer
      const DEFAULT_ADMIN_ROLE = await proxyContract.DEFAULT_ADMIN_ROLE();
      const hasRole = await proxyContract.hasRole(
        DEFAULT_ADMIN_ROLE,
        await deployer.getAddress()
      );
      expect(hasRole).to.be.true;

      // Verify that accountImplementationV1 was set (a SimpleAccount was deployed)
      const accountV1Address = await proxyContract.accountImplementationV1();
      expect(accountV1Address).to.properAddress;
    });

    /**
     * Having a V3 of SimpleAccount means that the implementation address inside the factory changes, which causes the
     * address calculation through the "Create2" function to resolve to a different account.
     * This means that before that calling getAccountAddress() or createAccount will return 2
     * different address before and after the upgrade.
     * Currently there are alrady 100k accounts created in production and around 500k computed
     * addresses that received funds.
     *
     * Solution
     * To solve this an algoritm was wrote to calculate the correct address/implementation to use.
     * Rules:
     *
     * First we always calculate the address by using the V1 implementation address of SImpleAccount
     * Then we check the following criteria:
     * If the account is deployed we know it is legacy, so V1 implementation address is used.
     * If the account is not deployed, we check if it has any balance of B3TR or VET balance, if it does,
     * we know it is legacy so V1 implementation address is used.
     * If none of the above, it means that the address generated through V1 Implementation was never
     * used so we can use the V3 Simple Account implementation.
     *
     * So what I want to test is the following:
     *
     * with V1 of factory we have
     *
     * user1: generates address and receives b3tr
     * user2: generates address only
     * user3: gen addr, receives b3tr and creates account
     * user4: generates address and creates account
     * user5: generates address and receives ETH
     *
     * we migrate the factory to V3
     *
     * we check that:
     * user1: has same address
     * user2: has a different address
     * user3: has same address
     * user4: has same address
     * user5: has same address
     * new user6: has address calculated with implementation v3
     *
     * After this I want to check that when user6 and user2 creates their account the version of
     * their account returns 3, while the version of all the other accounts
     * (if not created then create it) has v1 (infact by calling accountNeedsUpgradeToVersion()
     * in the factory it should return true for all v1 and false for all v3).
     */
    it("It should preserve legacy wallets when upgrading to V3", async () => {
      const { b3tr, otherAccounts } = await getOrDeployContracts(true);

      // Deploy V1 factory
      const simpleAccountFactory = (await deployProxy(
        "SimpleAccountFactoryV1",
        [] // initialize with no args
      )) as SimpleAccountFactoryV1;

      // Get our test users
      const [user1, user2, user3, user4, user5, user6] = otherAccounts;

      // Generate addresses for all users with V1 factory
      const user1AddressV1 = await simpleAccountFactory.getAccountAddress(
        await user1.getAddress()
      );
      const user2AddressV1 = await simpleAccountFactory.getAccountAddress(
        await user2.getAddress()
      );
      const user3AddressV1 = await simpleAccountFactory.getAccountAddress(
        await user3.getAddress()
      );
      const user4AddressV1 = await simpleAccountFactory.getAccountAddress(
        await user4.getAddress()
      );
      const user5AddressV1 = await simpleAccountFactory.getAccountAddress(
        await user5.getAddress()
      );

      // user1: generates address and receives b3tr
      await b3tr.transfer(user1AddressV1, ethers.parseEther("1"));

      // user2: generates address only (no action needed)

      // user3: gen addr, receives b3tr and creates account
      await b3tr.transfer(user3AddressV1, ethers.parseEther("1"));
      await simpleAccountFactory.createAccount(await user3.getAddress());

      // user4: generates address and creates account
      await simpleAccountFactory.createAccount(await user4.getAddress());

      // user5: generates address and receives ETH
      await user5.sendTransaction({
        to: user5AddressV1,
        value: ethers.parseEther("1"),
      });

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

      // Check addresses after upgrade
      const user1AddressV3 = await simpleAccountFactoryV3.getAccountAddress(
        await user1.getAddress()
      );
      const user2AddressV3 = await simpleAccountFactoryV3.getAccountAddress(
        await user2.getAddress()
      );
      const user3AddressV3 = await simpleAccountFactoryV3.getAccountAddress(
        await user3.getAddress()
      );
      const user4AddressV3 = await simpleAccountFactoryV3.getAccountAddress(
        await user4.getAddress()
      );
      const user5AddressV3 = await simpleAccountFactoryV3.getAccountAddress(
        await user5.getAddress()
      );
      const user6AddressV3 = await simpleAccountFactoryV3.getAccountAddress(
        await user6.getAddress()
      );

      // Verify addresses
      expect(user1AddressV3).to.equal(user1AddressV1); // has b3tr balance
      expect(user2AddressV3).to.not.equal(user2AddressV1); // should be different (no balance/deployment)
      expect(user3AddressV3).to.equal(user3AddressV1); // deployed
      expect(user4AddressV3).to.equal(user4AddressV1); // deployed
      expect(user5AddressV3).to.equal(user5AddressV1); // has ETH balance

      // Create accounts for user2, user5 and user6 (should be V3)
      await simpleAccountFactoryV3.createAccount(await user2.getAddress());
      await simpleAccountFactoryV3.createAccount(await user5.getAddress());
      await simpleAccountFactoryV3.createAccount(await user6.getAddress());

      // Create account for user1 (should be V1 since had b3tr)
      await simpleAccountFactoryV3.createAccount(await user1.getAddress());

      // Now check versions after ALL accounts are created
      const accounts = [
        {
          address: user1AddressV3,
          expectedVersion: 1,
          user: user1,
          note: "user1 has b3tr",
        },
        {
          address: user2AddressV3,
          expectedVersion: 3,
          user: user2,
          note: "user2 has no balance",
        },
        {
          address: user3AddressV3,
          expectedVersion: 1,
          user: user3,
          note: "user3 has balance and has account",
        },
        {
          address: user4AddressV3,
          expectedVersion: 1,
          user: user4,
          note: "user4 has no balance but has account",
        },
        {
          address: user5AddressV3,
          expectedVersion: 1,
          user: user5,
          note: "user5 has ETH",
        },
        {
          address: user6AddressV3,
          expectedVersion: 3,
          user: user6,
          note: "user6 has no balance (new user after upgrade)",
        },
      ];

      for (const { address, expectedVersion, user } of accounts) {
        const account = await ethers.getContractAt("SimpleAccount", address);

        if (expectedVersion === 1) {
          await expect(account.version()).to.be.reverted;

          // Should need upgrade
          expect(
            await simpleAccountFactoryV3.accountNeedsUpgradeToVersion(
              address,
              3
            )
          ).to.be.true;
        } else {
          expect(await account.version()).to.equal(3n);
          expect(
            await simpleAccountFactoryV3.accountNeedsUpgradeToVersion(
              address,
              3
            )
          ).to.be.false;
        }
      }
    });

    it("emits Initialized event when upgrading to V3", async () => {
      const { deployer, b3tr } = await getOrDeployContracts(true);

      // First create a V1 factory and account
      const factoryProxy = (await deployProxy(
        "SimpleAccountFactoryV1",
        []
      )) as SimpleAccountFactoryV1;

      // Upgrade factory to V2
      await upgradeProxy(
        "SimpleAccountFactoryV1",
        "SimpleAccountFactoryV2",
        await factoryProxy.getAddress(),
        []
      );

      // Deploy V3 implementation contracts
      const FactoryV3 = await ethers.getContractFactory("SimpleAccountFactory");
      const implementationV3 = await FactoryV3.deploy();
      await implementationV3.waitForDeployment();

      // Get the V2 contract instance
      const factoryV2 = await ethers.getContractAt(
        "SimpleAccountFactoryV2",
        await factoryProxy.getAddress()
      );

      // Prepare initialization data
      const initData = FactoryV3.interface.encodeFunctionData("initializeV3", [
        await implementationV3.getAddress(),
        await b3tr.getAddress(),
      ]);

      // Perform the upgrade manually and check for the event
      await expect(
        factoryV2.upgradeToAndCall(
          await implementationV3.getAddress(),
          initData
        )
      )
        .to.emit(factoryV2, "Initialized")
        .withArgs(3);
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

      // create account with v1 factory
      const legacySmartAccountOwner = otherAccounts[0];

      await simpleAccountFactory.createAccount(
        await legacySmartAccountOwner.getAddress()
      );

      expect(
        await ethers.provider.getCode(
          await simpleAccountFactory.getAccountAddress(
            await legacySmartAccountOwner.getAddress()
          )
        )
      ).to.not.equal("0x");

      const legacyWithoutDeploymentOwner = otherAccounts[9];
      const legacyWithoutDeploymentAccountAddress =
        await simpleAccountFactory.getAccountAddress(
          await legacyWithoutDeploymentOwner.getAddress()
        );

      await legacyWithoutDeploymentOwner.sendTransaction({
        to: legacyWithoutDeploymentAccountAddress,
        value: ethers.parseEther("1"),
      });

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

      const smartAccountOwner = otherAccounts[5];

      const smartAccountAddress =
        await simpleAccountFactoryV3.getAccountAddress(
          await smartAccountOwner.getAddress()
        );

      // Ensure contract is not deployed yet
      const codeBefore = await ethers.provider.getCode(smartAccountAddress);
      expect(codeBefore).to.equal("0x");

      const balanceBefore =
        await ethers.provider.getBalance(smartAccountAddress);
      expect(balanceBefore).to.equal(0);

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

      // Check if smart account address is generated same as before for same owner
      const addressAfterCreation =
        await simpleAccountFactoryV3.getAccountAddress(
          await smartAccountOwner.getAddress()
        );
      expect(addressAfterCreation).to.equal(smartAccountAddress);

      // let's deploy the account now
      const txCreateAccount = await simpleAccountFactoryV3
        .connect(smartAccountOwner)
        .createAccount(await smartAccountOwner.getAddress());

      await txCreateAccount.wait();

      const codeAfter2 = await ethers.provider.getCode(smartAccountAddress);
      expect(codeAfter2).to.not.equal("0x");

      // Let's check that the balance is still the same
      const balanceAfter2 =
        await ethers.provider.getBalance(smartAccountAddress);
      expect(balanceAfter2).to.equal(ethers.parseEther("1"));

      const b3trBalanceAfter2 = await b3tr.balanceOf(smartAccountAddress);
      expect(b3trBalanceAfter2).to.equal(ethers.parseEther("1"));

      // check that owner can move those funds by calling execute
      const smartAccountContract = (await ethers.getContractAt(
        "SimpleAccount",
        smartAccountAddress
      )) as SimpleAccount;

      const tx = await smartAccountContract
        .connect(smartAccountOwner)
        .execute(
          await smartAccountOwner.getAddress(),
          ethers.parseEther("0.5"),
          "0x"
        );
      await tx.wait();

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
      await b2trTx.wait();

      const b3trBalanceAfter3 = await b3tr.balanceOf(smartAccountAddress);
      expect(b3trBalanceAfter3).to.equal(ethers.parseEther("0"));

      const legacySmartAccount = await ethers.getContractAt(
        "SimpleAccount",
        await simpleAccountFactoryV3.getAccountAddress(
          await legacySmartAccountOwner.getAddress()
        )
      );

      await expect(legacySmartAccount.version()).to.be.reverted;

      // If I generate an address now, it should not be legacy, and it should keep not being legacy after I transfer ETH
      const newAddress = await simpleAccountFactoryV3.getAccountAddress(
        await otherAccounts[6].getAddress()
      );

      // Send ETH to the new address
      await otherAccounts[0].sendTransaction({
        to: newAddress,
        value: ethers.parseEther("1"),
      });

      // create account
      const txCreateAccount2 = await simpleAccountFactoryV3
        .connect(otherAccounts[6])
        .createAccount(await otherAccounts[6].getAddress());

      await txCreateAccount2.wait();

      const newAccountContract = await ethers.getContractAt(
        "SimpleAccount",
        newAddress
      );
      expect(await newAccountContract.version()).to.equal(3n);

      const owner = await newAccountContract.owner();
      expect(owner).to.equal(await otherAccounts[6].getAddress());

      const txCreateAccount3 = await simpleAccountFactoryV3
        .connect(legacyWithoutDeploymentOwner)
        .createAccount(await legacyWithoutDeploymentOwner.getAddress());

      await txCreateAccount3.wait();

      const legacyWithoutDeploymentAccount = await ethers.getContractAt(
        "SimpleAccount",
        legacyWithoutDeploymentAccountAddress
      );

      await expect(legacyWithoutDeploymentAccount.version()).to.be.reverted;

      const implementationV3Address =
        await simpleAccountFactoryV3.accountImplementationV3();

      const txUpgradeLegacyAccount = await legacyWithoutDeploymentAccount
        .connect(legacyWithoutDeploymentOwner)
        .upgradeToAndCall(implementationV3Address, "0x");

      await txUpgradeLegacyAccount.wait();

      expect(await legacyWithoutDeploymentAccount.version()).to.equal(3n);
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

    it("should return existing account if already deployed", async () => {
      const { simpleAccountFactory, otherAccounts } =
        await getOrDeployContracts(true);

      // Create account first time
      const owner = otherAccounts[0];
      const expectedAddress = await simpleAccountFactory.getAccountAddress(
        await owner.getAddress()
      );
      expect(expectedAddress).to.not.equal("0x");

      // Check initial state
      const codeBefore = await ethers.provider.getCode(expectedAddress);
      expect(codeBefore).to.equal("0x");

      // First creation
      await simpleAccountFactory.createAccount(await owner.getAddress());

      // Verify account exists
      const codeAfter = await ethers.provider.getCode(expectedAddress);
      expect(codeAfter).to.not.equal("0x");

      // Get the contract instance
      const account = await ethers.getContractAt(
        "SimpleAccount",
        expectedAddress
      );
      const ownerOfAccount = await account.owner();
      expect(ownerOfAccount).to.equal(await owner.getAddress());

      // Get the address again - should be the same
      const addressAfterCreation = await simpleAccountFactory.getAccountAddress(
        await owner.getAddress()
      );
      expect(addressAfterCreation).to.equal(expectedAddress);

      // Try to create same account again but just call getAccountAddress first
      const existingAddress = await simpleAccountFactory.getAccountAddress(
        await owner.getAddress()
      );
      expect(existingAddress).to.equal(expectedAddress);

      // Now try the creation
      await simpleAccountFactory
        .connect(otherAccounts[1])
        .getAccountAddress(await owner.getAddress());

      // Verify nothing changed
      const codeFinal = await ethers.provider.getCode(expectedAddress);
      expect(codeFinal).to.equal(codeAfter);
    });

    it("returns existing account when calling createAccount for already deployed account (with V1)", async () => {
      const { otherAccounts, b3tr } = await getOrDeployContracts(true);
      const owner = otherAccounts[0];

      const simpleAccountFactory = (await deployProxy(
        "SimpleAccountFactoryV1",
        [] // initialize with no args
      )) as SimpleAccountFactoryV1;

      // First creation
      const tx1 = await simpleAccountFactory.createAccount(
        await owner.getAddress()
      );
      const receipt1 = await tx1.wait();

      // Get the account address
      const accountAddress = await simpleAccountFactory.getAccountAddress(
        await owner.getAddress()
      );

      // Now we upgrade the factory to V3
      const smartAccountV3 = await ethers.getContractFactory("SimpleAccount");
      const smartAccountV3Contract = await smartAccountV3.deploy();
      await smartAccountV3Contract.waitForDeployment();

      const simpleAccountFactoryV3 = (await upgradeProxy(
        "SimpleAccountFactoryV1",
        "SimpleAccountFactory",
        await simpleAccountFactory.getAddress(),
        [await smartAccountV3Contract.getAddress(), await b3tr.getAddress()], // V3 initialization args
        { version: 3 } // specify V3 initialization
      )) as SimpleAccountFactory;

      // Try to create the same account again
      const tx2 = await simpleAccountFactoryV3.createAccount(
        await owner.getAddress()
      );
      const receipt2 = await tx2.wait();

      // Verify both transactions returned the same address
      expect(accountAddress).to.equal(
        await simpleAccountFactoryV3.getAccountAddress(await owner.getAddress())
      );

      // Verify only one AccountCreated event was emitted (from the first creation)
      const events1 = receipt1?.logs.filter(
        (log) =>
          log.topics[0] ===
          simpleAccountFactory.interface.getEvent("AccountCreated").topicHash
      );
      const events2 = receipt2?.logs.filter(
        (log) =>
          log.topics[0] ===
          simpleAccountFactoryV3.interface.getEvent("AccountCreated").topicHash
      );
      expect(events1?.length).to.equal(1);
      expect(events2?.length).to.equal(0);
    });

    it("returns existing account when calling createAccount for already deployed account (with V3)", async () => {
      const { simpleAccountFactory, otherAccounts } =
        await getOrDeployContracts(true);
      const owner = otherAccounts[0];

      // First creation
      const tx1 = await simpleAccountFactory.createAccount(
        await owner.getAddress()
      );
      const receipt1 = await tx1.wait();

      // Get the account address
      const accountAddress = await simpleAccountFactory.getAccountAddress(
        await owner.getAddress()
      );

      // Try to create the same account again
      const tx2 = await simpleAccountFactory.createAccount(
        await owner.getAddress()
      );
      const receipt2 = await tx2.wait();

      // Verify both transactions returned the same address
      expect(accountAddress).to.equal(
        await simpleAccountFactory.getAccountAddress(await owner.getAddress())
      );

      // Verify only one AccountCreated event was emitted (from the first creation)
      const events1 = receipt1?.logs.filter(
        (log) =>
          log.topics[0] ===
          simpleAccountFactory.interface.getEvent("AccountCreated").topicHash
      );
      const events2 = receipt2?.logs.filter(
        (log) =>
          log.topics[0] ===
          simpleAccountFactory.interface.getEvent("AccountCreated").topicHash
      );
      expect(events1?.length).to.equal(1);
      expect(events2?.length).to.equal(0);
    });

    it("returns existing account when calling createAccountWithSalt for already deployed account (with V2)", async () => {
      const { b3tr, otherAccounts } = await getOrDeployContracts(true);
      const owner = otherAccounts[0];
      const salt = 12345n;

      const simpleAccountFactory = (await deployProxy(
        "SimpleAccountFactoryV2",
        [] // initialize with no args
      )) as SimpleAccountFactoryV2;

      // First creation
      const tx1 = await simpleAccountFactory.createAccountWithSalt(
        await owner.getAddress(),
        salt
      );
      const receipt1 = await tx1.wait();

      // Get the account address
      const accountAddress =
        await simpleAccountFactory.getAccountAddressWithSalt(
          await owner.getAddress(),
          salt
        );

      // Now we upgrade the factory to V3
      const smartAccountV3 = await ethers.getContractFactory("SimpleAccount");
      const smartAccountV3Contract = await smartAccountV3.deploy();
      await smartAccountV3Contract.waitForDeployment();

      const simpleAccountFactoryV3 = (await upgradeProxy(
        "SimpleAccountFactoryV2",
        "SimpleAccountFactory",
        await simpleAccountFactory.getAddress(),
        [await smartAccountV3Contract.getAddress(), await b3tr.getAddress()], // V3 initialization args
        { version: 3 } // specify V3 initialization
      )) as SimpleAccountFactory;

      // Try to create the same account again
      const tx2 = await simpleAccountFactoryV3.createAccountWithSalt(
        await owner.getAddress(),
        salt
      );
      const receipt2 = await tx2.wait();

      // Verify both transactions returned the same address
      expect(accountAddress).to.equal(
        await simpleAccountFactoryV3.getAccountAddressWithSalt(
          await owner.getAddress(),
          salt
        )
      );

      // Verify only one AccountCreated event was emitted (from the first creation)
      const events1 = receipt1?.logs.filter(
        (log) =>
          log.topics[0] ===
          simpleAccountFactory.interface.getEvent("AccountCreated").topicHash
      );
      const events2 = receipt2?.logs.filter(
        (log) =>
          log.topics[0] ===
          simpleAccountFactoryV3.interface.getEvent("AccountCreated").topicHash
      );
      expect(events1?.length).to.equal(1);
      expect(events2?.length).to.equal(0);
    });

    it("returns existing account when calling createAccountWithSalt for already deployed account (with V3)", async () => {
      const { simpleAccountFactory, otherAccounts } =
        await getOrDeployContracts(true);
      const owner = otherAccounts[0];
      const salt = 12345n;

      // First creation
      const tx1 = await simpleAccountFactory.createAccountWithSalt(
        await owner.getAddress(),
        salt
      );
      const receipt1 = await tx1.wait();

      // Get the account address
      const accountAddress =
        await simpleAccountFactory.getAccountAddressWithSalt(
          await owner.getAddress(),
          salt
        );

      // Try to create the same account again
      const tx2 = await simpleAccountFactory.createAccountWithSalt(
        await owner.getAddress(),
        salt
      );
      const receipt2 = await tx2.wait();

      // Verify both transactions returned the same address
      expect(accountAddress).to.equal(
        await simpleAccountFactory.getAccountAddressWithSalt(
          await owner.getAddress(),
          salt
        )
      );

      // Verify only one AccountCreated event was emitted (from the first creation)
      const events1 = receipt1?.logs.filter(
        (log) =>
          log.topics[0] ===
          simpleAccountFactory.interface.getEvent("AccountCreated").topicHash
      );
      const events2 = receipt2?.logs.filter(
        (log) =>
          log.topics[0] ===
          simpleAccountFactory.interface.getEvent("AccountCreated").topicHash
      );
      expect(events1?.length).to.equal(1);
      expect(events2?.length).to.equal(0);
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

    describe("Smart Account addresses consistency with salt", () => {
      it("Upgrading contract to V3 should not change the address of the account if already created with salt", async () => {
        const [deployer, ...otherAccounts] = await ethers.getSigners();
        const { b3tr } = await getOrDeployContracts(true);

        // Deploy V2 factory instead of V1
        const simpleAccountFactory = (await deployProxy(
          "SimpleAccountFactoryV2",
          [] // initialize with no args
        )) as SimpleAccountFactoryV2;

        // Rest of the test remains the same
        const salt = BigInt(1);
        const addressWithV2Factory =
          await simpleAccountFactory.getAccountAddressWithSalt(
            await deployer.getAddress(),
            salt
          );
        await simpleAccountFactory.createAccountWithSalt(
          await deployer.getAddress(),
          salt
        );

        // Upgrade factory to V3
        const SmartAccountV3 = await ethers.getContractFactory("SimpleAccount");
        const smartAccountV3 = await SmartAccountV3.deploy();
        await smartAccountV3.waitForDeployment();

        const simpleAccountFactoryV3 = (await upgradeProxy(
          "SimpleAccountFactoryV2", // Change from V1 to V2
          "SimpleAccountFactory",
          await simpleAccountFactory.getAddress(),
          [await smartAccountV3.getAddress(), await b3tr.getAddress()],
          { version: 3 }
        )) as SimpleAccountFactory;
        expect(await simpleAccountFactoryV3.version()).to.equal(3n);

        const addressWithV3Factory =
          await simpleAccountFactoryV3.getAccountAddressWithSalt(
            await deployer.getAddress(),
            salt
          );

        expect(addressWithV3Factory).to.equal(addressWithV2Factory);

        const codeAfter = await ethers.provider.getCode(addressWithV3Factory);
        expect(codeAfter).to.not.equal("0x");
      });

      it("Upgrading contract to V3 should not change the address if the account is not deployed but has a positive B3TR balance (with salt)", async () => {
        const [deployer, ...otherAccounts] = await ethers.getSigners();
        const { b3tr } = await getOrDeployContracts(true);

        // Deploy V2 factory instead of V1
        const simpleAccountFactory = (await deployProxy(
          "SimpleAccountFactoryV2",
          [] // initialize with no args
        )) as SimpleAccountFactoryV2;

        const salt = BigInt(2);
        const addressWithV2Factory =
          await simpleAccountFactory.getAccountAddressWithSalt(
            await deployer.getAddress(),
            salt
          );

        await b3tr.transfer(addressWithV2Factory, ethers.parseEther("1"));

        const SmartAccountV3 = await ethers.getContractFactory("SimpleAccount");
        const smartAccountV3 = await SmartAccountV3.deploy();
        await smartAccountV3.waitForDeployment();

        const simpleAccountFactoryV3 = (await upgradeProxy(
          "SimpleAccountFactoryV2", // Change from V1 to V2
          "SimpleAccountFactory",
          await simpleAccountFactory.getAddress(),
          [await smartAccountV3.getAddress(), await b3tr.getAddress()],
          { version: 3 }
        )) as SimpleAccountFactory;
        expect(await simpleAccountFactoryV3.version()).to.equal(3n);

        const addressWithV3Factory =
          await simpleAccountFactoryV3.getAccountAddressWithSalt(
            await deployer.getAddress(),
            salt
          );

        expect(addressWithV3Factory).to.equal(addressWithV2Factory);

        // If we call createAccountWithSalt it should create account with V1 implementation
        const tx2 = await simpleAccountFactoryV3.createAccountWithSalt(
          await deployer.getAddress(),
          salt
        );
        const receipt2 = await tx2.wait();

        const events2 = receipt2?.logs.filter(
          (log) =>
            log.topics[0] ===
            simpleAccountFactoryV3.interface.getEvent("AccountCreated")
              .topicHash
        );
        expect(events2?.length).to.equal(1);

        // Check that the first arg of the event is the address calculated with V1 implementation
        expect((events2?.[0] as EventLog).args[0]).to.equal(
          addressWithV2Factory
        );
      });

      it("After upgrading to V3, if account is not deployed and does not have a positive B3TR balance, the address should change to latest implementation address (with salt)", async () => {
        const [deployer, ...otherAccounts] = await ethers.getSigners();
        const { b3tr } = await getOrDeployContracts(true);

        // Deploy V2 factory instead of V1
        const simpleAccountFactory = (await deployProxy(
          "SimpleAccountFactoryV2",
          [] // initialize with no args
        )) as SimpleAccountFactoryV2;

        const salt = BigInt(3);
        const addressWithV2Factory =
          await simpleAccountFactory.getAccountAddressWithSalt(
            await deployer.getAddress(),
            salt
          );

        const SmartAccountV3 = await ethers.getContractFactory("SimpleAccount");
        const smartAccountV3 = await SmartAccountV3.deploy();
        await smartAccountV3.waitForDeployment();

        const simpleAccountFactoryV3 = (await upgradeProxy(
          "SimpleAccountFactoryV2", // Change from V1 to V2
          "SimpleAccountFactory",
          await simpleAccountFactory.getAddress(),
          [await smartAccountV3.getAddress(), await b3tr.getAddress()],
          { version: 3 }
        )) as SimpleAccountFactory;

        const addressWithV3Factory =
          await simpleAccountFactoryV3.getAccountAddressWithSalt(
            await deployer.getAddress(),
            salt
          );

        expect(addressWithV3Factory).to.not.equal(addressWithV2Factory);
      });
    });
  });

  describe("Check smart account upgradability", () => {
    it("user can know when to upgrade to V3", async () => {
      const { deployer, simpleAccountFactory } =
        await getOrDeployContracts(true);

      expect(await simpleAccountFactory.version()).to.equal(3n);

      const { smartAccount, smartAccountAddress } =
        await createSmartAccountThroughFactory(deployer);

      expect(await smartAccount.version()).to.equal(3n);

      // check if upgrade is needed (it shouldn't since it was created with V3 of factory)
      expect(
        await simpleAccountFactory.accountNeedsUpgradeToVersion(
          smartAccountAddress,
          3
        )
      ).to.be.false;

      // now let's downgrade the account of the user to v1
      const Contract = await ethers.getContractFactory("SimpleAccountV1");
      const implementation = await Contract.deploy();
      await implementation.waitForDeployment();

      await smartAccount.upgradeToAndCall(
        await implementation.getAddress(),
        "0x"
      );

      await expect(smartAccount.version()).to.be.reverted;

      // check if upgrade is needed (it should since it was created with V1 of factory)
      expect(
        await simpleAccountFactory.accountNeedsUpgradeToVersion(
          smartAccountAddress,
          3
        )
      ).to.be.true;
    });

    it("Checking available upgrades for a not deployed account should return false", async () => {
      const { deployer, simpleAccountFactory } =
        await getOrDeployContracts(true);

      const accountAddress =
        await simpleAccountFactory.getAccountAddressWithSalt(
          await deployer.getAddress(),
          ethers.toBigInt(ethers.randomBytes(32))
        );

      // check that code is not deployed at the address
      const code = await ethers.provider.getCode(accountAddress);
      expect(code).to.equal("0x");

      // check that the account needs upgrade to v3
      expect(
        await simpleAccountFactory.accountNeedsUpgradeToVersion(
          accountAddress,
          3
        )
      ).to.be.false;
    });

    it("should correctly identify when account needs upgrade to higher version", async () => {
      const { deployer, simpleAccountFactory } =
        await getOrDeployContracts(true);

      // Create account with V3 first
      const { smartAccount, smartAccountAddress } =
        await createSmartAccountThroughFactory(deployer);
      expect(await smartAccount.version()).to.equal(3n);

      // Deploy V2 implementation
      const ContractV2 = await ethers.getContractFactory("SimpleAccountV2");
      const implementationV2 = await ContractV2.deploy();
      await implementationV2.waitForDeployment();

      // Downgrade account to V2
      await smartAccount.upgradeToAndCall(
        await implementationV2.getAddress(),
        "0x"
      );

      // Verify account is now at V2
      expect(await smartAccount.version()).to.equal(2n);

      // Check if upgrade is needed to V3 (should return true since V2 < V3)
      expect(
        await simpleAccountFactory.accountNeedsUpgradeToVersion(
          smartAccountAddress,
          3
        )
      ).to.be.true;

      // Check if upgrade is needed to V2 (should return false since account is at V2)
      expect(
        await simpleAccountFactory.accountNeedsUpgradeToVersion(
          smartAccountAddress,
          2
        )
      ).to.be.false;

      // Check if upgrade is needed to V1 (should return false since V2 > V1)
      expect(
        await simpleAccountFactory.accountNeedsUpgradeToVersion(
          smartAccountAddress,
          1
        )
      ).to.be.false;
    });

    it("hasLegacyAccount should correctly identify legacy accounts", async () => {
      const { b3tr, otherAccounts } = await getOrDeployContracts(true);

      // Deploy V1 factory
      const simpleAccountFactoryV1 = (await deployProxy(
        "SimpleAccountFactoryV1",
        [] // initialize with no args
      )) as SimpleAccountFactoryV1;

      // Setup our test users with different scenarios
      const [deployedV1User, hasB3trUser, hasEthUser, notUsedUser] =
        otherAccounts;

      // Generate addresses for all users with V1 factory
      const deployedV1Address = await simpleAccountFactoryV1.getAccountAddress(
        await deployedV1User.getAddress()
      );
      const hasB3trAddress = await simpleAccountFactoryV1.getAccountAddress(
        await hasB3trUser.getAddress()
      );
      const hasEthAddress = await simpleAccountFactoryV1.getAccountAddress(
        await hasEthUser.getAddress()
      );
      const notUsedAddress = await simpleAccountFactoryV1.getAccountAddress(
        await notUsedUser.getAddress()
      );

      // 1. Create an account with V1 factory (deployed)
      await simpleAccountFactoryV1.createAccount(
        await deployedV1User.getAddress()
      );

      // 2. Send B3TR tokens to an address (not deployed)
      await b3tr.transfer(hasB3trAddress, ethers.parseEther("1"));

      // 3. Send ETH to an address (not deployed)
      await hasEthUser.sendTransaction({
        to: hasEthAddress,
        value: ethers.parseEther("1"),
      });

      // 4. Let notUsedAddress remain untouched (not deployed, no balance)

      // Upgrade factory to V3
      const SmartAccountV3 = await ethers.getContractFactory("SimpleAccount");
      const smartAccountV3 = await SmartAccountV3.deploy();
      await smartAccountV3.waitForDeployment();

      const simpleAccountFactoryV3 = (await upgradeProxy(
        "SimpleAccountFactoryV1",
        "SimpleAccountFactory",
        await simpleAccountFactoryV1.getAddress(),
        [await smartAccountV3.getAddress(), await b3tr.getAddress()], // V3 initialization args
        { version: 3 } // specify V3 initialization
      )) as SimpleAccountFactory;

      // Now test hasLegacyAccount for each scenario
      expect(
        await simpleAccountFactoryV3.hasLegacyAccount(
          await deployedV1User.getAddress()
        )
      ).to.be.true;
      expect(
        await simpleAccountFactoryV3.hasLegacyAccount(
          await hasB3trUser.getAddress()
        )
      ).to.be.true;
      expect(
        await simpleAccountFactoryV3.hasLegacyAccount(
          await hasEthUser.getAddress()
        )
      ).to.be.true;
      expect(
        await simpleAccountFactoryV3.hasLegacyAccount(
          await notUsedUser.getAddress()
        )
      ).to.be.false;

      // 5. Create a V3 account (should be non-legacy)
      const v3User = otherAccounts[4];
      expect(
        await simpleAccountFactoryV3.hasLegacyAccount(await v3User.getAddress())
      ).to.be.false;

      // After creating the account, it should be considered legacy (because it's deployed)
      await simpleAccountFactoryV3.createAccount(await v3User.getAddress());
      expect(
        await simpleAccountFactoryV3.hasLegacyAccount(await v3User.getAddress())
      ).to.be.false;

      // Verify the account is actually V3
      const v3Account = await ethers.getContractAt(
        "SimpleAccount",
        await simpleAccountFactoryV3.getAccountAddress(
          await v3User.getAddress()
        )
      );
      expect(await v3Account.version()).to.equal(3n);
    });

    it("should use current implementation version when targetVersion is 0 in accountNeedsUpgradeToVersion", async () => {
      // Get signers
      const [deployer, ...otherAccounts] = await ethers.getSigners();

      // Deploy B3TR token
      const B3TR = await ethers.getContractFactory("B3TR_Mock");
      const b3tr = await B3TR.deploy();
      await b3tr.waitForDeployment();

      // Deploy V1 factory
      const simpleAccountFactoryV1 = (await deployProxy(
        "SimpleAccountFactoryV1",
        [] // initialize with no args
      )) as SimpleAccountFactoryV1;

      // Create account with V1 factory
      await simpleAccountFactoryV1.createAccount(await deployer.getAddress());
      const accountAddress = await simpleAccountFactoryV1.getAccountAddress(
        await deployer.getAddress()
      );

      // Deploy V3 implementation for SimpleAccount
      const SmartAccountV3 = await ethers.getContractFactory("SimpleAccount");
      const smartAccountV3Implementation = await SmartAccountV3.deploy();
      await smartAccountV3Implementation.waitForDeployment();

      // Upgrade factory to V3
      const simpleAccountFactoryV3 = (await upgradeProxy(
        "SimpleAccountFactoryV1",
        "SimpleAccountFactory",
        await simpleAccountFactoryV1.getAddress(),
        [
          await smartAccountV3Implementation.getAddress(),
          await b3tr.getAddress(),
        ], // V3 initialization args
        { version: 3 } // specify V3 initialization
      )) as SimpleAccountFactory;

      // Check if upgrade is needed with targetVersion = 0 (should use current version = 3)
      const needsUpgrade =
        await simpleAccountFactoryV3.accountNeedsUpgradeToVersion(
          accountAddress,
          0
        );

      // Should be true since V1 < V3
      expect(needsUpgrade).to.be.true;

      // Verify current implementation version is 3
      expect(
        await simpleAccountFactoryV3.currentAccountImplementationVersion()
      ).to.equal(3n);
    });

    it("should revert when targetVersion is greater than current implementation version in accountNeedsUpgradeToVersion", async () => {
      // Get signers
      const [deployer, ...otherAccounts] = await ethers.getSigners();

      // Deploy B3TR token
      const B3TR = await ethers.getContractFactory("B3TR_Mock");
      const b3tr = await B3TR.deploy();
      await b3tr.waitForDeployment();

      // Deploy V1 factory
      const simpleAccountFactoryV1 = (await deployProxy(
        "SimpleAccountFactoryV1",
        [] // initialize with no args
      )) as SimpleAccountFactoryV1;

      // Create account with V1 factory
      await simpleAccountFactoryV1.createAccount(await deployer.getAddress());
      const accountAddress = await simpleAccountFactoryV1.getAccountAddress(
        await deployer.getAddress()
      );

      // Deploy V3 implementation for SimpleAccount
      const SmartAccountV3 = await ethers.getContractFactory("SimpleAccount");
      const smartAccountV3Implementation = await SmartAccountV3.deploy();
      await smartAccountV3Implementation.waitForDeployment();

      // Upgrade factory to V3
      const simpleAccountFactoryV3 = (await upgradeProxy(
        "SimpleAccountFactoryV1",
        "SimpleAccountFactory",
        await simpleAccountFactoryV1.getAddress(),
        [
          await smartAccountV3Implementation.getAddress(),
          await b3tr.getAddress(),
        ], // V3 initialization args
        { version: 3 } // specify V3 initialization
      )) as SimpleAccountFactory;

      // Try to check with targetVersion = 4 (greater than current version = 3)
      await expect(
        simpleAccountFactoryV3.accountNeedsUpgradeToVersion(accountAddress, 4)
      ).to.be.revertedWith(
        "Target version must be less than or equal to the current version"
      );
    });
  });

  describe("Account needs upgrade", () => {
    it("should correctly identify upgrade requirements for different account scenarios", async () => {
      // Get signers
      const [deployer, ...otherAccounts] = await ethers.getSigners();
      const user1 = otherAccounts[0];
      const user2 = otherAccounts[1];

      // Deploy B3TR token
      const B3TR = await ethers.getContractFactory("B3TR_Mock");
      const b3tr = await B3TR.deploy();
      await b3tr.waitForDeployment();

      // Deploy V1 factory
      const simpleAccountFactoryV1 = (await deployProxy(
        "SimpleAccountFactoryV1",
        [] // initialize with no args
      )) as SimpleAccountFactoryV1;

      // Setup different account scenarios
      // 1. Account created with V1 factory
      await simpleAccountFactoryV1.createAccount(await deployer.getAddress());
      const deployedV1Address = await simpleAccountFactoryV1.getAccountAddress(
        await deployer.getAddress()
      );

      // 2. Account with B3TR tokens but not deployed
      const b3trOnlyAddress = await simpleAccountFactoryV1.getAccountAddress(
        await user1.getAddress()
      );
      await b3tr.transfer(b3trOnlyAddress, ethers.parseEther("1"));

      // 3. Account with ETH/VET but not deployed
      const ethOnlyAddress = await simpleAccountFactoryV1.getAccountAddress(
        await user2.getAddress()
      );
      await user2.sendTransaction({
        to: ethOnlyAddress,
        value: ethers.parseEther("1"),
      });

      // Deploy V3 implementation for SimpleAccount
      const SmartAccountV3 = await ethers.getContractFactory("SimpleAccount");
      const smartAccountV3Implementation = await SmartAccountV3.deploy();
      await smartAccountV3Implementation.waitForDeployment();

      // Upgrade factory to V3
      const simpleAccountFactoryV3 = (await upgradeProxy(
        "SimpleAccountFactoryV1",
        "SimpleAccountFactory",
        await simpleAccountFactoryV1.getAddress(),
        [
          await smartAccountV3Implementation.getAddress(),
          await b3tr.getAddress(),
        ], // V3 initialization args
        { version: 3 } // specify V3 initialization
      )) as SimpleAccountFactory;

      // Get the deployed V1 account contract
      const deployedV1Account = await ethers.getContractAt(
        "SimpleAccount",
        deployedV1Address
      );

      // Verify it's a V1 account
      await expect(deployedV1Account.version()).to.be.reverted;

      // Check if upgrade is needed for all three scenarios (should be true)
      expect(
        await simpleAccountFactoryV3.upgradeRequired(
          deployedV1Address,
          await deployer.getAddress(),
          3
        )
      ).to.be.true;

      expect(
        await simpleAccountFactoryV3.upgradeRequired(
          b3trOnlyAddress,
          await user1.getAddress(),
          3
        )
      ).to.be.true;

      expect(
        await simpleAccountFactoryV3.upgradeRequired(
          ethOnlyAddress,
          await user2.getAddress(),
          3
        )
      ).to.be.true;

      // Now create a V3 account
      await simpleAccountFactoryV3.createAccount(
        await otherAccounts[3].getAddress()
      );
      const v3AccountAddress = await simpleAccountFactoryV3.getAccountAddress(
        await otherAccounts[3].getAddress()
      );

      // Get the V3 account contract
      const v3Account = await ethers.getContractAt(
        "SimpleAccount",
        v3AccountAddress
      );

      // Verify it's a V3 account
      expect(await v3Account.version()).to.equal(3n);

      // Check if upgrade is needed (should be false)
      expect(
        await simpleAccountFactoryV3.upgradeRequired(
          v3AccountAddress,
          await otherAccounts[3].getAddress(),
          3
        )
      ).to.be.false;

      // Check non-deployed account with V3 factory (should be false)
      const nonDeployedV3Address =
        await simpleAccountFactoryV3.getAccountAddress(
          await otherAccounts[4].getAddress()
        );

      // Verify account is not deployed
      const code = await ethers.provider.getCode(nonDeployedV3Address);
      expect(code).to.equal("0x");

      expect(
        await simpleAccountFactoryV3.upgradeRequired(
          nonDeployedV3Address,
          await otherAccounts[4].getAddress(),
          3
        )
      ).to.be.false;
    });

    it("should handle account upgrades and version comparisons correctly", async () => {
      // Get signers
      const [deployer, ...otherAccounts] = await ethers.getSigners();

      // Deploy B3TR token
      const B3TR = await ethers.getContractFactory("B3TR_Mock");
      const b3tr = await B3TR.deploy();
      await b3tr.waitForDeployment();

      // Deploy V1 factory
      const simpleAccountFactoryV1 = (await deployProxy(
        "SimpleAccountFactoryV1",
        [] // initialize with no args
      )) as SimpleAccountFactoryV1;

      // Create account with V1 factory
      await simpleAccountFactoryV1.createAccount(await deployer.getAddress());
      const accountAddress = await simpleAccountFactoryV1.getAccountAddress(
        await deployer.getAddress()
      );

      // Deploy V3 implementation for SimpleAccount
      const SmartAccountV3 = await ethers.getContractFactory("SimpleAccount");
      const smartAccountV3Implementation = await SmartAccountV3.deploy();
      await smartAccountV3Implementation.waitForDeployment();

      // Upgrade factory to V3
      const simpleAccountFactoryV3 = (await upgradeProxy(
        "SimpleAccountFactoryV1",
        "SimpleAccountFactory",
        await simpleAccountFactoryV1.getAddress(),
        [
          await smartAccountV3Implementation.getAddress(),
          await b3tr.getAddress(),
        ], // V3 initialization args
        { version: 3 } // specify V3 initialization
      )) as SimpleAccountFactory;

      // Get the account contract
      const account = await ethers.getContractAt(
        "SimpleAccount",
        accountAddress
      );

      // Verify it's a V1 account
      await expect(account.version()).to.be.reverted;

      // Check if upgrade is needed to V3 (should be true)
      const needsUpgradeBefore = await simpleAccountFactoryV3.upgradeRequired(
        accountAddress,
        await deployer.getAddress(),
        3
      );
      expect(needsUpgradeBefore).to.be.true;

      // Now upgrade the account to V3
      const implementationV3Address =
        await simpleAccountFactoryV3.accountImplementationV3();
      await account.upgradeToAndCall(implementationV3Address, "0x");

      // Verify it's now a V3 account
      expect(await account.version()).to.equal(3n);

      // Check if upgrade is still needed (should be false now)
      const needsUpgradeAfter = await simpleAccountFactoryV3.upgradeRequired(
        accountAddress,
        await deployer.getAddress(),
        3
      );
      expect(needsUpgradeAfter).to.be.false;

      // Create a V3 account directly
      await simpleAccountFactoryV3.createAccount(
        await otherAccounts[0].getAddress()
      );
      const v3AccountAddress = await simpleAccountFactoryV3.getAccountAddress(
        await otherAccounts[0].getAddress()
      );

      const v3Account = await ethers.getContractAt(
        "SimpleAccount",
        v3AccountAddress
      );

      // Verify it's a V3 account
      expect(await v3Account.version()).to.equal(3n);

      // Check if upgrade is needed to V2 (should be false since V3 > V2)
      const needsDowngrade = await simpleAccountFactoryV3.upgradeRequired(
        v3AccountAddress,
        await otherAccounts[0].getAddress(),
        2
      );
      expect(needsDowngrade).to.be.false;
    });

    it("should handle legacy accounts and version parameters correctly", async () => {
      // Get signers
      const [deployer, ...otherAccounts] = await ethers.getSigners();

      // Deploy B3TR token
      const B3TR = await ethers.getContractFactory("B3TR_Mock");
      const b3tr = await B3TR.deploy();
      await b3tr.waitForDeployment();

      // Deploy V1 factory
      const simpleAccountFactoryV1 = (await deployProxy(
        "SimpleAccountFactoryV1",
        [] // initialize with no args
      )) as SimpleAccountFactoryV1;

      // Generate address for a new user
      const legacyUser = otherAccounts[0];
      const legacyAddress = await simpleAccountFactoryV1.getAccountAddress(
        await legacyUser.getAddress()
      );

      // Send B3TR tokens to make it a legacy account without deploying
      await b3tr.transfer(legacyAddress, ethers.parseEther("1"));

      // Deploy V3 implementation for SimpleAccount
      const SmartAccountV3 = await ethers.getContractFactory("SimpleAccount");
      const smartAccountV3Implementation = await SmartAccountV3.deploy();
      await smartAccountV3Implementation.waitForDeployment();

      // Upgrade factory to V3
      const simpleAccountFactoryV3 = (await upgradeProxy(
        "SimpleAccountFactoryV1",
        "SimpleAccountFactory",
        await simpleAccountFactoryV1.getAddress(),
        [
          await smartAccountV3Implementation.getAddress(),
          await b3tr.getAddress(),
        ], // V3 initialization args
        { version: 3 } // specify V3 initialization
      )) as SimpleAccountFactory;

      // Check if upgrade is needed to V3 before deployment
      const needsUpgradeBefore = await simpleAccountFactoryV3.upgradeRequired(
        legacyAddress,
        await legacyUser.getAddress(),
        3
      );
      expect(needsUpgradeBefore).to.be.true;

      // Test with targetVersion = 0 (should use current version = 3)
      const needsUpgradeWithZero = await simpleAccountFactoryV3.upgradeRequired(
        legacyAddress,
        await legacyUser.getAddress(),
        0
      );
      expect(needsUpgradeWithZero).to.be.true;

      // Verify current implementation version is 3
      expect(
        await simpleAccountFactoryV3.currentAccountImplementationVersion()
      ).to.equal(3n);

      // Try to check with targetVersion = 4 (greater than current version = 3)
      await expect(
        simpleAccountFactoryV3.upgradeRequired(
          legacyAddress,
          await legacyUser.getAddress(),
          4
        )
      ).to.be.revertedWith(
        "Target version must be less than or equal to the current version"
      );

      // Try to check with mismatched owner
      const mismatchedOwner = otherAccounts[1];
      const mismatchedAddress = await simpleAccountFactoryV3.getAccountAddress(
        await mismatchedOwner.getAddress()
      );

      await expect(
        simpleAccountFactoryV3.upgradeRequired(
          legacyAddress,
          await mismatchedOwner.getAddress(),
          3
        )
      ).to.be.revertedWith(
        "Account address does not match calculated address of owner"
      );

      // Now deploy the account
      await simpleAccountFactoryV3.createAccount(await legacyUser.getAddress());

      // Get the account contract
      const legacyAccount = await ethers.getContractAt(
        "SimpleAccount",
        legacyAddress
      );

      // Verify it's a V1 account (since it had B3TR balance)
      await expect(legacyAccount.version()).to.be.reverted;

      // Check if upgrade is still needed after deployment (should still be true)
      const needsUpgradeAfterDeploy =
        await simpleAccountFactoryV3.upgradeRequired(
          legacyAddress,
          await legacyUser.getAddress(),
          3
        );
      expect(needsUpgradeAfterDeploy).to.be.true;

      // Now upgrade the account to V3
      const implementationV3Address =
        await simpleAccountFactoryV3.accountImplementationV3();
      await legacyAccount
        .connect(legacyUser)
        .upgradeToAndCall(implementationV3Address, "0x");

      // Verify it's now a V3 account
      expect(await legacyAccount.version()).to.equal(3n);

      // Check if upgrade is still needed (should be false now)
      const needsUpgradeAfterUpgrade =
        await simpleAccountFactoryV3.upgradeRequired(
          legacyAddress,
          await legacyUser.getAddress(),
          3
        );
      expect(needsUpgradeAfterUpgrade).to.be.false;
    });
  });

  describe("getAccountVersion", () => {
    it("should correctly identify version of a deployed V3 account", async () => {
      const { deployer, simpleAccountFactory } =
        await getOrDeployContracts(true);

      // Create a V3 account
      const { smartAccount, smartAccountAddress } =
        await createSmartAccountThroughFactory(deployer);

      // Check version using getAccountVersion
      const [version, isDeployed] =
        await simpleAccountFactory.getAccountVersion(
          smartAccountAddress,
          await deployer.getAddress()
        );

      expect(version).to.equal(3n);
      expect(isDeployed).to.be.true;
    });

    it("should correctly identify version of a deployed V1 account", async () => {
      const { deployer, simpleAccountFactory, b3tr } =
        await getOrDeployContracts(true);

      // Create a V3 account first
      const { smartAccount, smartAccountAddress } =
        await createSmartAccountThroughFactory(deployer);

      // Downgrade to V1
      const ContractV1 = await ethers.getContractFactory("SimpleAccountV1");
      const implementationV1 = await ContractV1.deploy();
      await implementationV1.waitForDeployment();

      await smartAccount.upgradeToAndCall(
        await implementationV1.getAddress(),
        "0x"
      );

      // Check version using getAccountVersion
      const [version, isDeployed] =
        await simpleAccountFactory.getAccountVersion(
          smartAccountAddress,
          await deployer.getAddress()
        );

      expect(version).to.equal(1n);
      expect(isDeployed).to.be.true;
    });

    it("should correctly identify version of a non-deployed legacy account", async () => {
      const { otherAccounts, simpleAccountFactory, b3tr } =
        await getOrDeployContracts(true);

      // Deploy V1 factory
      const simpleAccountFactoryV1 = (await deployProxy(
        "SimpleAccountFactoryV1",
        [] // initialize with no args
      )) as SimpleAccountFactoryV1;

      // Generate address for user with V1 factory
      const legacyUser = otherAccounts[0];
      const legacyAddress = await simpleAccountFactoryV1.getAccountAddress(
        await legacyUser.getAddress()
      );

      // Send B3TR tokens to make it a legacy account without deploying
      await b3tr.transfer(legacyAddress, ethers.parseEther("1"));

      // Upgrade factory to V3
      const SmartAccountV3 = await ethers.getContractFactory("SimpleAccount");
      const smartAccountV3 = await SmartAccountV3.deploy();
      await smartAccountV3.waitForDeployment();

      const simpleAccountFactoryV3 = (await upgradeProxy(
        "SimpleAccountFactoryV1",
        "SimpleAccountFactory",
        await simpleAccountFactoryV1.getAddress(),
        [await smartAccountV3.getAddress(), await b3tr.getAddress()],
        { version: 3 }
      )) as SimpleAccountFactory;

      // Check version using getAccountVersion
      const [version, isDeployed] =
        await simpleAccountFactoryV3.getAccountVersion(
          legacyAddress,
          await legacyUser.getAddress()
        );

      expect(version).to.equal(1n);
      expect(isDeployed).to.be.false;
    });

    it("should correctly identify version of a non-deployed new account", async () => {
      const { otherAccounts, simpleAccountFactory } =
        await getOrDeployContracts(true);

      // Get address for a new account that hasn't been deployed
      const newUser = otherAccounts[0];
      const newAddress = await simpleAccountFactory.getAccountAddress(
        await newUser.getAddress()
      );

      // Check that it's not deployed
      const code = await ethers.provider.getCode(newAddress);
      expect(code).to.equal("0x");

      // Check version using getAccountVersion
      const [version, isDeployed] =
        await simpleAccountFactory.getAccountVersion(
          newAddress,
          await newUser.getAddress()
        );

      // Should be the current implementation version (V3)
      expect(version).to.equal(
        await simpleAccountFactory.currentAccountImplementationVersion()
      );
      expect(isDeployed).to.be.false;
    });

    it("should revert if account address doesn't match calculated address", async () => {
      const { deployer, otherAccounts, simpleAccountFactory } =
        await getOrDeployContracts(true);

      // Get address for owner1
      const owner1 = deployer;
      const owner1Address = await simpleAccountFactory.getAccountAddress(
        await owner1.getAddress()
      );

      // Try to check version with mismatched owner
      const owner2 = otherAccounts[0];

      await expect(
        simpleAccountFactory.getAccountVersion(
          owner1Address,
          await owner2.getAddress()
        )
      ).to.be.revertedWith(
        "Account address does not match calculated address of owner"
      );
    });
  });
});
