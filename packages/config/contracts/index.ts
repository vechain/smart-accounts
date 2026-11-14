export * from "./type";

import { createTestnetConfig } from "./envs/testnet";
import { createMainnetConfig } from "./envs/mainnet";

export const EnvConfigValues = ["testnet", "mainnet"] as const;
export type EnvConfig = (typeof EnvConfigValues)[number];

export function getContractsConfig(env: EnvConfig) {
  switch (env) {
    case "testnet":
      return createTestnetConfig();
    case "mainnet":
      return createMainnetConfig();

    default:
      throw new Error(`Invalid ENV "${env}"`);
  }
}

export function shouldRunSimulation() {
  return (
    process.env.VITE_APP_ENV == "local" && process.env.RUN_SIMULATION === "true"
  );
}

export function isE2E() {
  return process.env.VITE_APP_ENV == "e2e";
}
