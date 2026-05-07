# Graph Console Instruction Set Manual

## 1. Scope

This document defines the **Graph Console DSL** for the `Graph` project.

The DSL is a compact, line-oriented instruction set for editing graph JSON in **Edit Mode** through a left-side console panel. It is intended to feel closer to a shell, assembler, or low-level command monitor than to a general-purpose scripting language.

The DSL is not a second editing engine. It is a textual front end for the existing graph mutation core.

## 2. Design Goals

| Goal | Description |
| --- | --- |
| Short | Commands should be brief and easy to type repeatedly. |
| Explicit | Each instruction should map to one clear editing action. |
| Transactional | A batch of lines executes as one logical edit transaction. |
| Equivalent | Console capabilities should match the right-click editing capabilities. |
| Deterministic | The same input should always produce the same DAG result. |
| Safe | Parse errors and graph errors should stop execution early and report the exact failing line. |

## 3. Architectural Position

### 3.1 Execution Pipeline

```text
Console Source Text
-> Line Scanner
-> Tokenizer
-> Parser
-> Console Instructions
-> GraphCommand sequence
-> applyGraphCommand(...)
-> DAG result
-> reducer commit
```

### 3.2 Layer Responsibilities

| Layer | Responsibility |
| --- | --- |
| Console UI | Accept source text, show help, show output, manage width and visibility. |
| Parser | Convert text lines into typed console instructions. |
| Executor | Resolve context, execute instructions in order, stop on failure. |
| Graph Command Core | Perform the actual graph mutation rules. |
| Reducer / History | Commit a successful batch as one undoable transaction. |

### 3.3 Non-Goals

| Out of Scope for V1 | Reason |
| --- | --- |
| Pipes | Not needed for initial editing productivity. |
| Variables | Adds state complexity without core value. |
| Loops / conditions | Too large for a first instruction set. |
| Full graph replacement | Bypasses the existing mutation model. |
| Embedded multi-line JSON blocks | Makes parsing and line diagnostics harder. |
| Wildcard selection | Risky for early destructive operations. |

## 4. Console Operating Model

### 4.1 Availability

| Item | Rule |
| --- | --- |
| Visibility | Controlled by a settings-panel toggle. |
| Mode | Available only in `edit` mode. |
| Layout | Rendered as a resizable left sidebar. |
| Persistence | Sidebar visibility and width should be stored in page preferences. |

### 4.2 Execution Model

| Rule | Behavior |
| --- | --- |
| Input unit | One line is one instruction. |
| Empty line | Ignored. |
| Comment line | Ignored when the first non-space character is `#`. |
| Batch order | Top to bottom. |
| Failure rule | Stop at the first error. |
| Commit rule | Commit only if the full batch succeeds. |
| Undo unit | One executed batch becomes one undo record. |

### 4.3 Context Register

The console maintains one implicit **current-node context register**.

| Mechanism | Meaning |
| --- | --- |
| `use A` | Load node `A` into the current context register. |
| `.` | Operand alias for the current context node. |
| Empty context | Any use of `.` without an active context is an execution error. |

## 5. Lexical Conventions

### 5.1 Line Form

| Form | Meaning |
| --- | --- |
| `instruction operands...` | Executable line |
| `` | Empty line |
| `# comment` | Comment line |

### 5.2 Node Keys

| Form | Example | Notes |
| --- | --- | --- |
| Bare identifier | `Tree` | Preferred when no spaces are present. |
| Quoted key | `"Binary Tree"` | Required when spaces are present. |
| Context alias | `.` | Refers to the current context node. |

### 5.3 String Literals

| Form | Example | Use |
| --- | --- | --- |
| Double-quoted string | `"Self-balanced BST"` | Field values and quoted operands |

### 5.4 Lists

| Form | Example | Meaning |
| --- | --- | --- |
| Comma-separated list | `A,B,C` | Ordered operand list |
| Empty list | nothing after `=` | Clear the target relation set |

