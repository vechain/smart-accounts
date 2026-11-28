import { useQuery } from "@tanstack/react-query";
import { getAccountsCreatedEvents } from "./getAccountCreatedEvents";
import { EnvConfig } from "@repo/config/contracts";
import { getConfig } from "@repo/config";
import { ThorClient } from "@vechain/vechain-kit";

export const getAccountCreatedEventsQueryKey = (env: EnvConfig) => [
  "accountsCreated",
  env,
];

export const useAccountCreatedEvents = (env: EnvConfig) => {
  const config = getConfig(env);

  const thor = ThorClient.at(config.network.urls[0]);

  return useQuery({
    queryKey: getAccountCreatedEventsQueryKey(env),
    queryFn: async () => await getAccountsCreatedEvents(thor, env),
    enabled: !!thor,
  });
};
