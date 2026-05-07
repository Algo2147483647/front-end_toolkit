import { applyGraphCommand, type CommandResult, type GraphCommand } from "../graph/commands";
import { structuredCloneValue } from "../graph/serialize";
import type { NodeKey, NormalizedDag } from "../graph/types";
import type { ConsoleInstruction, ConsoleNodeOperand } from "./dsl";
import { buildConsoleHelpText } from "./reference";

export interface ConsoleUiEffect {
  type: "show" | "json";
  nodeKey: NodeKey;
  line: number;
}

export type ConsoleRunResult =
  | {
    ok: true;
    dag: NormalizedDag;
    contextNodeKey: NodeKey | null;
    results: CommandResult[];
    uiEffects: ConsoleUiEffect[];
    outputMessages: string[];
    instructionCount: number;
    mutationCount: number;
  }
  | {
    ok: false;
    line: number;
    message: string;
    contextNodeKey: NodeKey | null;
  };

export function executeConsoleInstructions(
  dag: NormalizedDag,
  instructions: ConsoleInstruction[],
  initialContextNodeKey: NodeKey | null,
): ConsoleRunResult {
  let workingDag = structuredCloneValue(dag);
  let contextNodeKey = initialContextNodeKey;
  const results: CommandResult[] = [];
  const uiEffects: ConsoleUiEffect[] = [];
  const outputMessages: string[] = [];

  for (const instruction of instructions) {
    try {
      switch (instruction.type) {
        case "help": {
          outputMessages.push(buildConsoleHelpText());
          break;
        }
        case "use": {
          const key = resolveExistingNodeKey(instruction.key, contextNodeKey, workingDag, instruction.line);
          contextNodeKey = key;
          break;
        }
        case "show": {
          const key = resolveExistingNodeKey(instruction.key, contextNodeKey, workingDag, instruction.line);
          uiEffects.push({ type: "show", nodeKey: key, line: instruction.line });
          break;
        }
        case "json": {
          const key = resolveExistingNodeKey(instruction.key, contextNodeKey, workingDag, instruction.line);
          uiEffects.push({ type: "json", nodeKey: key, line: instruction.line });
          break;
        }
        case "rename": {
          const oldKey = resolveExistingNodeKey(instruction.oldKey, contextNodeKey, workingDag, instruction.line);
          const result = applyGraphCommand(workingDag, { type: "renameNode", oldKey, newKey: instruction.newKey });
          workingDag = result.dag;
          contextNodeKey = remapContextKey(contextNodeKey, result);
          syncUiEffects(uiEffects, result);
          results.push(result);
          break;
        }
        case "delete": {
          const key = resolveExistingNodeKey(instruction.key, contextNodeKey, workingDag, instruction.line);
          const result = applyGraphCommand(workingDag, instruction.recursive ? { type: "deleteSubtree", rootKey: key } : { type: "deleteNode", key });
          workingDag = result.dag;
          contextNodeKey = remapContextKey(contextNodeKey, result);
          syncUiEffects(uiEffects, result);
          results.push(result);
          break;
        }
        case "add": {
          const parentKey = instruction.parentKey
            ? resolveExistingNodeKey(instruction.parentKey, contextNodeKey, workingDag, instruction.line)
            : undefined;
          const result = applyGraphCommand(workingDag, { type: "addNode", key: instruction.key, parentKey });
          workingDag = result.dag;
          contextNodeKey = remapContextKey(contextNodeKey, result);
          syncUiEffects(uiEffects, result);
          results.push(result);
          break;
        }
        case "copy": {
          const sourceKey = resolveExistingNodeKey(instruction.sourceKey, contextNodeKey, workingDag, instruction.line);
          const parentKey = instruction.parentKey
            ? resolveExistingNodeKey(instruction.parentKey, contextNodeKey, workingDag, instruction.line)
            : undefined;
          const result = applyGraphCommand(workingDag, { type: "copyNode", sourceKey, key: instruction.key, parentKey });
          workingDag = result.dag;
          contextNodeKey = remapContextKey(contextNodeKey, result);
          syncUiEffects(uiEffects, result);
          results.push(result);
          break;
        }
        case "setParents": {
          const key = resolveExistingNodeKey(instruction.key, contextNodeKey, workingDag, instruction.line);
          const parents = instruction.keys.map((item) => resolveExistingNodeKey(item, contextNodeKey, workingDag, instruction.line));
          const result = applyGraphCommand(workingDag, { type: "setParents", key, parents });
          workingDag = result.dag;
          contextNodeKey = remapContextKey(contextNodeKey, result);
          syncUiEffects(uiEffects, result);
          results.push(result);
          break;
        }
        case "setChildren": {
          const key = resolveExistingNodeKey(instruction.key, contextNodeKey, workingDag, instruction.line);
          const children = instruction.keys.map((item) => resolveExistingNodeKey(item, contextNodeKey, workingDag, instruction.line));
          const result = applyGraphCommand(workingDag, { type: "setChildren", key, children });
          workingDag = result.dag;
          contextNodeKey = remapContextKey(contextNodeKey, result);
          syncUiEffects(uiEffects, result);
          results.push(result);
          break;
        }
        case "setField": {
          const key = resolveExistingNodeKey(instruction.key, contextNodeKey, workingDag, instruction.line);
          if (instruction.field === "key") {
            throw new Error("Use mv to rename a node key.");
          }
          if (instruction.field === "parents" || instruction.field === "children") {
            throw new Error(`Use ${instruction.field} to replace relation sets.`);
          }
          const currentNode = workingDag[key];
          if (!currentNode) {
            throw new Error(`Node "${key}" does not exist.`);
          }
          const { key: _oldKey, ...fields } = structuredCloneValue(currentNode);
          fields[instruction.field] = instruction.value;
          const result = applyGraphCommand(workingDag, { type: "updateNodeFields", key, fields });
          workingDag = result.dag;
          contextNodeKey = remapContextKey(contextNodeKey, result);
          syncUiEffects(uiEffects, result);
          results.push(result);
          break;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "The console instruction failed.";
      return { ok: false, line: instruction.line, message, contextNodeKey };
    }
  }

  return {
    ok: true,
    dag: workingDag,
    contextNodeKey,
    results,
    uiEffects,
    outputMessages,
    instructionCount: instructions.length,
    mutationCount: results.length,
  };
}

function resolveExistingNodeKey(
  operand: ConsoleNodeOperand,
  contextNodeKey: NodeKey | null,
  dag: NormalizedDag,
  line: number,
): NodeKey {
  const key = operand.type === "context" ? contextNodeKey : operand.value;
  if (!key) {
    throw new Error(`Line ${line}: Current context is empty. Use "use <node>" first.`);
  }
  if (!dag[key]) {
    throw new Error(`Node "${key}" does not exist.`);
  }
  return key;
}

function remapContextKey(contextNodeKey: NodeKey | null, result: CommandResult): NodeKey | null {
  if (!contextNodeKey) {
    return null;
  }
  if (result.renamedKey && contextNodeKey === result.renamedKey.from) {
    return result.renamedKey.to;
  }
  if (result.deletedKeys?.includes(contextNodeKey)) {
    return null;
  }
  return contextNodeKey;
}

function syncUiEffects(effects: ConsoleUiEffect[], result: CommandResult): void {
  const deleted = new Set(result.deletedKeys || []);
  effects.forEach((effect, index) => {
    if (result.renamedKey && effect.nodeKey === result.renamedKey.from) {
      effects[index] = { ...effect, nodeKey: result.renamedKey.to };
      return;
    }
    if (deleted.has(effect.nodeKey)) {
      effects[index] = { ...effect, nodeKey: "" };
    }
  });
}

export function buildConsoleMutationLabel(mutationCount: number, fallbackMessage: string | undefined): string {
  if (mutationCount <= 1) {
    return fallbackMessage || "Executed 1 console command.";
  }
  return `Executed ${mutationCount} console commands.`;
}

export function collectBatchEffects(results: CommandResult[]): { renamedKeys: Array<{ from: NodeKey; to: NodeKey }>; deletedKeys: NodeKey[] } {
  const renamedKeys: Array<{ from: NodeKey; to: NodeKey }> = [];
  const deletedKeys = new Set<NodeKey>();

  results.forEach((result) => {
    if (result.renamedKey) {
      renamedKeys.push(result.renamedKey);
    }
    result.deletedKeys?.forEach((key) => deletedKeys.add(key));
  });

  return { renamedKeys, deletedKeys: Array.from(deletedKeys) };
}