## 6. Instruction Summary

### 6.1 Primary Instruction Table

| Mnemonic | Category | Effect |
| --- | --- | --- |
| `help` | Reference | Show the available command reference |
| `show` | UI | Open node detail view |
| `use` | Context | Set current context node |
| `mv` | Mutation | Rename a node key |
| `rm` | Mutation | Delete a node |
| `add` | Mutation | Create a node |
| `cp` | Mutation | Copy a node |
| `parents` | Mutation | Replace parent set |
| `children` | Mutation | Replace child set |
| `set` | Mutation | Replace one node field |
| `json` | UI | Open raw node JSON editor |

### 6.2 Modifier Table

| Modifier | Applies To | Meaning |
| --- | --- | --- |
| `-r` | `rm` | Recursive subtree delete |
| `-p <node>` | `add`, `cp` | Attach created/copied node under parent |

### 6.3 Built-In Console Commands

| Command | Layer | Effect |
| --- | --- | --- |
| `help` | DSL instruction | Print the available command reference in the console output |
| `clear` | Console UI | Clear the console output |
| `cls` | Console UI | Alias for `clear` |

## 7. Instruction Reference

---

## 7.1 `help`

### Synopsis

```sh
help
```

### Description

Prints the available command reference directly in the console output.

### Behavioral Notes

| Item | Behavior |
| --- | --- |
| Graph mutation | None |
| Graph required | No |
| Undo history | Not added as a graph edit |
| Typical use | Discover or confirm the currently supported commands |

### Examples

```sh
help
```

---

## 7.2 `show`

### Synopsis

```sh
show <node>
show .
```

### Description

Opens the node detail view for the target node.

### Operand Table

| Operand | Type | Required | Description |
| --- | --- | --- | --- |
| `<node>` | Node key | Yes | Target node key or `.` |

### Behavioral Notes

| Item | Behavior |
| --- | --- |
| Graph mutation | None |
| Undo history | Not added as a graph edit |
| Right-click equivalent | `View Node` |

### Examples

```sh
show Tree
use Tree
show .
```

---

## 7.3 `use`

### Synopsis

```sh
use <node>
```

### Description

Loads the target node into the current context register.

### Operand Table

| Operand | Type | Required | Description |
| --- | --- | --- | --- |
| `<node>` | Node key | Yes | Node to become the current context |

### Behavioral Notes

| Item | Behavior |
| --- | --- |
| Graph mutation | None |
| Context register | Updated |
| Undo history | Not added as a graph edit |

### Examples

```sh
use Tree
use "Binary Tree"
```

---

## 7.4 `mv`

### Synopsis

```sh
mv <old-key> <new-key>
```

### Description

Renames a node key and remaps references to that node.

### Operand Table

| Operand | Type | Required | Description |
| --- | --- | --- | --- |
| `<old-key>` | Node key | Yes | Existing key |
| `<new-key>` | Node key | Yes | New unique key |

### Internal Mapping

| DSL | Internal Command |
| --- | --- |
| `mv A B` | `{ type: "renameNode", oldKey: "A", newKey: "B" }` |

### Exceptions

| Condition | Error |
| --- | --- |
| Old key does not exist | Execution error |
| New key already exists | Execution error |
| New key is empty | Execution error |

### Examples

```sh
mv Tree RootTree
mv "Binary Tree" "Binary Search Tree"
```

---

## 7.5 `rm`

### Synopsis

```sh
rm <node>
rm -r <node>
rm .
rm -r .
```

### Description

Deletes either a single node or a full subtree.

### Operand / Modifier Table

| Operand / Modifier | Required | Description |
| --- | --- | --- |
| `<node>` | Yes | Target node key or `.` |
| `-r` | No | Delete subtree rooted at target |

### Internal Mapping

