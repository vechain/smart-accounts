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

      // old owner cannot transfer ownership again
      await expect(
        smartAccount
          .connect(deployer)
          .transferOwnership(await newOwner.getAddress())
      ).to.be.revertedWith("only owner");
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

    it("cannot transfer ownership to zero address", async () => {
      const { deployer } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      // Try to transfer ownership to zero address
      await expect(
        smartAccount.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("Cannot transfer ownership to the zero address");

      // Verify ownership hasn't changed
      expect(await smartAccount.owner()).to.equal(await deployer.getAddress());
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

      // Test with empty value array (should default to zero values)
      expect(
        smartAccount.executeBatch(
          [await deployer.getAddress(), await deployer.getAddress()],
          [], // empty value array
          ["0x", "0x"]
        )
      ).to.not.be.reverted;

      // Test with explicit value array
      expect(
        smartAccount.executeBatch(
          [await deployer.getAddress(), await deployer.getAddress()],
          [ethers.parseEther("0"), ethers.parseEther("0")],
          ["0x", "0x"]
        )
      ).to.not.be.reverted;

      // Test that non-owner cannot execute
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

    it("executeBatch reverts if array lengths don't match", async () => {
      const { deployer } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      // Test when dest.length != func.length
      await expect(
        smartAccount.executeBatch(
          [await deployer.getAddress(), await deployer.getAddress()], // length 2
          [], // empty value array is ok
          ["0x"] // length 1
        )
      ).to.be.revertedWith("wrong array lengths");

      // Test when value array length doesn't match (when not empty)
      await expect(
        smartAccount.executeBatch(
          [await deployer.getAddress(), await deployer.getAddress()], // length 2
          [ethers.parseEther("0")], // length 1
          ["0x", "0x"] // length 2
        )
      ).to.be.revertedWith("wrong array lengths");

      // Test when all arrays have different lengths
      await expect(
        smartAccount.executeBatch(
          [await deployer.getAddress(), await deployer.getAddress()], // length 2
          [ethers.parseEther("0")], // length 1
          ["0x"] // length 1
        )
      ).to.be.revertedWith("wrong array lengths");
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

    it("cannot execute with signature if validAfter is in the future", async () => {
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
        validAfter: Math.floor(Date.now() / 1000) + 3600, // 1 hour in the future
        validBefore: Math.floor(Date.now() / 1000) + 7200, // 2 hours in the future
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
      ).to.be.revertedWith("Authorization not yet valid");
    });

    it("cannot execute with signature if validBefore is in the past", async () => {
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
        validAfter: Math.floor(Date.now() / 1000) - 7200, // 2 hours in the past
        validBefore: Math.floor(Date.now() / 1000) - 3600, // 1 hour in the past
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
      ).to.be.revertedWith("Authorization expired");
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

    it("cannot execute batch with signature if array lengths don't match", async () => {
      const { deployer } = await getOrDeployContracts(true);
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

      // Create mismatched arrays
      const message = {
        to: [await deployer.getAddress(), await deployer.getAddress()], // length 2
        value: [ethers.parseEther("0")], // length 1
        data: ["0x"], // length 1
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 3600,
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
      ).to.be.revertedWith("Array lengths mismatch");
    });

    it("cannot execute batch with signature if validAfter is in the future", async () => {
      const { deployer } = await getOrDeployContracts(true);
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
          data: ethers.hexlify(ethers.toUtf8Bytes("test")),
        },
      ];

      const message = {
        to: transactions.map((t) => t.to),
        value: transactions.map((t) => t.value),
        data: transactions.map((t) => t.data),
        validAfter: Math.floor(Date.now() / 1000) + 3600, // 1 hour in the future
        validBefore: Math.floor(Date.now() / 1000) + 7200, // 2 hours in the future
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
      ).to.be.revertedWith("Authorization not yet valid");
    });

    it("cannot execute batch with signature if validBefore is in the past", async () => {
      const { deployer } = await getOrDeployContracts(true);
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
          data: ethers.hexlify(ethers.toUtf8Bytes("test")),
        },
      ];

      const message = {
        to: transactions.map((t) => t.to),
        value: transactions.map((t) => t.value),
        data: transactions.map((t) => t.data),
        validAfter: Math.floor(Date.now() / 1000) - 7200, // 2 hours in the past
        validBefore: Math.floor(Date.now() / 1000) - 3600, // 1 hour in the past
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
      ).to.be.revertedWith("Authorization expired");
    });

    it("should bubble up revert messages from failed calls", async () => {
      const { deployer } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      // Deploy a mock contract that will revert with a message
      const mockContract = await ethers.deployContract("MockReverting");
      await mockContract.waitForDeployment();

      // Get the revert function's encoded data
      const revertData =
        mockContract.interface.encodeFunctionData("revertWithMessage");

      // Try to execute the reverting call through the smart account
      await expect(
        smartAccount.execute(await mockContract.getAddress(), 0, revertData)
      ).to.be.revertedWith("Custom revert message");
    });
  });

  describe("TokenCallbackHandler", () => {
    it("supports ERC721 and ERC1155 interfaces", async () => {
      const { deployer } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      // Check interface support
      const ERC721_RECEIVER_INTERFACE_ID = "0x150b7a02";
      const ERC1155_RECEIVER_INTERFACE_ID = "0x4e2312e0";
      const ERC165_INTERFACE_ID = "0x01ffc9a7";

      expect(await smartAccount.supportsInterface(ERC721_RECEIVER_INTERFACE_ID))
        .to.be.true;
      expect(
        await smartAccount.supportsInterface(ERC1155_RECEIVER_INTERFACE_ID)
      ).to.be.true;
      expect(await smartAccount.supportsInterface(ERC165_INTERFACE_ID)).to.be
        .true;
    });

    it("can receive ERC721 tokens", async () => {
      const { deployer, otherAccounts } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      // Deploy ERC721 mock
      const erc721 = await ethers.deployContract("MyERC721", [
        await deployer.getAddress(),
      ]);
      await erc721.waitForDeployment();

      // Mint token to deployer
      const tokenId = 1;
      await erc721.safeMint(await deployer.getAddress(), tokenId);

      // Approve smart account
      await erc721.approve(await smartAccount.getAddress(), tokenId);

      // Transfer to smart account
      await erc721.transferFrom(
        await deployer.getAddress(),
        await smartAccount.getAddress(),
        tokenId
      );

      // Verify ownership
      expect(await erc721.ownerOf(tokenId)).to.equal(
        await smartAccount.getAddress()
      );
    });

    it("can receive ERC1155 tokens", async () => {
      const { deployer } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      // Deploy ERC1155 mock
      const erc1155 = await ethers.deployContract("MyERC1155", [
        await deployer.getAddress(),
      ]);
      await erc1155.waitForDeployment();

      // Mint tokens
      const id = 1;
      const amount = 100;
      await erc1155.mint(await deployer.getAddress(), id, amount, "0x");

      // Transfer to smart account
      await erc1155.safeTransferFrom(
        await deployer.getAddress(),
        await smartAccount.getAddress(),
        id,
        amount,
        "0x"
      );

      // Verify balance
      expect(
        await erc1155.balanceOf(await smartAccount.getAddress(), id)
      ).to.equal(amount);
    });

    it("can receive batch ERC1155 tokens", async () => {
      const { deployer } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      // Deploy ERC1155 mock
      const erc1155 = await ethers.deployContract("MyERC1155", [
        await deployer.getAddress(),
      ]);
      await erc1155.waitForDeployment();

      // Mint multiple tokens
      const ids = [1, 2, 3];
      const amounts = [100, 200, 300];
      await erc1155.mintBatch(await deployer.getAddress(), ids, amounts, "0x");

      // Transfer batch to smart account
      await erc1155.safeBatchTransferFrom(
        await deployer.getAddress(),
        await smartAccount.getAddress(),
        ids,
        amounts,
        "0x"
      );

      // Verify balances
      for (let i = 0; i < ids.length; i++) {
        expect(
          await erc1155.balanceOf(await smartAccount.getAddress(), ids[i])
        ).to.equal(amounts[i]);
      }
    });

    it("can transfer received tokens through owner execution", async () => {
      const { deployer, otherAccounts } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);
      const recipient = otherAccounts[0];

      // Deploy and setup ERC721
      const erc721 = await ethers.deployContract("MyERC721", [
        await deployer.getAddress(),
      ]);
      await erc721.waitForDeployment();

      const tokenId = 1;
      await erc721.safeMint(await smartAccount.getAddress(), tokenId);

      // Owner executes transfer of ERC721 from smart account
      const transferData = erc721.interface.encodeFunctionData("transferFrom", [
        await smartAccount.getAddress(),
        await recipient.getAddress(),
        tokenId,
      ]);

      await smartAccount.execute(await erc721.getAddress(), 0, transferData);

      // Verify transfer
      expect(await erc721.ownerOf(tokenId)).to.equal(
        await recipient.getAddress()
      );
    });

    it("cannot reuse nonce in batch execution with signature", async () => {
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
          data: ethers.hexlify(ethers.toUtf8Bytes("test")),
        },
      ];

      // Create a message with a specific nonce
      const nonce = ethers.randomBytes(32);
      const message = {
        to: transactions.map((t) => t.to),
        value: transactions.map((t) => t.value),
        data: transactions.map((t) => t.data),
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 3600,
        nonce: nonce,
      };

      const signature = await deployer.signTypedData(domain, types, message);

      // First execution should succeed
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

      // Second execution with the same nonce should fail
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
      ).to.be.revertedWith("Nonce already used, please sign a new transaction");
    });

    it("cannot execute batch with signature from non-owner", async () => {
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
          data: ethers.hexlify(ethers.toUtf8Bytes("test")),
        },
      ];

      const message = {
        to: transactions.map((t) => t.to),
        value: transactions.map((t) => t.value),
        data: transactions.map((t) => t.data),
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 3600,
        nonce: ethers.randomBytes(32),
      };

      // Sign with a non-owner account
      const nonOwner = otherAccounts[0];
      const signature = await nonOwner.signTypedData(domain, types, message);

      const expectedOwner = await deployer.getAddress();
      const actualSigner = await nonOwner.getAddress();

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
      ).to.be.revertedWith(
        `Invalid signer. Expected: ${expectedOwner.toLowerCase()} Got: ${actualSigner.toLowerCase()}`
      );
    });
  });

  describe("Custom Authorization", () => {
    it("should execute batch with custom domain separator", async () => {
      const { deployer, otherAccounts } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      // Setup test transactions
      const transactions = [
        {
          to: await otherAccounts[0].getAddress(),
          value: ethers.parseEther("0"),
          data: ethers.hexlify(ethers.toUtf8Bytes("test1")),
        },
        {
          to: await otherAccounts[1].getAddress(),
          value: ethers.parseEther("0"),
          data: ethers.hexlify(ethers.toUtf8Bytes("test2")),
        },
      ];

      const chainId = await ethers.provider
        .getNetwork()
        .then((n) => Number(n.chainId));
      const maskedChainId = chainId & 0xffff; // Apply the mask as done in the contract

      const domain = {
        name: "Wallet",
        version: "1",
        chainId: Number(maskedChainId),
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

      const message = {
        to: transactions.map((t) => t.to),
        value: transactions.map((t) => t.value),
        data: transactions.map((t) => t.data),
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        nonce: ethers.randomBytes(32),
      };

      const signature = await deployer.signTypedData(domain, types, message);

      // Execute the batch
      await expect(
        smartAccount.executeBatchWithCustomAuthorization(
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

    it("should fail with mismatched array lengths", async () => {
      const { deployer } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      const nonce = ethers.randomBytes(32);
      const validAfter = 0;
      const validBefore = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        smartAccount.executeBatchWithCustomAuthorization(
          [ethers.ZeroAddress],
          [],
          ["0x"],
          validAfter,
          validBefore,
          nonce,
          "0x"
        )
      ).to.be.revertedWith("Array lengths mismatch");
    });

    it("should not allow reuse of nonce", async () => {
      const { deployer, otherAccounts } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      const transactions = [
        {
          to: await otherAccounts[0].getAddress(),
          value: ethers.parseEther("0"),
          data: ethers.hexlify(ethers.toUtf8Bytes("test")),
        },
      ];

      const chainId = await ethers.provider
        .getNetwork()
        .then((n) => Number(n.chainId));
      const maskedChainId = chainId & 0xffff;

      const domain = {
        name: "Wallet",
        version: "1",
        chainId: Number(maskedChainId),
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

      const message = {
        to: transactions.map((t) => t.to),
        value: transactions.map((t) => t.value),
        data: transactions.map((t) => t.data),
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 3600,
        nonce: ethers.randomBytes(32),
      };

      const signature = await deployer.signTypedData(domain, types, message);

      // First execution should succeed
      await smartAccount.executeBatchWithCustomAuthorization(
        message.to,
        message.value,
        message.data,
        message.validAfter,
        message.validBefore,
        message.nonce,
        signature
      );

      // Second execution with same nonce should fail
      await expect(
        smartAccount.executeBatchWithCustomAuthorization(
          message.to,
          message.value,
          message.data,
          message.validAfter,
          message.validBefore,
          message.nonce,
          signature
        )
      ).to.be.revertedWith("Nonce already used, please sign a new transaction");
    });

    it("should verify custom domain separator parameters", async () => {
      const { deployer } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      const [
        fields,
        name,
        version,
        chainId,
        verifyingContract,
        salt,
        extensions,
      ] = await smartAccount.customEip712Domain();

      expect(fields).to.equal("0x0f");
      expect(name).to.equal("Wallet");
      expect(version).to.equal("1");
      expect(verifyingContract).to.equal(await smartAccount.getAddress());
      expect(salt).to.equal(ethers.ZeroHash);
      expect(extensions.length).to.equal(0);

      const expectedChainId =
        (await ethers.provider.getNetwork().then((n) => Number(n.chainId))) &
        0xffff;
      expect(chainId).to.equal(expectedChainId);
    });

    it("should fail if authorization is not yet valid", async () => {
      const { deployer, otherAccounts } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      const chainId = await ethers.provider
        .getNetwork()
        .then((n) => Number(n.chainId));
      const maskedChainId = chainId & 0xffff;

      const domain = {
        name: "Wallet",
        version: "1",
        chainId: maskedChainId,
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

      const message = {
        to: [await otherAccounts[0].getAddress()],
        value: [ethers.parseEther("0")],
        data: ["0x"],
        validAfter: Math.floor(Date.now() / 1000) + 3600, // 1 hour in the future
        validBefore: Math.floor(Date.now() / 1000) + 7200, // 2 hours in the future
        nonce: ethers.randomBytes(32),
      };

      const signature = await deployer.signTypedData(domain, types, message);

      await expect(
        smartAccount.executeBatchWithCustomAuthorization(
          message.to,
          message.value,
          message.data,
          message.validAfter,
          message.validBefore,
          message.nonce,
          signature
        )
      ).to.be.revertedWith("Authorization not yet valid");
    });

    it("should fail if authorization has expired", async () => {
      const { deployer, otherAccounts } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      const chainId = await ethers.provider
        .getNetwork()
        .then((n) => Number(n.chainId));
      const maskedChainId = chainId & 0xffff;

      const domain = {
        name: "Wallet",
        version: "1",
        chainId: maskedChainId,
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

      const message = {
        to: [await otherAccounts[0].getAddress()],
        value: [ethers.parseEther("0")],
        data: ["0x"],
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) - 3600, // 1 hour in the past
        nonce: ethers.randomBytes(32),
      };

      const signature = await deployer.signTypedData(domain, types, message);

      await expect(
        smartAccount.executeBatchWithCustomAuthorization(
          message.to,
          message.value,
          message.data,
          message.validAfter,
          message.validBefore,
          message.nonce,
          signature
        )
      ).to.be.revertedWith("Authorization expired");
    });

    it("should fail with invalid signer and show correct error message", async () => {
      const { deployer, otherAccounts } = await getOrDeployContracts(true);
      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      const chainId = await ethers.provider
        .getNetwork()
        .then((n) => Number(n.chainId));
      const maskedChainId = chainId & 0xffff;

      const domain = {
        name: "Wallet",
        version: "1",
        chainId: maskedChainId,
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

      const message = {
        to: [await otherAccounts[0].getAddress()],
        value: [ethers.parseEther("0")],
        data: ["0x"],
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 3600,
        nonce: ethers.randomBytes(32),
      };

      // Sign with a non-owner account
      const nonOwner = otherAccounts[0];
      const signature = await nonOwner.signTypedData(domain, types, message);

      const expectedOwner = await deployer.getAddress();
      const actualSigner = await nonOwner.getAddress();

      await expect(
        smartAccount.executeBatchWithCustomAuthorization(
          message.to,
          message.value,
          message.data,
          message.validAfter,
          message.validBefore,
          message.nonce,
          signature
        )
      ).to.be.revertedWith(
        `Invalid signer. Expected: ${expectedOwner.toLowerCase()} Got: ${actualSigner.toLowerCase()}`
      );
    });
  });
});
