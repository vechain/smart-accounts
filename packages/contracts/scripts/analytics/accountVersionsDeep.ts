import { ethers, artifacts, network } from "hardhat";
import { Interface } from "ethers";
import axios, { AxiosError } from "axios";
import fs from "fs";
import path from "path";
import { getConfig } from "@repo/config";
import { EnvConfig } from "@repo/config/contracts";
import { SimpleAccountFactory__factory } from "../..";

// Deep dive on top of the base `accountVersions.ts` report.
//
//  - Re-uses the cached AccountCreated event list (refetches if missing or REFRESH_EVENTS=1).
//  - Caches version() results so re-running is fast.
//  - For the "Native V3 but version() reverted" bucket: checks hasCode on each address to
//    distinguish "phantom" deployments from "deployed but custom implementation".
//  - For the "Still V1" bucket: queries B3TR, VOT3, VTHO, and VET balances per account and
//    summarises distribution + totals.

const env = process.env.VITE_APP_ENV as EnvConfig | undefined;
if (!env) throw new Error("VITE_APP_ENV env variable must be set");

const config = getConfig();
const factoryAddress = config.simpleAccountFactoryContractAddress;
const nodeUrl = config.nodeUrl;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ACCOUNT_CREATED_TOPIC = ethers.id(
  "AccountCreated(address,address,uint256)"
);
const VERSION_SELECTOR = ethers.id("version()").slice(0, 10);
const BALANCE_OF_SELECTOR = ethers.id("balanceOf(address)").slice(0, 10);

// VeChain mainnet token addresses. Override via env vars if needed.
const VTHO_ADDRESS = (
  process.env.VTHO_ADDRESS ?? "0x0000000000000000000000000000456E65726779"
).toLowerCase();
const VOT3_ADDRESS_DEFAULTS: Record<string, string> = {
  vechain_mainnet: "0x76Ca782B59C74d088C7D2Cce2f211BC00836c602",
};
const VOT3_ADDRESS = (
  process.env.VOT3_ADDRESS ?? VOT3_ADDRESS_DEFAULTS[network.name] ?? ""
).toLowerCase();

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

const LOG_BLOCK_CHUNK = 100_000;
const LOG_PAGE_SIZE = 1000;
const CALL_BATCH_SIZE = 50;
const CALL_CONCURRENCY = 4;
// Thor's /accounts/* multi-clause simulation truncates the response when a clause reverts,
// so we issue one clause per HTTP request for any call that may revert (e.g. version() on
// V1 accounts). For calls that never revert (e.g. ERC20.balanceOf on a valid token), we
// keep the batched path.
const SINGLE_CALL_CONCURRENCY = 50;
const GET_CONCURRENCY = 20;
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
const BALANCES_CACHE_PATH = path.join(
  CACHE_DIR,
  `balances-${network.name}-${factoryAddress.toLowerCase()}.json`
);
const FORCE_REFRESH_EVENTS = process.env.REFRESH_EVENTS === "1";
const FORCE_REFRESH_VERSIONS = process.env.REFRESH_VERSIONS === "1";
const FORCE_REFRESH_BALANCES = process.env.REFRESH_BALANCES === "1";

const http = axios.create({ timeout: HTTP_TIMEOUT_MS });

type EventEntry = {
  account: string;
  owner: string;
  salt: string;
  blockNumber: number;
};

