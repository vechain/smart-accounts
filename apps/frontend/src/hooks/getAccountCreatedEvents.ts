import { getConfig } from "@repo/config";
import { SimpleAccountFactory__factory } from "@repo/contracts";
import { EnvConfig } from "@repo/config/contracts";
import { getAllEventLogs, ThorClient } from "@vechain/vechain-kit";
import { FilterCriteria } from "@vechain/sdk-network";

export type AccountCreatedEvent = {
  address: string;
  owner: string;
  salt: string;
};

// When fetching the events from the mainnet we are having
// some scalability issues (calling thousends of events)
// so we are taking a snapshot at a specific block and then
// fetching the events from that block
const MAINNET_SNAPSHOT_BLOCK = 21086312;
const MAINNET_CREATED_ACCOUNTS_COUNT_AT_SNAPSHOT = 135243;

export const getAccountsCreatedEvents = async (
  thor: ThorClient,
  env: EnvConfig
) => {
  const simpleAccountFactoryContractAddress =
    getConfig(env).simpleAccountFactoryContractAddress;

  const eventAbi = thor.contracts
    .load(
      simpleAccountFactoryContractAddress,
      SimpleAccountFactory__factory.abi
    )
    .getEventAbi("AccountCreated");

  const topics = eventAbi.encodeFilterTopicsNoNull({});

  /**
   * Filter criteria to get the events from the governor contract that we are interested in
   * This way we can get all of them in one call
   */
  const filterCriteria: FilterCriteria[] = [
    {
      criteria: {
        address: simpleAccountFactoryContractAddress,
        topic0: topics[0] ?? undefined,
        topic1: topics[1] ?? undefined,
        topic2: topics[2] ?? undefined,
        topic3: topics[3] ?? undefined,
        topic4: topics[4] ?? undefined,
      },
      eventAbi,
    },
  ];

  const fromBlock = env === "mainnet" ? MAINNET_SNAPSHOT_BLOCK : 0;
  const events = await getAllEventLogs({
    nodeUrl: thor.httpClient.baseURL,
    thor,
    from: fromBlock,
    to: undefined,
    filterCriteria,
  });

  /**
   * Decode the events to get the data we are interested in (i.e the proposals)
   */
  const decodedCreatedAccountsEvents: AccountCreatedEvent[] = [];

  //   TODO: runtime validation with zod ?
  events.forEach((event) => {
    if (!event.decodedData) {
      throw new Error("Event data not decoded");
    }

    const [address, owner, salt] = event.decodedData as [
      string,
      string,
      string,
    ];
    decodedCreatedAccountsEvents.push({
      address,
      owner,
      salt,
    });
  });

  return {
    created: decodedCreatedAccountsEvents,
    // we snapshotted the mainnet at a specific block to improve
    // the performance of the query
    totalCreated:
      env === "mainnet"
        ? MAINNET_CREATED_ACCOUNTS_COUNT_AT_SNAPSHOT +
          decodedCreatedAccountsEvents.length
        : decodedCreatedAccountsEvents.length,
  };
};