| Form | Internal Command |
| --- | --- |
| `rm A` | `{ type: "deleteNode", key: "A" }` |
| `rm -r A` | `{ type: "deleteSubtree", rootKey: "A" }` |

### Exceptions

| Condition | Error |
| --- | --- |
| Node does not exist | Execution error |
| Delete would remove all remaining nodes | Execution error |

### Examples

```sh
rm DraftNode
rm -r Tree
```

---

## 7.6 `add`

### Synopsis

```sh
add <new-key>
add <new-key> -p <parent>
```

### Description

Creates a new node. If `-p` is present, the new node is attached as a child of the parent node.

### Operand / Modifier Table

| Operand / Modifier | Required | Description |
| --- | --- | --- |
| `<new-key>` | Yes | New unique node key |
| `-p <parent>` | No | Parent node key or `.` |

### Internal Mapping

| Form | Internal Command |
| --- | --- |
| `add B` | `{ type: "addNode", key: "B" }` |
| `add B -p A` | `{ type: "addNode", key: "B", parentKey: "A" }` |

### Exceptions

| Condition | Error |
| --- | --- |
| New key already exists | Execution error |
| New key is empty | Execution error |

### Examples

```sh
add AVL
add AVL -p Tree
use Tree
add RedBlack -p .
```

---

## 7.7 `cp`

### Synopsis

```sh
cp <source> <new-key>
cp <source> <new-key> -p <parent>
```

### Description

Copies a node into a new key. The copied node does not inherit source parent/child relations unless a new parent is explicitly specified with `-p`.

### Operand / Modifier Table

| Operand / Modifier | Required | Description |
| --- | --- | --- |
| `<source>` | Yes | Source node key |
| `<new-key>` | Yes | New unique node key |
| `-p <parent>` | No | Parent node key or `.` |

### Internal Mapping

| Form | Internal Command |
| --- | --- |
| `cp A B` | `{ type: "copyNode", sourceKey: "A", key: "B" }` |
| `cp A B -p C` | `{ type: "copyNode", sourceKey: "A", key: "B", parentKey: "C" }` |

### Exceptions

| Condition | Error |
| --- | --- |
| Source does not exist | Execution error |
| New key already exists | Execution error |

### Examples

```sh
cp Tree Tree_Copy
cp AVL AVL_Copy -p Tree
cp . Snapshot -p .
```

---

## 7.8 `parents`

### Synopsis

```sh
parents <node> = <list>
parents <node> =
```

### Description

Replaces the full parent set of the target node.

### Operand Table

| Operand | Required | Description |
| --- | --- | --- |
| `<node>` | Yes | Target node key or `.` |
| `<list>` | No | Comma-separated parent keys |

### Internal Mapping

| Form | Internal Command |
| --- | --- |
| `parents A = B,C,D` | `{ type: "setParents", key: "A", parents: ["B", "C", "D"] }` |
| `parents A =` | `{ type: "setParents", key: "A", parents: [] }` |

### Behavioral Notes

| Item | Behavior |
| --- | --- |
| Update mode | Replace, not append |
| Empty assignment | Clears all parents |
| Relation sync | Reverse child links are repaired by core graph logic |

### Examples

```sh
parents AVL = Tree
parents . = Root,Index
parents Draft =
```

---

## 7.9 `children`

### Synopsis

```sh
children <node> = <list>
children <node> =
```

### Description

Replaces the full child set of the target node.

### Operand Table

| Operand | Required | Description |
| --- | --- | --- |
| `<node>` | Yes | Target node key or `.` |
| `<list>` | No | Comma-separated child keys |

### Internal Mapping

| Form | Internal Command |
| --- | --- |
| `children A = B,C,D` | `{ type: "setChildren", key: "A", children: ["B", "C", "D"] }` |
| `children A =` | `{ type: "setChildren", key: "A", children: [] }` |

### Behavioral Notes

