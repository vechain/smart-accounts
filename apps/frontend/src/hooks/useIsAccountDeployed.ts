import { useQuery } from "@tanstack/react-query";
import Connex from "@vechain/connex";
import { getConfig } from "@repo/config";
import { EnvConfig } from "@repo/config/contracts";

export const getIsAccountDeployedQueryKey = (
  address: string,
  env: EnvConfig
) => ["isAccountDeployed", address, env];

const getIsAccountDeployed = async (
  thor: Connex.Thor,
  address: string
): Promise<boolean> => {
  const account = await thor.account(address).get();
  return account.hasCode;
};

export const useIsAccountDeployed = (env: EnvConfig, address?: string) => {
  const config = getConfig(env);

  const thor = new Connex.Thor({
    node: config.network.urls[0],
    network: config.network.type,
  });

  return useQuery({
    queryKey: getIsAccountDeployedQueryKey(address ?? "", env),
    queryFn: async () => {
      if (!address) return false;
      return getIsAccountDeployed(thor, address);
    },
    enabled: !!address && !!thor && !!env,
  });
};
