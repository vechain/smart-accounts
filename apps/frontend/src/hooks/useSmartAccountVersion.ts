import { getConfig } from "@repo/config";
import { EnvConfig } from "@repo/config/contracts";
import { SimpleAccountFactory__factory } from "@repo/contracts";
import { useQuery } from "@tanstack/react-query";
import { ThorClient } from "@vechain/vechain-kit";

export const getSmartAccountVersion = async (
  thor: ThorClient,
  smartAccountAddress: string,
  ownerAddress: string,
  env: EnvConfig
): Promise<number> => {
  const res = await thor.contracts
    .load(
      getConfig(env).simpleAccountFactoryContractAddress,
      SimpleAccountFactory__factory.abi
    )
    .read.getAccountVersion(smartAccountAddress, ownerAddress);

  if (!res) throw new Error("Reverted");

  return parseInt(res[0].toString());
};

export const getSmartAccountVersionQueryKey = (
  smartAccountAddress: string,
  ownerAddress: string,
  env: EnvConfig
) => ["SMART_ACCOUNT", "VERSION", smartAccountAddress, ownerAddress, env];

/**
 * Get the version of the smart account
 * @returns The version of the smart account
 */
export const useSmartAccountVersion = (
  smartAccountAddress: string,
  ownerAddress: string,
  env: EnvConfig
) => {
  const config = getConfig(env);

  const thor = ThorClient.at(config.network.urls[0]);

  return useQuery({
    queryKey: getSmartAccountVersionQueryKey(
      smartAccountAddress,
      ownerAddress,
      env
    ),
    queryFn: async () =>
      getSmartAccountVersion(thor, smartAccountAddress, ownerAddress, env),
    enabled: !!thor && !!smartAccountAddress && !!ownerAddress && !!env,
  });
};
