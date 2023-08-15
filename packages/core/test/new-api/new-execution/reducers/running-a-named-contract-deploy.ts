import { assert } from "chai";

import { DeploymentState } from "../../../../src/new-api/internal/new-execution/types/deployment-state";
import { EvmExecutionResultTypes } from "../../../../src/new-api/internal/new-execution/types/evm-execution";
import { ExecutionResultType } from "../../../../src/new-api/internal/new-execution/types/execution-result";
import {
  DeploymentExecutionState,
  ExecutionSateType,
  ExecutionStatus,
} from "../../../../src/new-api/internal/new-execution/types/execution-state";
import { TransactionReceiptStatus } from "../../../../src/new-api/internal/new-execution/types/jsonrpc";
import {
  DeploymentExecutionStateCompleteMessage,
  DeploymentExecutionStateInitializeMessage,
  JournalMessageType,
  NetworkInteractionRequestMessage,
  TransactionConfirmMessage,
  TransactionSendMessage,
} from "../../../../src/new-api/internal/new-execution/types/messages";
import { NetworkInteractionType } from "../../../../src/new-api/internal/new-execution/types/network-interaction";
import { findOnchainInteractionBy } from "../../../../src/new-api/internal/new-execution/views/deployment-execution-state/find-onchain-interaction-by";
import { findTransactionBy } from "../../../../src/new-api/internal/new-execution/views/deployment-execution-state/find-transaction-by";
import { findDeploymentExecutionStateBy } from "../../../../src/new-api/internal/new-execution/views/find-deployment-execution-state-by";
import { FutureType } from "../../../../src/new-api/types/module";

import { applyMessages } from "./utils";

