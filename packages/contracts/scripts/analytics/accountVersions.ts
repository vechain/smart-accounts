import { ethers, artifacts, network } from "hardhat";
import { Interface } from "ethers";
import axios, { AxiosError } from "axios";
import { Agent as HttpAgent } from "http";
import { Agent as HttpsAgent } from "https";
import fs from "fs";
import path from "path";
import { getConfig } from "@repo/config";
import { EnvConfig } from "@repo/config/contracts";
import { SimpleAccountFactory__factory } from "../..";

// On-chain analytics for the SimpleAccountFactory.
//
// Classifies every account ever emitted via the AccountCreated event into:
//   - Still V1: proxy still points at the V1 implementation
//   - Upgraded V1 → V3: proxy was originally deployed with V1 impl, now reports version() == 3
//   - Native V3: proxy was originally deployed with V3 impl
//
// Original implementation is determined by comparing the CREATE2 address against the
// V1- and V3-derived addresses (different implementations yield different proxy init code
// and therefore different addresses). Current implementation is read by calling version()
// on the proxy — V1 accounts revert (no version() method), V3 returns 3.

const env = process.env.VITE_APP_ENV as EnvConfig | undefined;
if (!env) throw new Error("VITE_APP_ENV env variable must be set");

const config = getConfig();
const factoryAddress = config.simpleAccountFactoryContractAddress;
// Default to the vechain.energy node for analytics — higher throughput than
// the public mainnet.vechain.org RPC under heavy event/balance scanning.
// Override with THOR_NODE_URL if needed.
const nodeUrl =
  process.env.THOR_NODE_URL ??
  (config.environment === "mainnet"
    ? "https://node-mainnet.vechain.energy"
    : config.nodeUrl);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ACCOUNT_CREATED_TOPIC = ethers.id(
  "AccountCreated(address,address,uint256)"
);
const VERSION_SELECTOR = ethers.id("version()").slice(0, 10);

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

const LOG_BLOCK_CHUNK = 100_000;
const LOG_PAGE_SIZE = 1000;

// Thor's /accounts/* multi-clause simulation truncates the response when a clause reverts,
// which silently miscounts the V1 vs V3 split. Issue version() as one clause per request.
// Concurrency tuned conservatively — vechain.energy starts returning 500s once we sustain
// more than ~20 concurrent simulations from a single client.
const SINGLE_CALL_CONCURRENCY = 16;
const HTTP_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 6;

const CACHE_DIR = path.resolve(__dirname, ".cache");
const EVENTS_CACHE_PATH = path.join(
  CACHE_DIR,
  `events-${network.name}-${factoryAddress.toLowerCase()}.json`
);
const VERSIONS_CACHE_PATH = path.join(
  CACHE_DIR,
  `versions-${network.name}-${factoryAddress.toLowerCase()}.json`
);
const FORCE_REFRESH = process.env.REFRESH_EVENTS === "1";

// Keep-alive + a generous socket pool so we re-use TCP / TLS connections
// across the thousands of single-clause version() calls instead of paying
// handshake overhead per request.
const httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 64 });
const httpsAgent = new HttpsAgent({ keepAlive: true, maxSockets: 64 });
const http = axios.create({
  timeout: HTTP_TIMEOUT_MS,
  httpAgent,
  httpsAgent,
});

