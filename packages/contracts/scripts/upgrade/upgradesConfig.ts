export interface UpgradeContract {
  name: string;
  configAddressField: string;
  versions: readonly string[];
  descriptions: Record<string, string>;
}

export const upgradeConfig: Record<string, UpgradeContract> = {
  "Simple Account Factory": {
    name: "simple-account-factory",
    configAddressField: "simpleAccountFactoryContractAddress",
    versions: ["v2", "v3"],
    descriptions: {
      v2: "Add transfer ownership of simple account.",
      v3: "Add batch execution of transactions.",
    },
  },
} as const;
