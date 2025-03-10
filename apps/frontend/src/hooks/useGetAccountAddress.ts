import { useQuery } from "@tanstack/react-query";
import { SimpleAccountFactory__factory } from "@repo/contracts/typechain-types";
import SimpleAccountFactoryAbi from "@repo/contracts/artifacts/contracts/accounts/SimpleAccountFactory.sol/SimpleAccountFactory.json";
import { getConfig } from "@repo/config";
import { EnvConfig } from "@repo/config/contracts";
import Connex from "@vechain/connex";

const SimpleAccountFactoryInterface =
  SimpleAccountFactory__factory.createInterface();

export const getAccountAddress = async (
  thor: Connex.Thor,
  address: string,
  env: EnvConfig
): Promise<string> => {
  const functionFragment =
    SimpleAccountFactoryInterface.getFunction("getAccountAddress").format(
      "json"
    );

  const fragment = SimpleAccountFactoryAbi.abi.find(
    (fun) => fun.name === "getAccountAddress"
  );
  if (!fragment) throw new Error("getAccountAddress not found");

  const res = await thor
    .account(getConfig(env).simpleAccountFactoryContractAddress)
    .method(JSON.parse(functionFragment))
    .call(address);

  if (res.reverted) throw new Error("Reverted");

  return res.decoded[0];
};

export const getAccountAddressQueryKey = (address: string, env: EnvConfig) => [
  "getAccountAddress",
  address,
  env,
];

export const useGetAccountAddress = (address: string, env: EnvConfig) => {
  const config = getConfig(env);

  const thor = new Connex.Thor({
    node: config.network.urls[0],
    network: config.network.type,
  });

  return useQuery({
    queryKey: getAccountAddressQueryKey(address, env),
    queryFn: async () => getAccountAddress(thor, address, env),
    enabled: !!thor && !!address && !!env,
  });
};