type Classified = {
  address: string;
  originalImpl: "V1" | "V3";
  owner: string;
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
      http.post<Array<{ data: string; meta: { blockNumber: number } }>>(
        `${nodeUrl}/logs/event`,
        {
          range: { unit: "block", from: fromBlock, to: toBlock },
          options: { offset, limit: LOG_PAGE_SIZE },
          criteriaSet: [{ address: factoryAddress, topic0: ACCOUNT_CREATED_TOPIC }],
          order: "asc",
        }
      )
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
  if (FORCE_REFRESH_EVENTS) return null;
  if (!fs.existsSync(EVENTS_CACHE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(EVENTS_CACHE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function saveEventsCache(events: EventEntry[]) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(EVENTS_CACHE_PATH, JSON.stringify(events));
}

function loadVersionsCache(): Record<string, number | null> | null {
  if (FORCE_REFRESH_VERSIONS) return null;
  if (!fs.existsSync(VERSIONS_CACHE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(VERSIONS_CACHE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function saveVersionsCache(map: Record<string, number | null>) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(VERSIONS_CACHE_PATH, JSON.stringify(map));
}

type BalanceEntry = {
  vet: string;
  vtho: string;
  b3tr: string;
  vot3: string;
};

function loadBalancesCache(): Record<string, BalanceEntry> | null {
  if (FORCE_REFRESH_BALANCES) return null;
  if (!fs.existsSync(BALANCES_CACHE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(BALANCES_CACHE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function saveBalancesCache(map: Record<string, BalanceEntry>) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(BALANCES_CACHE_PATH, JSON.stringify(map));
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

type ClauseResult = { data: string; reverted: boolean };

async function batchSimulateClauses(
  clauses: { to: string; data: string }[],
  label: string
): Promise<ClauseResult[]> {
  const results: ClauseResult[] = new Array(clauses.length);
  const chunks: { start: number; items: typeof clauses }[] = [];
  for (let i = 0; i < clauses.length; i += CALL_BATCH_SIZE) {
    chunks.push({
      start: i,
      items: clauses.slice(i, i + CALL_BATCH_SIZE),
    });
  }

  let nextChunk = 0;
  let processed = 0;

  const worker = async () => {
    while (true) {
      const idx = nextChunk++;
      if (idx >= chunks.length) break;
      const { start, items } = chunks[idx];

      const res = await withRetry(`${label} batch@${start}`, () =>
        http.post<ClauseResult[]>(`${nodeUrl}/accounts/*?revision=best`, {
          clauses: items.map((c) => ({
            to: c.to,
            value: "0x0",
            data: c.data,
          })),
        })
      );

      const data = res.data ?? [];
      for (let j = 0; j < items.length; j++) {
        results[start + j] = data[j] ?? { data: "0x", reverted: true };
      }
      processed += items.length;
      process.stdout.write(
        `\r${label}: ${processed}/${clauses.length} clauses simulated...`
      );
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CALL_CONCURRENCY, chunks.length) }, worker)
  );
  process.stdout.write("\n");
  return results;
}

async function callSingleClause(
  to: string,
  data: string,
  label: string
): Promise<ClauseResult> {
  const res = await withRetry(label, () =>
    http.post<ClauseResult[]>(`${nodeUrl}/accounts/*?revision=best`, {
      clauses: [{ to, value: "0x0", data }],
      gas: 100_000,
    })
  );
  return res.data?.[0] ?? { data: "0x", reverted: true };
}

async function callVersionsOneByOne(
  addresses: string[]
): Promise<(number | null)[]> {
  const results: (number | null)[] = new Array(addresses.length);
  let nextIdx = 0;
  let processed = 0;

  const worker = async () => {
    while (true) {
      const idx = nextIdx++;
      if (idx >= addresses.length) break;
      const addr = addresses[idx];
      const r = await callSingleClause(addr, VERSION_SELECTOR, `version(${addr})`);
      if (!r || r.reverted) {
        results[idx] = null;
      } else {
        try {
          results[idx] = Number(parseUint(r.data));
        } catch {
          results[idx] = null;
        }
      }
      processed++;
      if (processed % 500 === 0 || processed === addresses.length) {
        process.stdout.write(
          `\rversion(): ${processed}/${addresses.length} accounts...`
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

type AccountInfo = { balance: string; energy: string; hasCode: boolean };

async function fetchAccountInfos(
  addresses: string[],
  label: string
): Promise<AccountInfo[]> {
  const results: AccountInfo[] = new Array(addresses.length);
  let nextIdx = 0;
  let processed = 0;

  const worker = async () => {
    while (true) {
      const idx = nextIdx++;
      if (idx >= addresses.length) break;
      const addr = addresses[idx];
      const res = await withRetry(`accounts/${addr}`, () =>
        http.get<AccountInfo>(`${nodeUrl}/accounts/${addr}?revision=best`)
      );
      results[idx] = res.data;
      processed++;
      if (processed % 200 === 0 || processed === addresses.length) {
        process.stdout.write(
          `\r${label}: ${processed}/${addresses.length} accounts queried...`
        );
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(GET_CONCURRENCY, addresses.length) }, worker)
  );
  process.stdout.write("\n");
  return results;
}

function parseUint(hex: string | undefined | null): bigint {
  if (!hex || hex === "0x") return 0n;
  try {
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

function formatWei(amount: bigint, decimals = 18): string {
  const negative = amount < 0n;
  const value = negative ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = value % base;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}${fracStr ? "." + fracStr : ""}`;
}

async function main() {
  console.log(`\nDeep analysis on ${network.name}`);
  console.log(`Factory: ${factoryAddress}`);
  console.log(`Node:    ${nodeUrl}\n`);

  const factory = SimpleAccountFactory__factory.connect(
    factoryAddress,
    ethers.provider
  );
  const [v1Impl, v3Impl, b3trAddress] = await Promise.all([
    factory.accountImplementationV1(),
    factory.accountImplementationV3(),
    factory.b3tr(),
  ]);

  const b3trAddr = b3trAddress.toLowerCase();
  const vthoAddr = VTHO_ADDRESS;
  const vot3Addr = VOT3_ADDRESS;

  console.log(`accountImplementationV1: ${v1Impl}`);
  console.log(`accountImplementationV3: ${v3Impl}`);
  console.log(`B3TR (from factory):     ${b3trAddr}`);
  console.log(`VOT3:                    ${vot3Addr || "(not set; set VOT3_ADDRESS)"}`);
  console.log(`VTHO:                    ${vthoAddr}\n`);

  let events = loadEventsCache();
  if (events) {
    const cachedMax = events.reduce(
      (m, e) => (e.blockNumber > m ? e.blockNumber : m),
      0
    );
    console.log(
      `Loaded ${events.length} events from cache (max block ${cachedMax}).`
    );
    const latestBlock = await getLatestBlockNumber();
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
      console.log("Cache up to date with latest block.\n");
    }
  } else {
    console.log("Fetching AccountCreated events (first run)...");
    const latestBlock = await getLatestBlockNumber();
    events = await fetchAllEvents(latestBlock);
    saveEventsCache(events);
    console.log(`Cached ${events.length} events.\n`);
  }

  const proxyArt = await artifacts.readArtifact("ERC1967Proxy");
  const simpleAccountArt = await artifacts.readArtifact("SimpleAccount");
  const simpleAccountIface = new Interface(simpleAccountArt.abi);

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

    if (ev.account === ZERO_ADDRESS || ev.account === v1Addr) {
      classified.push({ address: v1Addr, originalImpl: "V1", owner: ev.owner });
    } else if (ev.account === v3Addr) {
      classified.push({ address: v3Addr, originalImpl: "V3", owner: ev.owner });
    } else {
      mismatches++;
    }
  }
  if (mismatches > 0) console.warn(`(skipped ${mismatches} mismatched events)`);

  const byAddress = new Map<string, Classified>();
  for (const c of classified) {
    if (!byAddress.has(c.address)) byAddress.set(c.address, c);
  }
  const unique = [...byAddress.values()];
  console.log(`Unique accounts: ${unique.length}\n`);

  // Determine current versions (cached).
  let versionMap = loadVersionsCache();
  const needVersionLookup = unique.filter((c) => !versionMap || !(c.address in versionMap));

  if (needVersionLookup.length > 0) {
    console.log(
      `Querying version() for ${needVersionLookup.length} accounts (single-clause, rest from cache)...`
    );
    const versionResults = await callVersionsOneByOne(
      needVersionLookup.map((c) => c.address)
    );
    versionMap = versionMap ?? {};
    for (let i = 0; i < needVersionLookup.length; i++) {
      versionMap[needVersionLookup[i].address] = versionResults[i];
    }
    saveVersionsCache(versionMap);
  } else {
    console.log("Loaded version() results from cache.");
  }

  // Bucketize.
  const stillV1: Classified[] = [];
  const upgradedV1toV3: Classified[] = [];
  const nativeV3: Classified[] = [];
  const nativeV3Reverted: Classified[] = [];
  const v1Originated_VersionedHigh: Classified[] = [];
  for (const c of unique) {
    const v = versionMap![c.address];
    if (v === 3) {
      if (c.originalImpl === "V1") upgradedV1toV3.push(c);
      else nativeV3.push(c);
    } else if (v === null) {
      if (c.originalImpl === "V1") stillV1.push(c);
      else nativeV3Reverted.push(c);
    } else {
      v1Originated_VersionedHigh.push(c);
    }
  }

  console.log(`\nSnapshot:`);
  console.log(`  Total:                 ${unique.length}`);
  console.log(`  Native V3:             ${nativeV3.length}`);
  console.log(`  Upgraded V1 → V3:      ${upgradedV1toV3.length}`);
  console.log(`  Still V1:              ${stillV1.length}`);
  console.log(`  Native V3 reverted:    ${nativeV3Reverted.length}`);
  if (v1Originated_VersionedHigh.length > 0) {
    console.log(`  Other versions:        ${v1Originated_VersionedHigh.length}`);
  }

  // === Native V3 but reverted: check hasCode ===
  if (nativeV3Reverted.length > 0) {
    console.log(
      `\n--- Native V3 but version() reverted (${nativeV3Reverted.length}) ---`
    );
    const infos = await fetchAccountInfos(
      nativeV3Reverted.map((c) => c.address),
      "hasCode lookup"
    );
    let noCode = 0;
    let hasCode = 0;
    for (const info of infos) {
      if (info.hasCode) hasCode++;
      else noCode++;
    }
    console.log(`  No code at address (phantom):  ${noCode}`);
    console.log(`  Has code but version reverts:  ${hasCode}`);
    if (hasCode > 0) {
      const sample = nativeV3Reverted
        .filter((_, i) => infos[i].hasCode)
        .slice(0, 5)
        .map((c) => c.address);
      console.log(`  Sample addresses with code: ${sample.join(", ")}`);
    }
    if (noCode > 0) {
      const sample = nativeV3Reverted
        .filter((_, i) => !infos[i].hasCode)
        .slice(0, 5)
        .map((c) => c.address);
      console.log(`  Sample phantom addresses:   ${sample.join(", ")}`);
    }
  }

  // === Fleet-wide balances ===
  console.log(`\n--- Fleet balances (${unique.length} accounts) ---`);

  const tokenList: { addr: string; label: keyof BalanceEntry }[] = [
    { addr: b3trAddr, label: "b3tr" },
    { addr: vot3Addr, label: "vot3" },
    { addr: vthoAddr, label: "vtho" },
  ];
  const enabledTokens = tokenList.filter((t) => t.addr);

  let balancesMap = loadBalancesCache() ?? {};
  const needBalances = unique.filter((c) => !(c.address in balancesMap));

  if (needBalances.length > 0) {
    console.log(
      `Querying ERC20 balances for ${needBalances.length} accounts (${
        unique.length - needBalances.length
      } from cache)...`
    );
    const balanceClauses: { to: string; data: string }[] = [];
    for (const c of needBalances) {
      for (const t of enabledTokens) {
        balanceClauses.push({
          to: t.addr,
          data:
            BALANCE_OF_SELECTOR +
            ethers.zeroPadValue(c.address, 32).slice(2),
        });
      }
    }
    const balanceResults = await batchSimulateClauses(
      balanceClauses,
      "balanceOf"
    );

    console.log(`Fetching VET balances for ${needBalances.length} accounts...`);
    const infos = await fetchAccountInfos(
      needBalances.map((c) => c.address),
      "VET balance"
    );

    for (let i = 0; i < needBalances.length; i++) {
      const entry: BalanceEntry = { vet: "0", vtho: "0", b3tr: "0", vot3: "0" };
      for (let k = 0; k < enabledTokens.length; k++) {
        const t = enabledTokens[k];
        const r = balanceResults[i * enabledTokens.length + k];
        entry[t.label] = (!r || r.reverted ? 0n : parseUint(r.data)).toString();
      }
      entry.vet = parseUint(infos[i]?.balance).toString();
      balancesMap[needBalances[i].address] = entry;

      // Periodic flush so a long run that crashes still saves progress.
      if ((i + 1) % 10_000 === 0) saveBalancesCache(balancesMap);
    }
    saveBalancesCache(balancesMap);
  } else {
    console.log("All balances served from cache.");
  }

  // Aggregate fleet-wide totals + per-version split.
  const tokenLabels = ["VET", "B3TR", "VOT3", "VTHO"] as const;
  type TokenLabel = (typeof tokenLabels)[number];
  type VersionKey = "nativeV3" | "upgradedV1ToV3" | "stillV1";
  const empty = () =>
    Object.fromEntries(tokenLabels.map((k) => [k, 0n])) as Record<TokenLabel, bigint>;
  const totals: Record<VersionKey | "fleet", Record<TokenLabel, bigint>> = {
    nativeV3: empty(),
    upgradedV1ToV3: empty(),
    stillV1: empty(),
    fleet: empty(),
  };
  const holders: Record<VersionKey | "fleet", Record<TokenLabel | "any", number>> = {
    nativeV3: { VET: 0, B3TR: 0, VOT3: 0, VTHO: 0, any: 0 },
    upgradedV1ToV3: { VET: 0, B3TR: 0, VOT3: 0, VTHO: 0, any: 0 },
    stillV1: { VET: 0, B3TR: 0, VOT3: 0, VTHO: 0, any: 0 },
    fleet: { VET: 0, B3TR: 0, VOT3: 0, VTHO: 0, any: 0 },
  };

  const classify = (c: Classified): VersionKey => {
    const v = versionMap![c.address];
    if (v === 3) return c.originalImpl === "V1" ? "upgradedV1ToV3" : "nativeV3";
    return "stillV1";
  };

  for (const c of unique) {
    const b = balancesMap[c.address];
    if (!b) continue;
    const vals: Record<TokenLabel, bigint> = {
      VET: BigInt(b.vet),
      B3TR: BigInt(b.b3tr),
      VOT3: BigInt(b.vot3),
      VTHO: BigInt(b.vtho),
    };
    const bucket = classify(c);
    let hasAny = false;
    for (const k of tokenLabels) {
      totals[bucket][k] += vals[k];
      totals.fleet[k] += vals[k];
      if (vals[k] > 0n) {
        holders[bucket][k]++;
        holders.fleet[k]++;
        hasAny = true;
      }
    }
    if (hasAny) {
      holders[bucket].any++;
      holders.fleet.any++;
    }
  }

  console.log(`\n  Fleet totals:`);
  for (const k of tokenLabels) {
    console.log(`    ${k.padEnd(6)} ${formatWei(totals.fleet[k])}`);
  }
  console.log(`\n  Holders (any balance > 0):`);
  console.log(`    Native V3:        ${holders.nativeV3.any}`);
  console.log(`    Upgraded V1→V3:   ${holders.upgradedV1ToV3.any}`);
  console.log(`    Still V1:         ${holders.stillV1.any}`);

  console.log("\nDone.\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
