import { useQuery } from "@tanstack/react-query";
import { getConfig } from "@repo/config";
import { EnvConfig } from "@repo/config/contracts";
import { ThorClient } from "@vechain/vechain-kit";
import { Address } from "@vechain/sdk-core";

export const getIsAccountDeployedQueryKey = (
  address: string,
  env: EnvConfig
) => ["isAccountDeployed", address, env];

const getIsAccountDeployed = async (
  thor: ThorClient,
  address: string
): Promise<boolean> => {
  const accountDetail = await thor.accounts.getAccount(Address.of(address));
  return accountDetail.hasCode;
};

export const useIsAccountDeployed = (env: EnvConfig, address?: string) => {
  const config = getConfig(env);

  const thor = ThorClient.at(config.network.urls[0]);

  return useQuery({
    queryKey: getIsAccountDeployedQueryKey(address ?? "", env),
    queryFn: async () => {
      if (!address) return false;
      return getIsAccountDeployed(thor, address);
    },
    enabled: !!address && !!thor && !!env,
  });
};
