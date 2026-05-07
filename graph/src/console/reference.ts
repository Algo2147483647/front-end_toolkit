export interface ConsoleCommandReference {
  label: string;
  insertText: string;
  help: string;
}

export const CONSOLE_COMMAND_REFERENCE: ConsoleCommandReference[] = [
  { label: "help", insertText: "help", help: "Show this command reference." },
  { label: "use <node>", insertText: "use ", help: "Set the current context node. Use . to refer to the current context in later commands." },
  { label: "show <node>", insertText: "show ", help: "Open the node viewer for a node." },
  { label: "json <node>", insertText: "json ", help: "Open the raw JSON editor for a node." },
  { label: "mv <old-key> <new-key>", insertText: "mv ", help: "Rename a node key." },
  { label: "rm <node>", insertText: "rm ", help: "Delete a single node." },
  { label: "rm -r <node>", insertText: "rm -r ", help: "Delete a node and its descendants." },
  { label: "add <new-key>", insertText: "add ", help: "Add a new node without linking it." },
  { label: "add <new-key> -p <parent>", insertText: "add ", help: "Add a new node and link it as a child of the parent." },
  { label: "cp <source> <new-key>", insertText: "cp ", help: "Copy a node into a new node key." },
  { label: "cp <source> <new-key> -p <parent>", insertText: "cp ", help: "Copy a node and link the copy to a parent." },
  { label: "parents <node> = A,B", insertText: "parents ", help: "Replace the parent relation set for a node." },
  { label: "children <node> = A,B", insertText: "children ", help: "Replace the child relation set for a node." },
  { label: "set <node> <field> \"value\"", insertText: "set ", help: "Set a non-relation field value as text." },
  { label: "clear", insertText: "clear", help: "Clear the console output." },
];

export function buildConsoleHelpText(): string {
  return [
    "Available commands:",
    ...CONSOLE_COMMAND_REFERENCE.map((command) => `- ${command.label}: ${command.help}`),
  ].join("\n");
}
