# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Yarn workspaces + Turborepo monorepo. Node 20.18.3 (see `.nvmrc`), `yarn@1.22.17`.

- `apps/frontend` — React + Vite stats dashboard for the deployed contracts (uses `@vechain/vechain-kit`, Chakra UI, TanStack Query).
- `packages/contracts` — Hardhat project containing the Solidity smart accounts, deploy / upgrade / verify scripts, and TypeChain output. Re-exports the `SimpleAccountFactory` ABI + factory for downstream consumers via `index.ts`.
- `packages/config` — Per-env (`testnet`, `mainnet`) app config + contract config. `getConfig()` reads `VITE_APP_ENV`. Also generates a local mock config (`scripts/generateMockLocalConfig.mjs`) that every other workspace's turbo pipeline depends on (`@repo/config#check-or-generate-local-config`).
- `packages/constants` — Network constants (URLs, chain IDs).
- `packages/utils` — Address / contract / formatting / hex / Picasso helpers shared between frontend and contracts.

## Common commands

Run from the repo root unless noted. Most commands flow through Turbo and require `VITE_APP_ENV` to be set (the root scripts already do this via `dotenv-cli`).

- `yarn` — install (root only).
- `yarn dev:testnet` / `yarn dev:mainnet` — installs, ensures contracts are deployed on the selected network (deploys on solo/testnet if missing), then starts the frontend.
- `yarn build:testnet` / `yarn build:mainnet` — production frontend build, depends on `check-contracts-deployment:mainnet`.
- `yarn contracts:compile` — `hardhat compile` for the contracts package.
- `yarn contracts:test` — Hardhat unit tests (`test:hardhat` filter, runs against the in-process `hardhat` network).
- `yarn workspace @repo/contracts test:thor-solo` — same tests against a running Thor solo node (see "Thor solo" below).
- `yarn test:coverage:solidity` — `solidity-coverage`. Output HTML lives at `packages/contracts/coverage/index.html`.
- `yarn contracts:deploy:testnet` / `yarn contracts:deploy:mainnet` — deploy via Hardhat scripts.
- `yarn contracts:upgrade[:testnet|:mainnet]` — interactive upgrade picker (`scripts/upgrade/select-and-upgrade.ts`); uses inquirer to choose a contract + version from `upgradesConfig.ts`, then `turbo run upgrade:contract:<env>` which executes `scripts/upgrade/upgrades/<contract>/<contract>-<version>.ts`.
- `yarn contracts:verify:testnet <address>` / `:mainnet <address>` — Sourcify verification (Hardhat throws after success; expected).
- `yarn contracts:generate-docs` — `hardhat docgen` into `packages/contracts/docs`.
- `yarn lint` / `yarn format` — Turbo-wired lint / Prettier across the repo.

### Thor solo (local node)

`make solo-up` / `make solo-down` / `make solo-clean` — docker-compose stack defined in `packages/contracts/docker-compose.yaml`. Required for `test:thor-solo` and local deploys against `vechain_solo`.

### Running a single Hardhat test

From `packages/contracts`: `npx hardhat test --grep "<pattern>" test/SimpleAccount.spec.ts`. Mocha timeout is set to 30 minutes in `hardhat.config.ts`, so long-running flows (e.g. deploying through the full upgrade chain) are fine.

## Architecture

### Contracts (`packages/contracts/contracts/accounts`)

Two contracts implement a lightweight account-abstraction pattern (not EIP-4337 — no UserOperation/Bundler/EntryPoint):

- **`SimpleAccount`** (UUPS upgradeable, EIP-712) — single-owner smart wallet. Supports:
  - Direct owner calls: `execute`, `executeBatch`.
  - Off-chain-signed execution: `executeWithAuthorization` (single, no nonce — has a known replay vector on the same account) and `executeBatchWithAuthorization` (batch, with `bytes32 nonce` stored in `usedNonces` for replay protection).
  - **`executeBatchWithCustomAuthorization`** — same as the batch variant but uses a custom EIP-712 domain separator where the chainId is masked to 16 bits (`block.chainid & 0xFFFF`). Workaround for iOS/Swift and Android tooling that can't handle VeChain's full chainId. `customEip712Domain()` and `maskedChainId()` are exposed so clients can build the matching typed data.
  - `transferOwnership` (V3+).
  - `version()` returns `uint256` (3 currently). V1 didn't have `version()` — callers must `try`/`catch` and treat a revert as V1 (see `SimpleAccountFactory.getAccountVersion`).

- **`SimpleAccountFactory`** (UUPS + AccessControl) — deterministic deployer using CREATE2 + `ERC1967Proxy`. Two creation paths:
  - `createAccount(owner)` / `getAccountAddress(owner)` — salt is `uint256(uint160(owner))`, so one canonical account per owner.
  - `createAccountWithSalt(owner, salt)` / `getAccountAddressWithSalt(owner, salt)` — multiple accounts per owner.

