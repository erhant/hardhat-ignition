import { Contract, ethers } from "ethers";

import { ExecutionContext } from "types/deployment";
import { AwaitedEvent } from "types/executionGraph";
import { VertexVisitResult } from "types/graph";

import { resolveFrom, toAddress } from "./utils";

export async function executeAwaitedEvent(
  { event, address, abi, args }: AwaitedEvent,
  resultAccumulator: Map<number, VertexVisitResult | null>,
  { services, options }: ExecutionContext
): Promise<VertexVisitResult> {
  const resolve = resolveFrom(resultAccumulator);

  const resolvedArgs = [...args, address].map(resolve).map(toAddress);

  const resolvedAddress = resolvedArgs.pop();

  let topics: ethers.utils.Result;
  try {
    const contractInstance = new Contract(resolvedAddress, abi);

    const filter = contractInstance.filters[event](...resolvedArgs);

    const eventResult = await services.transactions.waitForEvent(
      filter,
      options.awaitEventDuration
    );

    if (eventResult === null) {
      // todo: implement on hold state
      return {
        _kind: "failure",
        failure: new Error(
          "Event not emitted within duration - try again later"
        ),
      };
    }

    topics = contractInstance.interface.parseLog(eventResult).args;
  } catch (err) {
    return {
      _kind: "failure",
      failure: err as any,
    };
  }

  return {
    _kind: "success",
    result: {
      topics,
    },
  };
}