describe("DeploymentStateReducer", () => {
  describe("running a named contract deploy", () => {
    const exampleAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984";

    let updatedDeploymentState: DeploymentState;
    let updatedDepExState: DeploymentExecutionState;

    const initializeNamedContractDeployMessage: DeploymentExecutionStateInitializeMessage =
      {
        type: JournalMessageType.DEPLOYMENT_EXECUTION_STATE_INITIALIZE,
        futureId: "future1",
        futureType: FutureType.NAMED_CONTRACT_DEPLOYMENT,
        strategy: "basic",
        dependencies: [],
        artifactFutureId: "future1",
        contractName: "MyContract",
        constructorArgs: [],
        libraries: {},
        value: BigInt(0),
        from: undefined,
      };

    const requestNetworkInteractionMessage: NetworkInteractionRequestMessage = {
      type: JournalMessageType.NETWORK_INTERACTION_REQUEST,
      futureId: "future1",
      networkInteraction: {
        id: 1,
        type: NetworkInteractionType.ONCHAIN_INTERACTION,
        to: undefined,
        data: "fake-data",
        value: BigInt(0),
        from: "string",
        transactions: [],
      },
    };

    const sendTransactionMessage: TransactionSendMessage = {
      type: JournalMessageType.TRANSACTION_SEND,
      futureId: "future1",
      networkInteractionId: 1,
      transaction: {
        hash: "0xdeadbeef",
        maxFeePerGas: BigInt(10),
        maxPriorityFeePerGas: BigInt(5),
      },
    };

    const sendAnotherTransactionMessage: TransactionSendMessage = {
      type: JournalMessageType.TRANSACTION_SEND,
      futureId: "future1",
      networkInteractionId: 1,
      transaction: {
        hash: "0xanother",
        maxFeePerGas: BigInt(20),
        maxPriorityFeePerGas: BigInt(10),
      },
    };

    const confirmTransactionMessage: TransactionConfirmMessage = {
      type: JournalMessageType.TRANSACTION_CONFIRM,
      futureId: "future1",
      networkInteractionId: 1,
      hash: "0xdeadbeef",
      receipt: {
        blockHash: "0xblockhash",
        blockNumber: 0,
        contractAddress: exampleAddress,
        status: TransactionReceiptStatus.SUCCESS,
        logs: [],
      },
    };

    const deploymentSuccessMessage: DeploymentExecutionStateCompleteMessage = {
      type: JournalMessageType.DEPLOYMENT_EXECUTION_STATE_COMPLETE,
      futureId: "future1",
      result: {
        type: ExecutionResultType.SUCCESS,
        address: exampleAddress,
      },
    };

    const deploymentFailsWithRevertMessage: DeploymentExecutionStateCompleteMessage =
      {
        type: JournalMessageType.DEPLOYMENT_EXECUTION_STATE_COMPLETE,
        futureId: "future1",
        result: {
          type: ExecutionResultType.REVERTED_TRANSACTION,
        },
      };

    const deploymentFailsOnStaticCall: DeploymentExecutionStateCompleteMessage =
      {
        type: JournalMessageType.DEPLOYMENT_EXECUTION_STATE_COMPLETE,
        futureId: "future1",
        result: {
          type: ExecutionResultType.STATIC_CALL_ERROR,
          error: {
            type: EvmExecutionResultTypes.REVERT_WITH_REASON,
            message: "Not a valid parameter value",
          },
        },
      };

    const deploymentFailOnStrategyError: DeploymentExecutionStateCompleteMessage =
      {
        type: JournalMessageType.DEPLOYMENT_EXECUTION_STATE_COMPLETE,
        futureId: "future1",
        result: {
          type: ExecutionResultType.STRATEGY_ERROR,
          error: `Transaction 0xdeadbeaf confirmed but it didn't create a contract`,
        },
      };

    const deploymentFailOnSimulationError: DeploymentExecutionStateCompleteMessage =
      {
        type: JournalMessageType.DEPLOYMENT_EXECUTION_STATE_COMPLETE,
        futureId: "future1",
        result: {
          type: ExecutionResultType.SIMULATION_ERROR,
          error: {
            type: EvmExecutionResultTypes.REVERT_WITH_REASON,
            message: "Not a valid parameter value",
          },
        },
      };

    describe("initialization", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeNamedContractDeployMessage,
        ]);

        updatedDepExState = findDeploymentExecutionStateBy(
          updatedDeploymentState,
          "future1"
        );
      });

      it("should populate a deployment execution state for the future", () => {
        assert.equal(
          updatedDepExState.type,
          ExecutionSateType.DEPLOYMENT_EXECUTION_STATE
        );
      });
    });

    describe("strategy requesting an onchain interaction", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeNamedContractDeployMessage,
          requestNetworkInteractionMessage,
        ]);

        updatedDepExState = findDeploymentExecutionStateBy(
          updatedDeploymentState,
          "future1"
        );
      });

      it("should populate a new onchain interaction", () => {
        assert.equal(updatedDepExState.networkInteractions.length, 1);

        assert.deepStrictEqual(
          updatedDepExState.networkInteractions[0],
          requestNetworkInteractionMessage.networkInteraction
        );
      });
    });

    describe("execution engine sends transaction", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeNamedContractDeployMessage,
          requestNetworkInteractionMessage,
          sendTransactionMessage,
        ]);

        updatedDepExState = findDeploymentExecutionStateBy(
          updatedDeploymentState,
          "future1"
        );
      });

      it("should populate the transaction against the network interaction", () => {
        const networkInteraction = findOnchainInteractionBy(
          updatedDepExState,
          1
        );

        assert.equal(networkInteraction.transactions.length, 1);

        const transaction = findTransactionBy(
          updatedDepExState,
          1,
          "0xdeadbeef"
        );

        assert.deepStrictEqual(sendTransactionMessage.transaction, transaction);
      });
    });

    describe("transaction confirms successfully", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeNamedContractDeployMessage,
          requestNetworkInteractionMessage,
          sendTransactionMessage,
          sendAnotherTransactionMessage,
          confirmTransactionMessage,
        ]);

        updatedDepExState = findDeploymentExecutionStateBy(
          updatedDeploymentState,
          "future1"
        );
      });

      it("should set the receipt against the successful transaction", () => {
        const transaction = findTransactionBy(
          updatedDepExState,
          1,
          "0xdeadbeef"
        );

        assert.deepStrictEqual(
          transaction.receipt,
          confirmTransactionMessage.receipt
        );
      });

      it("should clear all other transactions for the network interaction", () => {
        const networkInteraction = findOnchainInteractionBy(
          updatedDepExState,
          1
        );

        assert.equal(networkInteraction.transactions.length, 1);
      });
    });

    describe("deployment completes successfully", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeNamedContractDeployMessage,
          requestNetworkInteractionMessage,
          sendTransactionMessage,
          sendAnotherTransactionMessage,
          confirmTransactionMessage,
          deploymentSuccessMessage,
        ]);

        updatedDepExState = findDeploymentExecutionStateBy(
          updatedDeploymentState,
          "future1"
        );
      });

      it("should set the result against the execution state", () => {
        assert.deepStrictEqual(updatedDepExState.result, {
          type: ExecutionResultType.SUCCESS,
          address: exampleAddress,
        });
      });

      it("should update the status to success", () => {
        assert.deepStrictEqual(
          updatedDepExState.status,
          ExecutionStatus.SUCCESS
        );
      });
    });

    describe("deployment errors on a revert", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeNamedContractDeployMessage,
          requestNetworkInteractionMessage,
          sendTransactionMessage,
          sendAnotherTransactionMessage,
          confirmTransactionMessage,
          deploymentFailsWithRevertMessage,
        ]);

        updatedDepExState = findDeploymentExecutionStateBy(
          updatedDeploymentState,
          "future1"
        );
      });

      it("should set the result as a revert", () => {
        assert.deepStrictEqual(updatedDepExState.result, {
          type: ExecutionResultType.REVERTED_TRANSACTION,
        });
      });

      it("should update the status to failed", () => {
        assert.equal(updatedDepExState.status, ExecutionStatus.FAILED);
      });
    });

    /**
     * This is possible because an execution strategy can make static calls
     * for a deployment.
     */
    describe("deployment errors after a failed static call", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeNamedContractDeployMessage,
          requestNetworkInteractionMessage,
          sendTransactionMessage,
          sendAnotherTransactionMessage,
          confirmTransactionMessage,
          deploymentFailsOnStaticCall,
        ]);

        updatedDepExState = findDeploymentExecutionStateBy(
          updatedDeploymentState,
          "future1"
        );
      });

      it("should set the result as a revert", () => {
        assert.deepStrictEqual(updatedDepExState.result, {
          type: ExecutionResultType.STATIC_CALL_ERROR,
          error: {
            type: EvmExecutionResultTypes.REVERT_WITH_REASON,
            message: "Not a valid parameter value",
          },
        });
      });

      it("should update the status to failed", () => {
        assert.equal(updatedDepExState.status, ExecutionStatus.FAILED);
      });
    });

    describe("deployment errors after a strategy error", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeNamedContractDeployMessage,
          requestNetworkInteractionMessage,
          sendTransactionMessage,
          sendAnotherTransactionMessage,
          confirmTransactionMessage,
          deploymentFailOnStrategyError,
        ]);

        updatedDepExState = findDeploymentExecutionStateBy(
          updatedDeploymentState,
          "future1"
        );
      });

      it("should set the result as a revert", () => {
        assert.deepStrictEqual(updatedDepExState.result, {
          type: ExecutionResultType.STRATEGY_ERROR,
          error:
            "Transaction 0xdeadbeaf confirmed but it didn't create a contract",
        });
      });

      it("should update the status to failed", () => {
        assert.equal(updatedDepExState.status, ExecutionStatus.FAILED);
      });
    });

    describe("deployment errors after a simulation error", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeNamedContractDeployMessage,
          requestNetworkInteractionMessage,
          sendTransactionMessage,
          sendAnotherTransactionMessage,
          confirmTransactionMessage,
          deploymentFailOnSimulationError,
        ]);

        updatedDepExState = findDeploymentExecutionStateBy(
          updatedDeploymentState,
          "future1"
        );
      });

      it("should set the result as a revert", () => {
        assert.deepStrictEqual(updatedDepExState.result, {
          type: ExecutionResultType.SIMULATION_ERROR,
          error: {
            type: EvmExecutionResultTypes.REVERT_WITH_REASON,
            message: "Not a valid parameter value",
          },
        });
      });

      it("should update the status to failed", () => {
        assert.equal(updatedDepExState.status, ExecutionStatus.FAILED);
      });
    });
  });
});
