import { useQuery } from "@tanstack/react-query";
import { SimpleAccountFactory__factory } from "@repo/contracts/typechain-types";
import { ThorClient } from "@vechain/vechain-kit";
import { EnvConfig } from "@repo/config/contracts";
import { getConfig } from "@repo/config";

export const getVersion = async (
  thor: ThorClient,
  contractAddress: string
): Promise<number | string> => {
  const res = await thor.contracts
    .load(contractAddress, SimpleAccountFactory__factory.abi)
    .read.version();

  if (!res) return "Unknown";

  return res[0].toString();
};

export const getVersionQueryKey = (contractAddress: string, env: EnvConfig) => [
  "CONTRACT_VERSION",
  contractAddress,
  env,
];

/**
 * Get the version of the contract
 * @returns The version of the contract
 */
export const useContractVersion = (contractAddress: string, env: EnvConfig) => {
  const config = getConfig(env);

  const thor = ThorClient.at(config.network.urls[0]);

  return useQuery({
    queryKey: getVersionQueryKey(contractAddress, env),
    queryFn: async () => getVersion(thor, contractAddress),
    enabled: !!thor && !!contractAddress && !!env,
  });
};