| Item | Behavior |
| --- | --- |
| Update mode | Replace, not append |
| Empty assignment | Clears all children |
| Relation sync | Reverse parent links are repaired by core graph logic |

### Examples

```sh
children Tree = AVL,RedBlack
children . = Left,Right
children Leaf =
```

---

## 7.10 `set`

### Synopsis

```sh
set <node> <field> <value>
```

### Description

Replaces one field on the target node. This is a compact single-field entry point for `updateNodeFields`.

### Operand Table

| Operand | Type | Required | Description |
| --- | --- | --- | --- |
| `<node>` | Node key | Yes | Target node key or `.` |
| `<field>` | Field name | Yes | Node field to replace |
| `<value>` | String literal initially | Yes | New field value |

### Internal Execution Strategy

| Step | Description |
| --- | --- |
| 1 | Read current node fields |
| 2 | Replace exactly one field |
| 3 | Submit full field object through `updateNodeFields` |

### Recommended V1 Constraints

| Constraint | Reason |
| --- | --- |
| Support string value first | Keeps parsing simple |
| Reserve structured JSON field input for later | Avoids grammar complexity |

### Examples

```sh
set AVL define "Self-balanced binary search tree"
set Tree label "Tree"
set . type "concept"
```

---

## 7.11 `json`

### Synopsis

```sh
json <node>
json .
```

### Description

Opens the raw JSON editor for the target node.

### Operand Table

| Operand | Type | Required | Description |
| --- | --- | --- | --- |
| `<node>` | Node key | Yes | Target node key or `.` |

### Behavioral Notes

| Item | Behavior |
| --- | --- |
| Graph mutation | None by itself |
| UI effect | Opens existing node raw JSON editor |
| Purpose | Fast bridge from console to low-level node JSON editing |

### Examples

```sh
json AVL
use Tree
json .
```

## 8. Batch Semantics

### 8.1 Batch Definition

A batch is the full multi-line source executed by one explicit console run action.

### 8.2 Batch Rules

| Rule | Behavior |
| --- | --- |
| Execution order | Sequential |
| Intermediate state | Later instructions see earlier successful changes |
| Failure handling | Abort on first failing line |
| Commit timing | After all lines succeed |
| Undo record | Single transaction |

### 8.3 Example Batch

```sh
use Tree
add AVL -p .
add RedBlack -p .
set AVL define "Self-balanced BST"
set RedBlack define "Balanced BST with color constraints"
children . = AVL,RedBlack
```

## 9. Diagnostics and Error Model

### 9.1 Error Classes

| Class | Description |
| --- | --- |
| Lexical error | Invalid quoting, token boundary, or illegal character pattern |
| Parse error | Unknown mnemonic or malformed operand sequence |
| Context error | Use of `.` without an active current node |
| Execution error | Graph core rejects the requested operation |

### 9.2 Diagnostic Requirements

| Requirement | Description |
| --- | --- |
| Line-local | Every error should identify the failing source line |
| Human-readable | Messages should read like operator diagnostics |
| Early stop | Only the first failing line is reported per run |
| Source-preserving | The original input remains editable after failure |

### 9.3 Recommended Message Format

| Template | Example |
| --- | --- |
| `Line N: Unknown instruction "<name>".` | `Line 3: Unknown instruction "mov".` |
| `Line N: Missing operand "<name>".` | `Line 5: Missing operand "<new-key>".` |
| `Line N: Current context is empty.` | `Line 2: Current context is empty. Use 'use <node>' first.` |
| `Line N: Node "<key>" already exists.` | `Line 4: Node "AVL" already exists.` |

## 10. Equivalence to Context Menu Operations

| Context Menu Action | Console Form |
| --- | --- |
| View Node | `show <node>` |
| Rename Node Key | `mv <old> <new>` |
| Delete Node | `rm <node>` |
| Delete Subtree | `rm -r <node>` |
| Edit Parents | `parents <node> = ...` |
| Edit Children | `children <node> = ...` |
| Add Node | `add <new> [-p <parent>]` |
| Copy Node | `cp <source> <new> [-p <parent>]` |
| Open Raw Node JSON | `json <node>` |

