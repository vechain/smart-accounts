import { network } from "hardhat";
import { ethers } from "ethers";
import axios, { AxiosError } from "axios";
import fs from "fs";
import path from "path";
import { getConfig } from "@repo/config";
import { EnvConfig } from "@repo/config/contracts";

// Scans X2EarnRewardsPool.RewardDistributed events filtered to Still-V1 receivers,
// aggregates by appId, and writes a cache used by exportInsights.
//
// Cache shape: { maxBlockScanned, byAppId: { [appId]: { count, totalAmount, receivers[] } } }

const env = process.env.VITE_APP_ENV as EnvConfig | undefined;
if (!env) throw new Error("VITE_APP_ENV env variable must be set");

const config = getConfig();
const factoryAddress = config.simpleAccountFactoryContractAddress;
const nodeUrl = config.nodeUrl;

// VeBetterDAO mainnet contract addresses. Override via env if needed.
const REWARDS_POOL =
  process.env.X2EARN_REWARDS_POOL ??
  "0x6Bee7DDab6c99d5B2Af0554EaEA484CE18F52631";
const X2EARN_APPS =
  process.env.X2EARN_APPS ?? "0x8392B7CCc763dB03b47afcD8E8f5e24F9cf0554D";

// event RewardDistributed(uint256 amount, bytes32 indexed appId, address indexed receiver, string proof, address indexed distributor)
const REWARD_DISTRIBUTED_TOPIC = ethers.id(
  "RewardDistributed(uint256,bytes32,address,string,address)"
);
// app(bytes32) selector
const APP_SELECTOR = ethers.id("app(bytes32)").slice(0, 10);

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

const CACHE_DIR = path.resolve(__dirname, ".cache");
const VERSIONS_CACHE_PATH = path.join(
  CACHE_DIR,
  `versions-${network.name}-${factoryAddress.toLowerCase()}.json`
);
const EVENTS_CACHE_PATH = path.join(
  CACHE_DIR,
  `events-${network.name}-${factoryAddress.toLowerCase()}.json`
);
const REWARDS_CACHE_PATH = path.join(
  CACHE_DIR,
  `rewards-${network.name}-${factoryAddress.toLowerCase()}.json`
);

const HTTP_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 6;
const CRITERIA_CHUNK = 200; // criteria per /logs/event request
const LOG_PAGE_SIZE = 1000;
const FORCE_REFRESH = process.env.REFRESH_REWARDS === "1";

const http = axios.create({ timeout: HTTP_TIMEOUT_MS });

type EventEntry = {
  account: string;
  owner: string;
  salt: string;
  blockNumber: number;
};

