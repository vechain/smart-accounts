import { useQuery } from "@tanstack/react-query";
import bundledMainnet from "../data/insights-mainnet.json";

export type Granularity = "daily" | "weekly" | "monthly";

export type SeriesBucket = {
  key: string;
  total: number;
  v3Originated: number;
  v1Originated: number;
};
export type MonthlyBucket = SeriesBucket & { cumulative: number };

export type Insights = {
  generatedAt: string;
  network: string;
  factory: string;
  snapshotBlock: number;
  snapshotTimestamp: number;
  totals: {
    total: number;
    nativeV3: number;
    upgradedV1ToV3: number;
    stillV1: number;
    other: number;
    v3AdoptionPercent: number;
  };
  series: {
    daily: SeriesBucket[];
    weekly: SeriesBucket[];
    monthly: MonthlyBucket[];
  };
};

const REPO = "vechain/smart-accounts";
const BRANCH = "main";
const FILE = "apps/frontend/src/data/insights-mainnet.json";

// jsdelivr serves any file from a public GitHub repo with proper CORS, no
// signup required. It refreshes within minutes when the branch updates, so
// the daily GHA commit shows up on the deployed site without a rebuild.
const remoteUrl = (env: "mainnet" | "testnet") =>
  `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/${FILE.replace(
    "insights-mainnet.json",
    `insights-${env}.json`
  )}`;

const fallback: Record<"mainnet" | "testnet", Insights> = {
  mainnet: bundledMainnet as Insights,
  // We don't bundle a testnet snapshot; treat the mainnet one as a structural
  // placeholder so types stay happy. The chart hides if data is empty.
  testnet: bundledMainnet as Insights,
};

const fetchInsights = async (env: "mainnet" | "testnet"): Promise<Insights> => {
  const res = await fetch(remoteUrl(env), { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load insights: ${res.status}`);
  return (await res.json()) as Insights;
};

export const getInsightsQueryKey = (env: "mainnet" | "testnet") => [
  "INSIGHTS",
  env,
];

export const useInsights = (env: "mainnet" | "testnet" = "mainnet") =>
  useQuery<Insights>({
    queryKey: getInsightsQueryKey(env),
    queryFn: () => fetchInsights(env),
    initialData: fallback[env],
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: 1,
  });
