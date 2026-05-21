import { useQuery } from "@tanstack/react-query";
import bundledMainnet from "../data/insights-mainnet.json";

// The shape comes from packages/contracts/scripts/analytics/exportInsights.ts.
export type Insights = typeof bundledMainnet;

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
  mainnet: bundledMainnet,
  // We don't bundle a testnet snapshot; treat the mainnet one as a structural
  // placeholder so types stay happy. The chart hides if data is empty.
  testnet: bundledMainnet,
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
  useQuery({
    queryKey: getInsightsQueryKey(env),
    queryFn: () => fetchInsights(env),
    // Show the bundled snapshot immediately, then swap in the fresh fetch.
    initialData: fallback[env],
    // Bundled JSON is built into the deploy artifact, so it's only as fresh as
    // the last build. Always re-fetch on mount so the CDN copy wins.
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: 1,
  });
