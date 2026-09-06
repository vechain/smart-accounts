import testnetConfig from "./testnet";
import mainnetConfig from "./mainnet";
import { EnvConfig, getContractsConfig } from "./contracts";
import { Network } from "@repo/constants";

export type AppConfig = {
  environment: EnvConfig;
  basePath?: string;
  simpleAccountFactoryContractAddress: string;
  nodeUrl: string;
  network: Network;
};

export const getConfig = (env?: EnvConfig): AppConfig => {
  const appEnv = env || process.env.VITE_APP_ENV;

  if (!appEnv)
    throw new Error(
      "VITE_APP_ENV env variable must be set or a type must be passed to getConfig()"
    );
  if (appEnv === "testnet") return testnetConfig;
  if (appEnv === "mainnet") return mainnetConfig;
  throw new Error(`Unsupported VITE_APP_ENV ${appEnv}`);
};

export { getContractsConfig };
