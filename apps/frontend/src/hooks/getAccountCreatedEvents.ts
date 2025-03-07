import { abi } from "thor-devkit";
import { getConfig } from "@repo/config";
import { SimpleAccountFactoryJson } from "@repo/contracts";
import { getAllEvents } from "./getEvents";
import { EnvConfig } from "@repo/config/contracts";
const simpleAccountFactoryAbi = SimpleAccountFactoryJson.abi;

export type AccountCreatedEvent = {
  address: string;
  owner: string;
  salt: string;
};

// When fetching the events from the mainnet we are having
// some scalability issues (calling thousends of events)
// so we are taking a snapshot at a specific block and then
// fetching the events from that block
// const MAINNET_SNAPSHOT_BLOCK = 21134975;
const MAINNET_SNAPSHOT_BLOCK = 21134975;
const MAINNET_CREATED_ACCOUNTS_COUNT_AT_SNAPSHOT = 135143;

export const getAccountsCreatedEvents = async (
  thor: Connex.Thor,
  env: EnvConfig
) => {
  const simpleAccountFactoryContractAddress =
    getConfig(env).simpleAccountFactoryContractAddress;

  const accountCreatedAbi = simpleAccountFactoryAbi.find(
    (abi) => abi.name === "AccountCreated"
  );
  if (!accountCreatedAbi) throw new Error("AccountCreated event not found");
  const accountCreatedEvent = new abi.Event(
    accountCreatedAbi as unknown as abi.Event.Definition
  );

  /**
   * Filter criteria to get the events from the governor contract that we are interested in
   * This way we can get all of them in one call
   */
  const filterCriteria = [
    {
      address: simpleAccountFactoryContractAddress,
      topic0: accountCreatedEvent.signature,
    },
  ];

  const fromBlock = env === "mainnet" ? MAINNET_SNAPSHOT_BLOCK : 0;
  const events = await getAllEvents({
    thor,
    filterCriteria,
    from: fromBlock,
  });

  /**
   * Decode the events to get the data we are interested in (i.e the proposals)
   */
  const decodedCreatedAccountsEvents: AccountCreatedEvent[] = [];

  //   TODO: runtime validation with zod ?
  events.forEach((event) => {
    switch (event.topics[0]) {
      case accountCreatedEvent.signature: {
        const decoded = accountCreatedEvent.decode(event.data, event.topics);
        decodedCreatedAccountsEvents.push({
          address: decoded[0],
          owner: decoded[1],
          salt: decoded[2],
        });
        break;
      }

      default: {
        throw new Error("Unknown event");
      }
    }
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
