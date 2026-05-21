import { ethers, artifacts, network } from "hardhat";
import { Interface } from "ethers";
import fs from "fs";
import path from "path";
import { getConfig } from "@repo/config";
import { EnvConfig } from "@repo/config/contracts";
import { SimpleAccountFactory__factory } from "../..";

// Reads the events + versions + balances caches produced by accountVersions.ts /
// accountVersionsDeep.ts and writes a small pre-aggregated insights JSON into the
// frontend so charts can render without any on-chain calls.

const env = process.env.VITE_APP_ENV as EnvConfig | undefined;
if (!env) throw new Error("VITE_APP_ENV env variable must be set");

const config = getConfig();
const factoryAddress = config.simpleAccountFactoryContractAddress;
const genesisTimestamp = config.network.genesis.timestamp;
const BLOCK_TIME_SEC = 10;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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

const OUTPUT_PATH = path.resolve(
  __dirname,
  "../../../../apps/frontend/src/data",
  `insights-${env}.json`
);

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

type EventEntry = {
  account: string;
  owner: string;
  salt: string;
  blockNumber: number;
};

type BalanceEntry = {
  vet: string;
  vtho: string;
  b3tr: string;
  vot3: string;
};

function readJson<T>(p: string): T {
  if (!fs.existsSync(p)) {
    throw new Error(
      `Cache file missing: ${p}\nRun the analytics scripts first (yarn contracts:analyze-deep:${env}).`
    );
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
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

function blockToDate(blockNumber: number): Date {
  return new Date((genesisTimestamp + blockNumber * BLOCK_TIME_SEC) * 1000);
}

function isoDay(d: Date): string {
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = d.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Week bucket = the Monday (UTC) of the ISO week containing the date.
function isoWeekStart(d: Date): string {
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const dayOfWeek = date.getUTCDay() || 7; // Sunday -> 7
  if (dayOfWeek !== 1) date.setUTCDate(date.getUTCDate() - (dayOfWeek - 1));
  return isoDay(date);
}

function isoMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
}

async function main() {
  console.log(`\nExporting insights for ${env} (network ${network.name})`);
  console.log(`Factory: ${factoryAddress}\n`);

  const events: EventEntry[] = readJson(EVENTS_CACHE_PATH);
  const versions: Record<string, number | null> = readJson(VERSIONS_CACHE_PATH);
  let balances: Record<string, BalanceEntry> = {};
  if (fs.existsSync(BALANCES_CACHE_PATH)) {
    balances = readJson(BALANCES_CACHE_PATH);
  } else {
    console.warn(
      "(no balances cache found; treasury section will be omitted)\n"
    );
  }

  console.log(`Events:    ${events.length}`);
  console.log(`Versions:  ${Object.keys(versions).length}`);
  console.log(`Balances:  ${Object.keys(balances).length}\n`);

  // Reclassify events by original implementation (V1 vs V3) using the same logic
  // as the analytics scripts.
  const factory = SimpleAccountFactory__factory.connect(
    factoryAddress,
    ethers.provider
  );
  const [v1Impl, v3Impl] = await Promise.all([
    factory.accountImplementationV1(),
    factory.accountImplementationV3(),
  ]);

  const proxyArt = await artifacts.readArtifact("ERC1967Proxy");
  const simpleAccountArt = await artifacts.readArtifact("SimpleAccount");
  const simpleAccountIface = new Interface(simpleAccountArt.abi);

  type Per = {
    address: string;
    originalImpl: "V1" | "V3";
    blockNumber: number;
  };

  const byAddress = new Map<string, Per>();
  let maxBlock = 0;

  for (const ev of events) {
    if (ev.blockNumber > maxBlock) maxBlock = ev.blockNumber;
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

    let entry: Per;
    if (ev.account === ZERO_ADDRESS || ev.account === v1Addr) {
      entry = { address: v1Addr, originalImpl: "V1", blockNumber: ev.blockNumber };
    } else if (ev.account === v3Addr) {
      entry = { address: v3Addr, originalImpl: "V3", blockNumber: ev.blockNumber };
    } else {
      continue;
    }
    const existing = byAddress.get(entry.address);
    if (!existing || entry.blockNumber < existing.blockNumber) {
      byAddress.set(entry.address, entry);
    }
  }

  const unique = [...byAddress.values()];

  // Version mix.
  let nativeV3 = 0;
  let upgradedV1ToV3 = 0;
  let stillV1 = 0;
  let other = 0;
  for (const c of unique) {
    const v = versions[c.address] ?? null;
    if (v === 3) {
      if (c.originalImpl === "V1") upgradedV1ToV3++;
      else nativeV3++;
    } else if (v === null) {
      if (c.originalImpl === "V1") stillV1++;
      else other++;
    } else {
      other++;
    }
  }

  // Build daily / weekly / monthly buckets in one pass.
  type Bucket = {
    key: string;
    total: number;
    v3Originated: number;
    v1Originated: number;
  };
  const newBucket = (key: string): Bucket => ({
    key,
    total: 0,
    v3Originated: 0,
    v1Originated: 0,
  });

  const dailyMap = new Map<string, Bucket>();
  const weeklyMap = new Map<string, Bucket>();
  const monthlyMap = new Map<string, Bucket>();

  for (const c of unique) {
    const d = blockToDate(c.blockNumber);
    const dKey = isoDay(d);
    const wKey = isoWeekStart(d);
    const mKey = isoMonth(d);
    for (const [map, key] of [
      [dailyMap, dKey],
      [weeklyMap, wKey],
      [monthlyMap, mKey],
    ] as const) {
      let b = map.get(key);
      if (!b) {
        b = newBucket(key);
        map.set(key, b);
      }
      b.total += 1;
      if (c.originalImpl === "V3") b.v3Originated += 1;
      else b.v1Originated += 1;
    }
  }

  const sortByKey = (a: Bucket, b: Bucket) => (a.key < b.key ? -1 : 1);
  const fillDailyGaps = (rows: Bucket[]): Bucket[] => {
    if (rows.length === 0) return rows;
    const start = new Date(rows[0].key + "T00:00:00Z");
    const end = new Date(rows[rows.length - 1].key + "T00:00:00Z");
    const out: Bucket[] = [];
    const idx = new Map(rows.map((r) => [r.key, r]));
    for (
      let cur = new Date(start);
      cur <= end;
      cur.setUTCDate(cur.getUTCDate() + 1)
    ) {
      const k = isoDay(cur);
      out.push(idx.get(k) ?? newBucket(k));
    }
    return out;
  };

  const dailyFull = fillDailyGaps([...dailyMap.values()].sort(sortByKey));
  const weeklyFull = [...weeklyMap.values()].sort(sortByKey);
  const monthly = [...monthlyMap.values()].sort(sortByKey);

  // Trim daily to last 60 days (covers 1M with breathing room) and weekly to
  // the last 26 weeks (~6 months, covers 3M nicely).
  const daily = dailyFull.slice(-60);
  const weekly = weeklyFull.slice(-26);

  // Cumulative total on monthly only (used for "All" view headlines).
  let running = 0;
  const monthlyWithCumulative = monthly.map((m) => {
    running += m.total;
    return { ...m, cumulative: running };
  });

  // === Fleet treasury + activity tiers ===
  const tokenKeys = ["vet", "b3tr", "vot3", "vtho"] as const;
  type TokenKey = (typeof tokenKeys)[number];
  type VersionKey = "nativeV3" | "upgradedV1ToV3" | "stillV1";
  const versionKeys: VersionKey[] = ["nativeV3", "upgradedV1ToV3", "stillV1"];

  // Activity-tier thresholds (in wei, 18-decimal tokens). Tweak if needed.
  // "hot" — meaningful position: ≥1 B3TR or ≥1 VOT3 or ≥10 VET.
  const ONE_TOKEN = 10n ** 18n;
  const HOT_B3TR = ONE_TOKEN;
  const HOT_VOT3 = ONE_TOKEN;
  const HOT_VET = 10n * ONE_TOKEN;

  const classify = (c: { address: string; originalImpl: "V1" | "V3" }): VersionKey => {
    const v = versions[c.address] ?? null;
    if (v === 3) return c.originalImpl === "V1" ? "upgradedV1ToV3" : "nativeV3";
    return "stillV1";
  };

  const emptyTokenMap = () =>
    Object.fromEntries(tokenKeys.map((k) => [k, 0n])) as Record<TokenKey, bigint>;
  const emptyHolders = () =>
    Object.fromEntries(tokenKeys.map((k) => [k, 0])) as Record<TokenKey, number>;

  let treasury:
    | {
        accountsCounted: number;
        fleet: { totals: Record<TokenKey, string>; holders: Record<TokenKey, number> };
        byVersion: Record<
          VersionKey,
          {
            accounts: number;
            withBalance: number;
            totals: Record<TokenKey, string>;
            holders: Record<TokenKey, number>;
            tiers: { hot: number; warm: number; cold: number };
          }
        >;
      }
    | null = null;

  if (Object.keys(balances).length > 0) {
    const fleetTotals = emptyTokenMap();
    const fleetHolders = emptyHolders();
    const versionTotals: Record<VersionKey, Record<TokenKey, bigint>> = {
      nativeV3: emptyTokenMap(),
      upgradedV1ToV3: emptyTokenMap(),
      stillV1: emptyTokenMap(),
    };
    const versionHolders: Record<VersionKey, Record<TokenKey, number>> = {
      nativeV3: emptyHolders(),
      upgradedV1ToV3: emptyHolders(),
      stillV1: emptyHolders(),
    };
    const accountsByVersion: Record<VersionKey, number> = {
      nativeV3: 0,
      upgradedV1ToV3: 0,
      stillV1: 0,
    };
    const withBalanceByVersion: Record<VersionKey, number> = {
      nativeV3: 0,
      upgradedV1ToV3: 0,
      stillV1: 0,
    };
    const tiersByVersion: Record<VersionKey, { hot: number; warm: number; cold: number }> = {
      nativeV3: { hot: 0, warm: 0, cold: 0 },
      upgradedV1ToV3: { hot: 0, warm: 0, cold: 0 },
      stillV1: { hot: 0, warm: 0, cold: 0 },
    };

    let counted = 0;
    for (const c of unique) {
      const bucket = classify(c);
      accountsByVersion[bucket]++;
      const b = balances[c.address];
      if (!b) continue;
      counted++;

      const vals: Record<TokenKey, bigint> = {
        vet: BigInt(b.vet),
        b3tr: BigInt(b.b3tr),
        vot3: BigInt(b.vot3),
        vtho: BigInt(b.vtho),
      };
      let hasAny = false;
      for (const k of tokenKeys) {
        fleetTotals[k] += vals[k];
        versionTotals[bucket][k] += vals[k];
        if (vals[k] > 0n) {
          fleetHolders[k]++;
          versionHolders[bucket][k]++;
          hasAny = true;
        }
      }
      if (hasAny) withBalanceByVersion[bucket]++;

      const isHot =
        vals.b3tr >= HOT_B3TR || vals.vot3 >= HOT_VOT3 || vals.vet >= HOT_VET;
      if (isHot) tiersByVersion[bucket].hot++;
      else if (hasAny) tiersByVersion[bucket].warm++;
      else tiersByVersion[bucket].cold++;
    }

    const toStr = (m: Record<TokenKey, bigint>): Record<TokenKey, string> =>
      Object.fromEntries(tokenKeys.map((k) => [k, m[k].toString()])) as Record<
        TokenKey,
        string
      >;

    treasury = {
      accountsCounted: counted,
      fleet: { totals: toStr(fleetTotals), holders: fleetHolders },
      byVersion: Object.fromEntries(
        versionKeys.map((v) => [
          v,
          {
            accounts: accountsByVersion[v],
            withBalance: withBalanceByVersion[v],
            totals: toStr(versionTotals[v]),
            holders: versionHolders[v],
            tiers: tiersByVersion[v],
          },
        ])
      ) as typeof treasury.byVersion,
    };
  }

  const total = nativeV3 + upgradedV1ToV3 + stillV1 + other;
  const insights = {
    generatedAt: new Date().toISOString(),
    network: network.name,
    factory: factoryAddress,
    snapshotBlock: maxBlock,
    snapshotTimestamp: genesisTimestamp + maxBlock * BLOCK_TIME_SEC,
    totals: {
      total,
      nativeV3,
      upgradedV1ToV3,
      stillV1,
      other,
      v3AdoptionPercent: total > 0 ? ((nativeV3 + upgradedV1ToV3) * 100) / total : 0,
    },
    series: {
      daily,
      weekly,
      monthly: monthlyWithCumulative,
    },
    treasury,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(insights, null, 2));

  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`\nSummary:`);
  console.log(`  Total accounts:      ${total}`);
  console.log(`  Native V3:           ${nativeV3}`);
  console.log(`  Upgraded V1 → V3:    ${upgradedV1ToV3}`);
  console.log(`  Still V1:            ${stillV1}`);
  console.log(`  V3 adoption:         ${insights.totals.v3AdoptionPercent.toFixed(2)}%`);
  console.log(`  Series:              ${daily.length} days, ${weekly.length} weeks, ${monthlyWithCumulative.length} months`);
  if (treasury) {
    console.log(`  Treasury counted:    ${treasury.accountsCounted} / ${total} accounts`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