type RewardsCache = {
  maxBlockScanned: number;
  byAppId: Record<
    string,
    {
      name?: string; // resolved on first sighting; refreshed on top apps each run
      count: number;
      totalAmount: string; // bigint as string
      receivers: string[]; // unique receivers
    }
  >;
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
      if (isAxios && status && status >= 400 && status < 500 && status !== 429)
        throw err;
      const delay =
        Math.min(15_000, 500 * Math.pow(2, attempt)) +
        Math.floor(Math.random() * 500);
      process.stdout.write(
        `\n[retry] ${label}: ${isAxios ? `${err.code ?? "AxiosError"} ${status ?? ""}` : (err as Error).message} — sleeping ${delay}ms\n`
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

function loadJson<T>(p: string): T | null {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

function loadRewardsCache(): RewardsCache {
  if (!FORCE_REFRESH) {
    const cached = loadJson<RewardsCache>(REWARDS_CACHE_PATH);
    if (cached) return cached;
  }
  return { maxBlockScanned: 0, byAppId: {} };
}

function saveRewardsCache(cache: RewardsCache) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(REWARDS_CACHE_PATH, JSON.stringify(cache));
}

// Derive the list of Still-V1 receivers. We need their on-chain addresses, which
// come from re-deriving the CREATE2 address per event. To keep this script
// independent of the deep-script logic, we just use the addresses that appear
// as keys in the versions cache with value === null (revert → V1).
function loadV1Addresses(): string[] {
  const versions = loadJson<Record<string, number | null>>(VERSIONS_CACHE_PATH);
  if (!versions) {
    throw new Error(
      `Missing versions cache (${VERSIONS_CACHE_PATH}). Run yarn contracts:analyze-deep:${env} first.`
    );
  }
  // Sanity: also require events cache to exist so the dataset is consistent.
  if (!fs.existsSync(EVENTS_CACHE_PATH)) {
    throw new Error(
      `Missing events cache. Run yarn contracts:analyze-deep:${env} first.`
    );
  }
  const out: string[] = [];
  for (const [addr, v] of Object.entries(versions)) {
    if (v === null) out.push(addr);
  }
  return out;
}

type EventLog = {
  data: string;
  topics: string[];
  meta: { blockNumber: number };
};

async function fetchRewardEventsForChunk(
  receivers: string[],
  fromBlock: number,
  toBlock: number
): Promise<EventLog[]> {
  const criteriaSet = receivers.map((addr) => ({
    address: REWARDS_POOL,
    topic0: REWARD_DISTRIBUTED_TOPIC,
    topic2: ethers.zeroPadValue(addr.toLowerCase(), 32),
  }));

  const out: EventLog[] = [];
  let offset = 0;
  while (true) {
    const res = await withRetry(
      `logs/event rewards@${fromBlock}-${toBlock}+${offset}`,
      () =>
        http.post<EventLog[]>(`${nodeUrl}/logs/event`, {
          range: { unit: "block", from: fromBlock, to: toBlock },
          options: { offset, limit: LOG_PAGE_SIZE },
          criteriaSet,
          order: "asc",
        })
    );
    const logs = res.data ?? [];
    for (const log of logs) out.push(log);
    if (logs.length < LOG_PAGE_SIZE) break;
    offset += LOG_PAGE_SIZE;
  }
  return out;
}

function recordEvent(cache: RewardsCache, log: EventLog) {
  const appId = log.topics[1];
  const receiver = "0x" + log.topics[2].slice(-40).toLowerCase();
  // The non-indexed fields are amount (uint256), proof (string).
  // ABI-decoded: [amount, proof].
  let amount = 0n;
  try {
    const [decoded] = abiCoder.decode(["uint256", "string"], log.data);
    amount = decoded as bigint;
  } catch {
    // ignore malformed
    return;
  }
  let entry = cache.byAppId[appId];
  if (!entry) {
    entry = { count: 0, totalAmount: "0", receivers: [] };
    cache.byAppId[appId] = entry;
  }
  entry.count += 1;
  entry.totalAmount = (BigInt(entry.totalAmount) + amount).toString();
  if (!entry.receivers.includes(receiver)) entry.receivers.push(receiver);
}

async function resolveAppNames(
  appIds: string[]
): Promise<Record<string, string>> {
  if (appIds.length === 0) return {};
  // Batched /accounts/* simulation.
  const clauses = appIds.map((appId) => ({
    to: X2EARN_APPS,
    value: "0x0",
    data: APP_SELECTOR + appId.slice(2),
  }));

  const BATCH = 50;
  const results: Record<string, string> = {};
  for (let i = 0; i < clauses.length; i += BATCH) {
    const slice = clauses.slice(i, i + BATCH);
    const res = await withRetry(`accounts/* app@${i}`, () =>
      http.post<Array<{ data: string; reverted: boolean }>>(
        `${nodeUrl}/accounts/*?revision=best`,
        { clauses: slice, gas: 1_000_000 }
      )
    );
    const items = res.data ?? [];
    for (let j = 0; j < slice.length; j++) {
      const appId = appIds[i + j];
      const item = items[j];
      if (!item || item.reverted) {
        results[appId] = "(unknown app)";
        continue;
      }
      try {
        const decoded = abiCoder.decode(
          [
            "tuple(bytes32 id, address teamWalletAddress, string name, string metadataURI, uint256 createdAtTimestamp, bool available)",
          ],
          item.data
        );
        results[appId] = (decoded[0] as { name: string }).name;
      } catch {
        results[appId] = "(decode failed)";
      }
    }
    process.stdout.write(
      `\rResolved ${Math.min(i + BATCH, clauses.length)}/${clauses.length} app names...`
    );
  }
  process.stdout.write("\n");
  return results;
}

async function main() {
  console.log(`\nAnalyzing X2Earn rewards to Still-V1 accounts on ${network.name}`);
  console.log(`Rewards pool:  ${REWARDS_POOL}`);
  console.log(`X2EarnApps:    ${X2EARN_APPS}\n`);

  const v1Addresses = loadV1Addresses();
  console.log(`V1 receivers to scan: ${v1Addresses.length}`);

  const cache = loadRewardsCache();
  const fromBlock = cache.maxBlockScanned + 1;
  const latestBlock = await getLatestBlockNumber();
  if (fromBlock > latestBlock) {
    console.log("Already up to date with latest block.\n");
  } else {
    console.log(`Scanning blocks ${fromBlock} → ${latestBlock}...`);
    let newEvents = 0;
    for (let i = 0; i < v1Addresses.length; i += CRITERIA_CHUNK) {
      const chunk = v1Addresses.slice(i, i + CRITERIA_CHUNK);
      const logs = await fetchRewardEventsForChunk(chunk, fromBlock, latestBlock);
      for (const log of logs) {
        recordEvent(cache, log);
        newEvents++;
      }
      process.stdout.write(
        `\rProcessed ${Math.min(i + CRITERIA_CHUNK, v1Addresses.length)}/${v1Addresses.length} receivers (${newEvents} new events)`
      );
      // Periodic flush so a crashed run still saves partial progress.
      if (i % (CRITERIA_CHUNK * 10) === 0 && i > 0) {
        cache.maxBlockScanned = fromBlock - 1; // don't advance until full pass done
        saveRewardsCache(cache);
      }
    }
    process.stdout.write("\n");
    cache.maxBlockScanned = latestBlock;
    saveRewardsCache(cache);
    console.log(`Recorded ${newEvents} new RewardDistributed events.\n`);
  }

  // Top apps + name resolution (always re-runs; cheap).
  const ranked = Object.entries(cache.byAppId)
    .map(([appId, agg]) => ({
      appId,
      count: agg.count,
      receivers: agg.receivers.length,
      totalAmount: agg.totalAmount,
    }))
    .sort((a, b) => b.receivers - a.receivers);

  console.log(`Unique apps that rewarded V1 accounts: ${ranked.length}`);
  if (ranked.length > 0) {
    // Resolve names for top apps + any apps missing a cached name.
    const top = ranked.slice(0, 30).map((r) => r.appId);
    const needNames = Array.from(
      new Set(
        [...top, ...Object.keys(cache.byAppId)].filter(
          (id) => !cache.byAppId[id]?.name
        )
      )
    );
    if (needNames.length > 0) {
      const names = await resolveAppNames(needNames);
      for (const [id, name] of Object.entries(names)) {
        if (cache.byAppId[id]) cache.byAppId[id].name = name;
      }
      saveRewardsCache(cache);
    }

    console.log(`\nTop apps (by unique V1 receivers):`);
    for (let i = 0; i < Math.min(10, ranked.length); i++) {
      const r = ranked[i];
      const name = cache.byAppId[r.appId]?.name ?? r.appId;
      console.log(
        `  ${(i + 1).toString().padStart(2)}. ${name}  receivers=${r.receivers}  events=${r.count}`
      );
    }
  }

  console.log("\nDone.\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
