import { expect } from "chai";
import { getOrDeployContracts } from "./helpers/deploy";
import { ethers } from "hardhat";
import { createSmartAccountThroughFactory } from "./helpers/common";
import { SimpleAccount } from "../typechain-types";

describe("SimpleAccount", () => {
  describe("Management", () => {
    it("Can get the contract version", async () => {
      const { simpleAccountFactory, deployer } =
        await getOrDeployContracts(true);

      const smartAccountAddress = await simpleAccountFactory.getAccountAddress(
        await deployer.getAddress()
      );

      await simpleAccountFactory.createAccount(await deployer.getAddress());

      const account = (await ethers.getContractAt(
        "SimpleAccount",
        smartAccountAddress
      )) as SimpleAccount;

      const version = await account.version();

      expect(version).to.equal(3n);
    });

    it("owner (and only owner) can upgrade the account", async () => {
      const { deployer, otherAccounts } = await getOrDeployContracts(true);

      const { smartAccount } = await createSmartAccountThroughFactory(deployer);
      expect(await smartAccount.version()).to.equal(3n);

      // let' deploy a new implementation
      const Contract = await ethers.getContractFactory("SimpleAccountV2");
      const implementation = await Contract.deploy();
      await implementation.waitForDeployment();

      await smartAccount.upgradeToAndCall(
        await implementation.getAddress(),
        "0x"
      );

      expect(await smartAccount.version()).to.equal("2");

      // another user cannot upgrade the account
      const anotherUser = otherAccounts[0];

      await expect(
        smartAccount
          .connect(anotherUser)
          .upgradeToAndCall(await implementation.getAddress(), "0x")
      ).to.be.reverted;
    });

    it("owner can transfer the ownership of the account", async () => {
      const { deployer, otherAccounts } = await getOrDeployContracts(true);

      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      expect(await smartAccount.owner()).to.equal(await deployer.getAddress());

      const newOwner = otherAccounts[0];

      await smartAccount.transferOwnership(await newOwner.getAddress());

      expect(await smartAccount.owner()).to.equal(await newOwner.getAddress());
    });

    it("owner can upgrade the account by providing a signature", async () => {
      const { deployer, otherAccounts } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      const Contract = await ethers.getContractFactory("SimpleAccountV2");
      const implementation = await Contract.deploy();
      await implementation.waitForDeployment();

      const chainId = await ethers.provider.getNetwork().then((n) => n.chainId);
      const to = await smartAccount.getAddress();

      // Encode the upgradeToAndCall function call
      const data = smartAccount.interface.encodeFunctionData(
        "upgradeToAndCall",
        [await implementation.getAddress(), "0x"]
      );

      const domain = {
        name: "Wallet",
        version: "1",
        chainId: Number(chainId),
        verifyingContract: await smartAccount.getAddress(),
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

      const message = {
        to,
        value: ethers.parseEther("0"),
        data, // Use the encoded function data
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 60,
      };

      const signature = await deployer.signTypedData(domain, types, message);

      await expect(
        smartAccount
          .connect(otherAccounts[0])
          .executeWithAuthorization(
            to,
            message.value,
            data,
            0,
            Math.floor(Date.now() / 1000) + 60,
            signature
          )
      ).to.not.be.reverted;

      expect(await smartAccount.version()).to.equal("2");
    });
  });

  describe("Execution", () => {
    it("owner (and only owner) can execute a function call", async () => {
      const { deployer, otherAccounts } = await getOrDeployContracts(true);

      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      // excute a transfer of 0 ETH
      expect(
        smartAccount.execute(
          await deployer.getAddress(),
          ethers.parseEther("0"),
          "0x"
        )
      ).to.not.be.reverted;

      expect(
        smartAccount
          .connect(otherAccounts[0])
          .execute(
            await otherAccounts[0].getAddress(),
            ethers.parseEther("0"),
            "0x"
          )
      ).to.be.reverted;
    });

    it("owner (and only owner) can batch execute a function calls", async () => {
      const { deployer, otherAccounts } = await getOrDeployContracts(true);

      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      expect(
        smartAccount.executeBatch(
          [await deployer.getAddress(), await deployer.getAddress()],
          [ethers.parseEther("0"), ethers.parseEther("0")],
          ["0x", "0x"]
        )
      ).to.not.be.reverted;

      expect(
        smartAccount
          .connect(otherAccounts[0])
          .executeBatch(
            [await deployer.getAddress(), await deployer.getAddress()],
            [ethers.parseEther("0"), ethers.parseEther("0")],
            ["0x", "0x"]
          )
      ).to.be.reverted;
    });

    it("owner (and only owner) can execute a function by providing a signature", async () => {
      const { deployer, otherAccounts } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      const chainId = await ethers.provider.getNetwork().then((n) => n.chainId);
      const to = await deployer.getAddress();
      const value = ethers.parseEther("0");
      const data = "0x";

      const domain = {
        name: "Wallet",
        version: "1",
        chainId: Number(chainId),
        verifyingContract: await smartAccount.getAddress(),
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

      const message = {
        to,
        value,
        data,
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 120, // valid for 120 seconds
      };

      const signature = await deployer.signTypedData(domain, types, message);

      await expect(
        smartAccount.executeWithAuthorization(
          message.to,
          message.value,
          message.data,
          message.validAfter,
          message.validBefore,
          signature
        )
      ).to.not.be.reverted;

      // if instead of the owner, another wallet signs, the transaction should revert
      const anotherUser = otherAccounts[0];

      const anotherSignature = await anotherUser.signTypedData(
        domain,
        types,
        message
      );

      await expect(
        smartAccount.executeWithAuthorization(
          message.to,
          message.value,
          message.data,
          message.validAfter,
          message.validBefore,
          anotherSignature
        )
      ).to.be.reverted;
    });

    it("can not execute with signature if the message is not valid", async () => {
      const { deployer, otherAccounts } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      const chainId = await ethers.provider.getNetwork().then((n) => n.chainId);
      const to = await deployer.getAddress();
      const value = ethers.parseEther("0");
      const data = "0x";

      const domain = {
        name: "Wallet",
        version: "1",
        chainId: Number(chainId),
        verifyingContract: await smartAccount.getAddress(),
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

      // The test is failing (as expected) because it's trying to execute a transaction with an expired signature. The smart contract is correctly rejecting it because:
      // Current time is now
      // The signature's validBefore time is now - 60 (60 seconds in the past)
      // 3. Therefore, the signature has expired and the transaction reverts
      // This is actually testing the correct behavior - that expired signatures cannot be used. If you want to test a valid signature instead, you should use + 60 to set the expiration 60 seconds in the future.
      const message = {
        to,
        value,
        data,
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) - 60, // valid for 60 seconds
      };

      const signature = await deployer.signTypedData(domain, types, message);

      await expect(
        smartAccount.executeWithAuthorization(
          message.to,
          message.value,
          message.data,
          message.validAfter,
          message.validBefore,
          signature
        )
      ).to.be.reverted;
    });

    it("cannot execute with signature if parameters differ from signed message", async () => {
      const { deployer } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      const chainId = await ethers.provider.getNetwork().then((n) => n.chainId);
      const to = await deployer.getAddress();
      const value = ethers.parseEther("0");
      const data = "0x";

      const domain = {
        name: "Wallet",
        version: "1",
        chainId: Number(chainId),
        verifyingContract: await smartAccount.getAddress(),
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

      const message = {
        to,
        value,
        data,
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 60,
      };

      const signature = await deployer.signTypedData(domain, types, message);

      // Try to execute with a different value than what was signed
      const differentValue = ethers.parseEther("1");
      await expect(
        smartAccount.executeWithAuthorization(
          message.to,
          differentValue, // Different value than what was signed
          message.data,
          message.validAfter,
          message.validBefore,
          signature
        )
      ).to.be.reverted;
    });

    it("can batch execute function calls by providing signatures", async () => {
      const { deployer, otherAccounts } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      const chainId = await ethers.provider.getNetwork().then((n) => n.chainId);

      const domain = {
        name: "Wallet",
        version: "1",
        chainId: Number(chainId),
        verifyingContract: await smartAccount.getAddress(),
      };

      const types = {
        ExecuteBatchWithAuthorization: [
          { name: "to", type: "address[]" },
          { name: "value", type: "uint256[]" },
          { name: "data", type: "bytes[]" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      };

      const transactions = [
        {
          to: await deployer.getAddress(),
          value: ethers.parseEther("0"),
          data: ethers.hexlify(ethers.toUtf8Bytes("test1")), // More standardized data format
        },
        {
          to: await otherAccounts[0].getAddress(),
          value: ethers.parseEther("0"),
          data: ethers.hexlify(ethers.toUtf8Bytes("test2")),
        },
        {
          to: await otherAccounts[1].getAddress(),
          value: ethers.parseEther("0"),
          data: ethers.hexlify(ethers.toUtf8Bytes("test3")),
        },
      ];

      const validBefore = Math.floor(Date.now() / 1000) + 3600;
      const validAfter = 0;

      const message = {
        to: transactions.map((t) => t.to),
        value: transactions.map((t) => t.value),
        data: transactions.map((t) => t.data),
        validAfter,
        validBefore,
        nonce: ethers.randomBytes(32),
      };

      const signature = await deployer.signTypedData(domain, types, message);

      await expect(
        smartAccount.executeBatchWithAuthorization(
          message.to,
          message.value,
          message.data,
          message.validAfter,
          message.validBefore,
          message.nonce,
          signature
        )
      ).to.not.be.reverted;
    });

    it("can batch execute transfer and transferOwnership with signatures", async () => {
      const { deployer, otherAccounts } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      const chainId = await ethers.provider.getNetwork().then((n) => n.chainId);
      const newOwner = otherAccounts[0];

      const domain = {
        name: "Wallet",
        version: "1",
        chainId: Number(chainId),
        verifyingContract: await smartAccount.getAddress(),
      };

      const types = {
        ExecuteBatchWithAuthorization: [
          { name: "to", type: "address[]" },
          { name: "value", type: "uint256[]" },
          { name: "data", type: "bytes[]" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      };

      const transferOwnershipData = smartAccount.interface.encodeFunctionData(
        "transferOwnership",
        [await newOwner.getAddress()]
      );

      const transactions = [
        {
          to: await deployer.getAddress(),
          value: ethers.parseEther("0"),
          data: "0x", // empty data for ETH transfer
        },
        {
          to: await smartAccount.getAddress(),
          value: ethers.parseEther("0"),
          data: transferOwnershipData,
        },
      ];

      const validBefore = Math.floor(Date.now() / 1000) + 3600;
      const validAfter = 0;

      const message = {
        to: transactions.map((t) => t.to),
        value: transactions.map((t) => t.value),
        data: transactions.map((t) => t.data),
        validAfter,
        validBefore,
        nonce: ethers.randomBytes(32),
      };

      const signature = await deployer.signTypedData(domain, types, message);

      await expect(
        smartAccount.executeBatchWithAuthorization(
          message.to,
          message.value,
          message.data,
          message.validAfter,
          message.validBefore,
          message.nonce,
          signature
        )
      ).to.not.be.reverted;

      // Verify ownership was transferred
      expect(await smartAccount.owner()).to.equal(await newOwner.getAddress());
    });
  });
});