type EventEntry = {
  account: string;
  owner: string;
  salt: string; // string-encoded bigint so it survives JSON round-trips
  blockNumber: number;
};

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isAxios = err instanceof AxiosError;
      const status = isAxios ? err.response?.status : undefined;
      // 4xx (other than 429) means the request itself is bad — don't retry.
      if (isAxios && status && status >= 400 && status < 500 && status !== 429) {
        throw err;
      }
      const delay =
        Math.min(15_000, 500 * Math.pow(2, attempt)) +
        Math.floor(Math.random() * 500);
      process.stdout.write(
        `\n[retry] ${label}: ${isAxios ? `${err.code ?? "AxiosError"} ${status ?? ""}` : (err as Error).message} — sleeping ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})\n`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function getLatestBlockNumber(): Promise<number> {
  const res = await withRetry("blocks/best", () =>
    http.get<{ number: number }>(`${nodeUrl}/blocks/best`)
  );
  return res.data.number;
}

async function fetchAccountCreatedEvents(
  fromBlock: number,
  toBlock: number
): Promise<EventEntry[]> {
  const out: EventEntry[] = [];
  let offset = 0;

  while (true) {
    const res = await withRetry(`logs/event ${fromBlock}-${toBlock}@${offset}`, () =>
      http.post<
        Array<{
          data: string;
          meta: { blockNumber: number };
        }>
      >(`${nodeUrl}/logs/event`, {
        range: { unit: "block", from: fromBlock, to: toBlock },
        options: { offset, limit: LOG_PAGE_SIZE },
        criteriaSet: [{ address: factoryAddress, topic0: ACCOUNT_CREATED_TOPIC }],
        order: "asc",
      })
    );

    const logs = res.data ?? [];
    if (logs.length === 0) break;

    for (const log of logs) {
      const decoded = abiCoder.decode(
        ["address", "address", "uint256"],
        log.data
      );
      out.push({
        account: ethers.getAddress(decoded[0] as string),
        owner: ethers.getAddress(decoded[1] as string),
        salt: (decoded[2] as bigint).toString(),
        blockNumber: log.meta.blockNumber,
      });
    }

    if (logs.length < LOG_PAGE_SIZE) break;
    offset += LOG_PAGE_SIZE;
  }

  return out;
}

async function fetchAllEvents(
  latestBlock: number,
  fromBlock = 0
): Promise<EventEntry[]> {
  const all: EventEntry[] = [];
  for (let from = fromBlock; from <= latestBlock; from += LOG_BLOCK_CHUNK) {
    const to = Math.min(from + LOG_BLOCK_CHUNK - 1, latestBlock);
    const chunk = await fetchAccountCreatedEvents(from, to);
    for (const ev of chunk) all.push(ev);
    process.stdout.write(
      `\rFetched ${all.length} AccountCreated events (blocks ${fromBlock}..${to}/${latestBlock})...`
    );
  }
  process.stdout.write("\n");
  return all;
}

function loadEventsCache(): EventEntry[] | null {
  if (FORCE_REFRESH) return null;
  if (!fs.existsSync(EVENTS_CACHE_PATH)) return null;
  try {
    const raw = fs.readFileSync(EVENTS_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as EventEntry[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveEventsCache(events: EventEntry[]) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(EVENTS_CACHE_PATH, JSON.stringify(events));
}

function buildInitCodeHash(
  proxyBytecode: string,
  simpleAccountIface: Interface,
  impl: string,
  owner: string
): string {
  const initData = simpleAccountIface.encodeFunctionData("initialize", [owner]);
  const initCode = ethers.concat([
    proxyBytecode,
    abiCoder.encode(["address", "bytes"], [impl, initData]),
  ]);
  return ethers.keccak256(initCode);
}

function computeCreate2Address(salt: bigint, initCodeHash: string): string {
  const saltBytes32 = ethers.zeroPadValue(ethers.toBeHex(salt), 32);
  return ethers.getCreate2Address(factoryAddress, saltBytes32, initCodeHash);
}

async function batchCallVersion(addresses: string[]): Promise<(number | null)[]> {
  const results: (number | null)[] = new Array(addresses.length);
  let nextIdx = 0;
  let processed = 0;

  const worker = async () => {
    while (true) {
      const idx = nextIdx++;
      if (idx >= addresses.length) break;
      const addr = addresses[idx];

      const res = await withRetry(`version(${addr})`, () =>
        http.post<Array<{ data: string; reverted: boolean }>>(
          `${nodeUrl}/accounts/*?revision=best`,
          {
            clauses: [{ to: addr, value: "0x0", data: VERSION_SELECTOR }],
            gas: 100_000,
          }
        )
      );

      const item = res.data?.[0];
      if (!item || item.reverted) {
        results[idx] = null;
      } else {
        const hex = item.data && item.data !== "0x" ? item.data : "0x0";
        try {
          results[idx] = Number(BigInt(hex));
        } catch {
          results[idx] = null;
        }
      }

      processed++;
      if (processed % 500 === 0 || processed === addresses.length) {
        process.stdout.write(
          `\rQueried version() of ${processed}/${addresses.length} accounts...`
        );
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(SINGLE_CALL_CONCURRENCY, addresses.length) },
      worker
    )
  );
  process.stdout.write("\n");
  return results;
}

async function main() {
  console.log(`\nAnalyzing SimpleAccountFactory on ${network.name}`);
  console.log(`Factory:  ${factoryAddress}`);
  console.log(`Node URL: ${nodeUrl}\n`);

  const factory = SimpleAccountFactory__factory.connect(
    factoryAddress,
    ethers.provider
  );
  const [v1Impl, v3Impl, latestBlock] = await Promise.all([
    factory.accountImplementationV1(),
    factory.accountImplementationV3(),
    getLatestBlockNumber(),
  ]);
  console.log(`accountImplementationV1: ${v1Impl}`);
  console.log(`accountImplementationV3: ${v3Impl}`);
  console.log(`Latest block:            ${latestBlock}\n`);

  let events = loadEventsCache();
  if (events) {
    const cachedMax = events.reduce(
      (m, e) => (e.blockNumber > m ? e.blockNumber : m),
      0
    );
    console.log(
      `Loaded ${events.length} AccountCreated events from cache (max block ${cachedMax}).`
    );
    if (cachedMax < latestBlock) {
      console.log(
        `Fetching incremental events from block ${cachedMax + 1} to ${latestBlock}...`
      );
      const fresh = await fetchAllEvents(latestBlock, cachedMax + 1);
      if (fresh.length > 0) {
        for (const ev of fresh) events.push(ev);
        saveEventsCache(events);
        console.log(
          `Appended ${fresh.length} new events (total ${events.length}).\n`
        );
      } else {
        console.log("No new events.\n");
      }
    } else {
      console.log(`Cache up to date with latest block.\n`);
    }
  } else {
    console.log("Fetching AccountCreated events...");
    events = await fetchAllEvents(latestBlock);
    saveEventsCache(events);
    console.log(
      `Total AccountCreated events: ${events.length} (cached at ${EVENTS_CACHE_PATH})\n`
    );
  }

  const proxyArt = await artifacts.readArtifact("ERC1967Proxy");
  const simpleAccountArt = await artifacts.readArtifact("SimpleAccount");
  const simpleAccountIface = new Interface(simpleAccountArt.abi);

  type Classified = {
    address: string;
    originalImpl: "V1" | "V3";
    owner: string;
    salt: bigint;
    blockNumber: number;
  };

  console.log("Classifying accounts by original implementation...");
  const classified: Classified[] = [];
  let mismatches = 0;

  for (const ev of events) {
    const salt = BigInt(ev.salt);
    const v1Hash = buildInitCodeHash(
      proxyArt.bytecode,
      simpleAccountIface,
      v1Impl,
      ev.owner
    );
    const v3Hash = buildInitCodeHash(
      proxyArt.bytecode,
      simpleAccountIface,
      v3Impl,
      ev.owner
    );
    const v1Addr = computeCreate2Address(salt, v1Hash);
    const v3Addr = computeCreate2Address(salt, v3Hash);

    let address: string;
    let originalImpl: "V1" | "V3";

    if (ev.account === ZERO_ADDRESS) {
      // V1 factory emitted AccountCreated before assigning `ret`, so account == 0x0.
      // V1 factory only ever used the V1 implementation.
      originalImpl = "V1";
      address = v1Addr;
    } else if (ev.account === v1Addr) {
      originalImpl = "V1";
      address = v1Addr;
    } else if (ev.account === v3Addr) {
      originalImpl = "V3";
      address = v3Addr;
    } else {
      mismatches++;
      continue;
    }

    classified.push({
      address,
      originalImpl,
      owner: ev.owner,
      salt,
      blockNumber: ev.blockNumber,
    });
  }

  if (mismatches > 0) {
    console.warn(
      `Warning: ${mismatches} events had an account address that matched neither the V1- nor V3-derived CREATE2 address.`
    );
  }

  // Dedupe — a (owner, salt) can in theory emit twice if the factory was called for an already-deployed account.
  const byAddress = new Map<string, Classified>();
  for (const c of classified) {
    const existing = byAddress.get(c.address);
    if (!existing || c.blockNumber < existing.blockNumber) {
      byAddress.set(c.address, c);
    }
  }
  const unique = [...byAddress.values()];
  console.log(`Unique account addresses:    ${unique.length}\n`);

  // Reuse any previously-resolved version() result so re-runs only hit the
  // RPC for addresses we've never seen before. version() == 3 is permanent;
  // version() == null means the proxy still points at V1 — when an owner
  // upgrades V1 → V3 we'll re-resolve them via the periodic refresh below.
  const versionsMap: Record<string, number | null> = (() => {
    if (!fs.existsSync(VERSIONS_CACHE_PATH)) return {};
    try {
      return JSON.parse(fs.readFileSync(VERSIONS_CACHE_PATH, "utf8"));
    } catch {
      return {};
    }
  })();

  const addressesToQuery: string[] = [];
  // Always re-check addresses that previously reverted (could have upgraded
  // since), plus any never-seen address.
  for (const c of unique) {
    const v = versionsMap[c.address];
    if (v === undefined || v === null) addressesToQuery.push(c.address);
  }

  console.log(
    `Versions cache: ${Object.keys(versionsMap).length} entries · ${addressesToQuery.length} to (re)query.`
  );

  if (addressesToQuery.length > 0) {
    const versions = await batchCallVersion(addressesToQuery);
    for (let i = 0; i < addressesToQuery.length; i++) {
      versionsMap[addressesToQuery[i]] = versions[i];
    }
  }

  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(VERSIONS_CACHE_PATH, JSON.stringify(versionsMap));
  console.log(`Cached versions at ${VERSIONS_CACHE_PATH}\n`);

  let stillV1 = 0;
  let upgradedV1toV3 = 0;
  let nativeV3 = 0;
  let nativeV3StillV1 = 0; // shouldn't happen, but track defensively
  let unknownVersion = 0;

  for (const c of unique) {
    const ver = versionsMap[c.address];

    if (ver === null || ver === undefined) {
      // version() reverted → V1 (V1 accounts don't have version())
      if (c.originalImpl === "V1") stillV1++;
      else nativeV3StillV1++;
    } else if (ver === 3) {
      if (c.originalImpl === "V1") upgradedV1toV3++;
      else nativeV3++;
    } else {
      unknownVersion++;
    }
  }

  console.log("\n========== Account Version Report ==========");
  console.log(`Network:                      ${network.name}`);
  console.log(`Factory:                      ${factoryAddress}`);
  console.log(`Total unique accounts:        ${unique.length}`);
  console.log(`Currently V3 (total):         ${upgradedV1toV3 + nativeV3}`);
  console.log(`  - Native V3:                ${nativeV3}`);
  console.log(`  - Upgraded V1 → V3:         ${upgradedV1toV3}`);
  console.log(`Still V1:                     ${stillV1}`);
  if (nativeV3StillV1 > 0) {
    console.log(`Native V3 but version reverted: ${nativeV3StillV1}`);
  }
  if (unknownVersion > 0) {
    console.log(`Unknown version() return:     ${unknownVersion}`);
  }
  console.log("============================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
