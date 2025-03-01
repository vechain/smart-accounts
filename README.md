# Smart accounts for social login

[![codecov](https://codecov.io/gh/vechain/smart-accounts/graph/badge.svg?token=3OMYFKUMS9)](https://app.codecov.io/gh/vechain/smart-accounts)

Try out the live demo [here](https://vechain.github.io/smart-accounts/).

## Table of Contents

- [Overview](#overview)
- [Addresses](#addresses)
- [How it works](#how-it-works)
- [Version Management](#version-management)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)

## Overview

This is a simplified version of the [Account Abstraction pattern](https://eips.ethereum.org/EIPS/eip-4337) for the vechain blockchain.
Concepts like `UserOperation`, `Bundler`, and `EntryPoint` are not implemented, only the basic account abstraction pattern is implemented,
in order to provide a light-weight solution for social login and for developers.

Currently the smart accounts created through this factory are used to enable social login on VeChain.

## Addresses

### Mainnet

[0xC06Ad8573022e2BE416CA89DA47E8c592971679A](https://vechainstats.com/account/0xc06ad8573022e2be416ca89da47e8c592971679a/)

### Testnet

[0x7EABA81B4F3741Ac381af7e025f3B6e0428F05Fb](https://explore-testnet.vechain.org/accounts/0x7eaba81b4f3741ac381af7e025f3b6e0428f05fb)

## How it works

There are 2 contracts that work together to enable social login and account abstraction:

- **SimpleAccount**: A smart contract wallet owned by the user that can:

  - Execute transactions directly from the owner or through signed messages
  - Handle both single and batch transactions
  - Be upgraded by the owner
  - Transfer ownership to another address
  - Use time-based validity windows for transactions
  - Prevent replay attacks using nonces for batch transactions

- **SimpleAccountFactory**: Factory contract that creates and manages SimpleAccount contracts:
  - Creates new accounts with deterministic addresses using CREATE2
  - Supports multiple accounts per owner through custom salts
  - Manages different versions of the SimpleAccount implementation
  - Maintains compatibility with legacy accounts

### Transaction Flow

1. **Account Creation**: When a user wants to create a smart account, they interact with the SimpleAccountFactory, which creates a new SimpleAccount instance with the user as the owner.

2. **Transaction Execution**: The SimpleAccount can execute transactions in several ways:

   - Direct execution by the owner
   - Batch execution of multiple transactions
   - Signature-based execution (useful for social login)
   - Batch signature-based execution with replay protection (useful for social login + multiclause)

3. **Nonce Management**: For batch transactions with authorization (executeBatchWithAuthorization), a nonce is required to protect users against replay attacks:

   - The nonce should be generated when requesting the signature
   - Best practice is to use `Date.now()` as the nonce value
   - Each nonce can only be used once per account
   - Without proper nonce management, malicious actors could replay the same signed transaction multiple times
   - Nonces are only used and required for executeBatchWithAuthorization method

4. **Social Login Integration**: This system enables social login by creating deterministic account addresses for each user and allowing transactions to be signed off-chain and executed by anyone. This creates a seamless experience where users can interact with dApps using their social credentials.

## Version Management

The system has evolved through multiple versions to improve functionality and security:

- **SimpleAccount**:

  - V1: Basic account functionality with single transaction execution
  - V2: _Skipped for misconfiguration during upgrade_
  - V3: Introduced batch transactions with nonce-based replay protection, ownership transfer and version tracking

- **SimpleAccountFactory**:
  - V1: Basic account creation and management
  - V2: Added support for multiple accounts per owner using custom salts
  - V3: Support for V3 SimpleAccounts, enhanced version management and backward compatibility with legacy accounts

The factory maintains compatibility with all account versions, ensuring a smooth experience across different dApps and versions.

You can fork the contracts and deploy them on your own, **but we recommend using our deployed contracts for a better cross-app compatibility**.

## Project Structure

### Frontend (apps/frontend) 🌐

There's a frontend (powered by React/Vite) that shows useful information about how the smart accounts are being used. It also offers a convenient way to interact with and view statistics for the deployed contracts.

### Contracts (packages/contracts) 📜

The smart contracts in this project are managed using Hardhat, specifically configured to work with the VeChain Thor network. This setup allows you to compile, test, and deploy the contracts seamlessly to VeChain testnet or mainnet environments.

## Getting Started

Clone the repository and install dependencies with ease:

```bash
yarn # Run this at the root level of the project
```

Place your `.env` files in the root folder, you can copy `.env.example`

### Run the whole project (frontend + contracts):

The following commands will check if the contracts are alrady deployed on the selected network, if not it will deploy them, then start the frontend web app.

```bash
  yarn dev:mainnet
```

```bash
  yarn dev:testnet
```

### Deploy contracts:

```bash
  yarn contracts:deploy:testnet
```

### Run tests

```bash
  yarn contracts:test
```

### Run tests with coverage

```bash
  yarn contracts:test:coverage
```

Open the coverage report in the `packages/contracts/coverage/index.html` file in your browser to see the test coverage.

### Generate documentation

```bash
  yarn contracts:generate-docs
```

## Documentation

Detailed documentation for the smart contracts is available:

- [SimpleAccount Documentation](./packages/contracts/docs/accounts/SimpleAccount.md) - Complete API reference and implementation details for the SimpleAccount contract
- [SimpleAccountFactory Documentation](./packages/contracts/docs/accounts/SimpleAccountFactory.md) - Complete API reference and implementation details for the SimpleAccountFactory contract

## Social Login with Smart Accounts

Implement the Social Login with Smart Accounts in your app with [VeChain Kit](https://github.com/vechain/vechain-kit).

Documentation and examples are available in the [VeChain Kit Docs](https://docs.vechainkit.vechain.org).
