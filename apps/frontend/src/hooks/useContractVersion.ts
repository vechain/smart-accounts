import { useQuery } from "@tanstack/react-query";
import { SimpleAccountFactory__factory } from "@repo/contracts/typechain-types";
import Connex from "@vechain/connex";
import { EnvConfig } from "@repo/config/contracts";
import { getConfig } from "@repo/config";

const SimpleAccountFactoryInterface =
  SimpleAccountFactory__factory.createInterface();

export const getVersion = async (
  thor: Connex.Thor,
  contractAddress: string
): Promise<number | string> => {
  const functionFragment =
    SimpleAccountFactoryInterface.getFunction("version").format("json");

  const res = await thor
    .account(contractAddress)
    .method(JSON.parse(functionFragment))
    .call();

  if (res.reverted) return "Unknown";

  return res.decoded[0];
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

  const thor = new Connex.Thor({
    node: config.network.urls[0],
    network: config.network.type,
  });

  return useQuery({
    queryKey: getVersionQueryKey(contractAddress, env),
    queryFn: async () => getVersion(thor, contractAddress),
    enabled: !!thor,
  });
};
