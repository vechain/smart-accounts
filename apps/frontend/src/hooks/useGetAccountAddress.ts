import { useQuery } from "@tanstack/react-query";
import { SimpleAccountFactory__factory } from "@repo/contracts/typechain-types";
import { getConfig } from "@repo/config";
import { EnvConfig } from "@repo/config/contracts";
import { ThorClient } from "@vechain/vechain-kit";

export const getAccountAddress = async (
  thor: ThorClient,
  address: string,
  env: EnvConfig
): Promise<string> => {
  const res = await thor.contracts
    .load(
      getConfig(env).simpleAccountFactoryContractAddress,
      SimpleAccountFactory__factory.abi
    )
    .read.getAccountAddress(address);

  if (!res) throw new Error("Reverted");

  return res[0].toString();
};

export const getAccountAddressQueryKey = (address: string, env: EnvConfig) => [
  "getAccountAddress",
  address,
  env,
];

export const useGetAccountAddress = (address: string, env: EnvConfig) => {
  const config = getConfig(env);

  const thor = ThorClient.at(config.network.urls[0]);

  return useQuery({
    queryKey: getAccountAddressQueryKey(address, env),
    queryFn: async () => getAccountAddress(thor, address, env),
    enabled: !!thor && !!address && !!env,
  });
};