## 11. Recommended Parser Strategy

### 11.1 Parsing Stages

| Stage | Purpose |
| --- | --- |
| Line split | Preserve original line numbers |
| Comment / empty filter | Ignore non-executable lines |
| Tokenization | Produce operand tokens with quoting support |
| Instruction parse | Match mnemonic-specific grammar |
| Lowering | Convert parsed form into executor input |

### 11.2 Suggested Internal Types

```ts
type ConsoleInstruction =
  | { type: "help"; line: number }
  | { type: "show"; key: string; line: number }
  | { type: "use"; key: string; line: number }
  | { type: "rename"; oldKey: string; newKey: string; line: number }
  | { type: "delete"; key: string; recursive: boolean; line: number }
  | { type: "add"; key: string; parentKey?: string; line: number }
  | { type: "copy"; sourceKey: string; key: string; parentKey?: string; line: number }
  | { type: "setParents"; key: string; keys: string[]; line: number }
  | { type: "setChildren"; key: string; keys: string[]; line: number }
  | { type: "setField"; key: string; field: string; value: string; line: number }
  | { type: "json"; key: string; line: number };
```

## 12. Recommended Executor Strategy

### 12.1 Executor Responsibilities

| Responsibility | Description |
| --- | --- |
| Context resolution | Replace `.` with the current node |
| Instruction dispatch | Convert console instructions into UI actions or graph commands |
| Transaction simulation | Apply changes in sequence against a working DAG |
| Error trapping | Stop and report the first failure |
| Commit handoff | Emit one reducer commit for a successful mutation batch |

### 12.2 Mixed UI / Mutation Behavior

| Instruction Class | Handling |
| --- | --- |
| UI-only instructions | Execute as immediate UI operations |
| Mutation instructions | Accumulate into transactional graph edits |

Recommended V1 rule:

- allow UI-only instructions such as `show` and `json`
- treat mutation instructions as the batch that participates in undo history
- if needed, disallow mixing UI-only instructions after mutation lines in the same run for simpler semantics

## 13. Worked Examples

### 13.1 Create a Small Branch

```sh
use Tree
add AVL -p .
add RedBlack -p .
children . = AVL,RedBlack
```

### 13.2 Rename and Re-Describe a Node

```sh
mv Graph DAG
set DAG define "A directed acyclic graph"
```

### 13.3 Clear Relations

```sh
parents Draft =
children Draft =
```

### 13.4 Open a Node for Raw JSON Work

```sh
use AVL
json .
```

## 14. Minimum Viable Instruction Set

### 14.1 Required V1 Instructions

| Priority | Instruction |
| --- | --- |
| P0 | `use` |
| P0 | `help` |
| P0 | `show` |
| P0 | `mv` |
| P0 | `rm` |
| P0 | `rm -r` |
| P0 | `add` |
| P0 | `cp` |
| P0 | `parents` |
| P0 | `children` |
| P0 | `set` |
| P0 | `json` |

### 14.2 Optional V1.1 Extensions

| Candidate | Purpose |
| --- | --- |
| `focus <node>` | Move graph viewport focus |
| `ls <node>` | Show relation summary |
| `append-child <node> <child>` | Incremental relation edit |
| `append-parent <node> <parent>` | Incremental relation edit |
| `unset <node> <field>` | Field removal |
| History recall | Operator productivity |
| Autocomplete | Faster command entry |

## 15. Summary

The Graph Console DSL should behave like a compact graph-edit instruction set:

- brief like shell commands
- explicit like assembly mnemonics
- transactional like an editor command buffer
- backed by the existing graph mutation core
- self-describing through an in-console `help` command

That combination gives the console the speed of typed operations without sacrificing the safety and consistency of the current JSON editing model.