### Critical: legacy-account address resolution

Because the V3 upgrade changed `accountImplementation` (originally `accountImplementationV1`, then **renamed**; V3 adds `accountImplementationV3`), the CREATE2 address derived from the same `(owner, salt)` differs between V1 and V3 implementations. To stay backwards-compatible, the factory probes both and picks via `_mustUseV1Implementation(addressGeneratedWithV1)`:

1. If the V1-derived address already has bytecode → use V1.
2. Else if that V1-derived address holds any **B3TR** or **VET** balance → treat as legacy → use V1.
3. Otherwise → use V3.

This means **never compute account addresses off-chain by mimicking the CREATE2 yourself** — always call `getAccountAddress` / `getAccountAddressWithSalt`, or you'll resolve to the wrong address for legacy users. The `b3tr` address is set during `initializeV3`.

`createAccountWithVersion(owner, version)` exists for tests/migration and is `DEFAULT_ADMIN_ROLE`-gated.

### Versioning history

- **SimpleAccount**: V1 → (V2 skipped — misconfigured upgrade) → V3.
- **SimpleAccountFactory**: V1 → V2 (added salts + `version()`, but **never reinitialized the implementation pointer**, so on-chain V2 was still deploying V1 accounts — documented in the contract NatSpec) → V3 (reinitialized via `initializeV3`, introduced the V1/V3 implementation pair and the legacy-detection logic above).

Deprecated previous versions live in `packages/contracts/contracts/deprecated/{accounts,core,interfaces,utils}` — kept so the deploy script can replay the full upgrade chain.

### Deploy / upgrade flow

`scripts/deploy/deploy.ts` deploys a fresh V3 `SimpleAccount` implementation, then calls `deployAndUpgrade(["SimpleAccountFactoryV1", "SimpleAccountFactoryV2", "SimpleAccountFactory"], …, { versions: [undefined, 2, 3] })` so every fresh deployment walks the historical upgrade chain (V1 init → V2 reinit → V3 reinit with the new implementation + B3TR address). This mirrors what mainnet/testnet contracts have gone through and is needed for storage-layout compatibility.

`check-contracts-deployment:<env>` (run by the dev/build turbo pipelines) only auto-deploys on `vechain_solo` and `vechain_testnet`. On mainnet it just verifies the configured address has code.

### Frontend

Vite app reading from `getConfig(VITE_APP_ENV)` for the factory address + node URL. Hooks under `apps/frontend/src/hooks` (e.g. `useGetAccountAddress`, `useAccountCreatedEvents`, `useSmartAccountVersion`) wrap the factory ABI exported from `@repo/contracts`. Built for GitHub Pages — see the `gh-pages-build` script and `homepage` in `apps/frontend/package.json`.

### Configuration

The single source of truth for per-env addresses is `packages/config/{testnet,mainnet}.ts` plus `packages/config/contracts/envs/<env>.ts`. `check-or-generate-local-config` runs first in nearly every Turbo task — if you add a new package, depend on `@repo/config#check-or-generate-local-config` in `turbo.json`, otherwise downstream tasks may run before the local config exists.

`VITE_APP_ENV` (`testnet` | `mainnet`) controls everything; `MNEMONIC` from `.env` is used by every Hardhat network (`vechain_solo`, `vechain_testnet`, `vechain_mainnet`) under the VeChain derivation path `m/44'/818'/0'/0`.

## Skills

This repo expects the [vechain-ai-skills](https://github.com/vechain/vechain-ai-skills) bundle to be installed (they live under `~/.claude/skills/` and load automatically). For work in this codebase, the directly relevant ones are:

- **`smart-contract-development`** — Hardhat + Solidity on VeChainThor: UUPS upgrade patterns, OpenZeppelin v5, Thor solo testing, storage-layout safety. Use for anything in `packages/contracts/`.
- **`vechain-core`** — Core SDK usage, fee delegation (VIP-191), multi-clause transactions, signing flows. Use when wiring delegators or composing clauses around the factory ABI.
- **`vechain-kit`** — VeChain Kit hooks/components (e.g. `useUpgradeRequired`, `useUpgradeSmartAccountModal`, `useSendTransaction`). The kit is the primary downstream consumer of `SimpleAccountFactory`; use this skill when debugging integration questions, the V1→V3 upgrade UX, or social-login flows.
- **`frontend`** — Generic VeChain dApp frontend patterns (Chakra, TanStack Query, Vite). Use for changes under `apps/frontend/`.

Less directly relevant but adjacent: `thor` (node internals — relevant if debugging RPC/CREATE2 behavior), `stargate` and `vebetterdao` (B3TR ecosystem context — useful because `_mustUseV1Implementation` checks B3TR balance for legacy detection).
