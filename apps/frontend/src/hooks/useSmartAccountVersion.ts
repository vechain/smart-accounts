import { getConfig } from "@repo/config";
import { EnvConfig } from "@repo/config/contracts";
import { SimpleAccountFactory__factory } from "@repo/contracts";
import { useQuery } from "@tanstack/react-query";
import Connex from "@vechain/connex";

const SimpleAccountFactoryInterface =
  SimpleAccountFactory__factory.createInterface();

export const getVersion = async (
  thor: Connex.Thor,
  smartAccountAddress: string,
  ownerAddress: string,
  env: EnvConfig
): Promise<number> => {
  const functionFragment =
    SimpleAccountFactoryInterface.getFunction("getAccountVersion").format(
      "json"
    );

  const res = await thor
    .account(getConfig(env).simpleAccountFactoryContractAddress)
    .method(JSON.parse(functionFragment))
    .call(smartAccountAddress, ownerAddress);

  if (res.reverted) throw new Error("Reverted");

  return parseInt(res.decoded[0]);
};

export const getVersionQueryKey = (
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

  const thor = new Connex.Thor({
    node: config.network.urls[0],
    network: config.network.type,
  });

  return useQuery({
    queryKey: getVersionQueryKey(smartAccountAddress, ownerAddress, env),
    queryFn: async () =>
      getVersion(thor, smartAccountAddress, ownerAddress, env),
    enabled: !!thor && !!smartAccountAddress && !!ownerAddress && !!env,
  });
};
