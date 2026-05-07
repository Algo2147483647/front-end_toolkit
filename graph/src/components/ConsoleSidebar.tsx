import { useEffect, useRef } from "react";
import type { GraphMode, NodeKey } from "../graph/types";

interface ConsoleSuggestion {
  label: string;
  insertText: string;
}

interface ConsoleSidebarProps {
  mode: GraphMode;
  hasGraph: boolean;
  entries: Array<{ id: number; tone: "input" | "success" | "error" | "info"; text: string }>;
  inputValue: string;
  contextNodeKey: NodeKey | null;
  suggestions: ConsoleSuggestion[];
  activeSuggestionIndex: number;
  onInputChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onSuggestionSelect: (suggestion: ConsoleSuggestion) => void;
}

export default function ConsoleSidebar({
  mode,
  hasGraph,
  entries,
  inputValue,
  contextNodeKey,
  suggestions,
  activeSuggestionIndex,
  onInputChange,
  onKeyDown,
  onSuggestionSelect,
}: ConsoleSidebarProps) {
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const output = outputRef.current;
    if (!output) {
      return;
    }
    output.scrollTop = output.scrollHeight;
  }, [entries]);

  return (
    <section className="console-sidebar console-sidebar--terminal" aria-label="Graph console">
      <div ref={outputRef} className="console-terminal__output">
        {entries.map((entry) => (
          <div key={entry.id} className={`console-terminal__line console-terminal__line--${entry.tone}`}>
            <span>{entry.text}</span>
          </div>
        ))}
        {!hasGraph ? <div className="console-terminal__line console-terminal__line--info">Load or initialize a graph to enable mutations.</div> : null}
        {mode !== "edit" ? <div className="console-terminal__line console-terminal__line--info">Switch to edit mode to run graph mutations.</div> : null}
      </div>

      <div className="console-terminal__input-wrap">
        <label className="console-terminal__prompt" htmlFor="graph-console-input">
          {contextNodeKey ? `${contextNodeKey}>` : "graph>"}
        </label>
        <input
          id="graph-console-input"
          className="console-terminal__input"
          type="text"
          spellCheck={false}
          autoComplete="off"
          value={inputValue}
          disabled={!hasGraph || mode !== "edit"}
          placeholder={hasGraph && mode === "edit" ? "type a command" : "console unavailable"}
          onChange={(event) => onInputChange(event.currentTarget.value)}
          onKeyDown={onKeyDown}
        />
      </div>

      {suggestions.length > 0 ? (
        <div className="console-terminal__suggestions" role="listbox" aria-label="Command suggestions">
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.label}-${index}`}
              type="button"
              className={`console-terminal__suggestion${index === activeSuggestionIndex ? " is-active" : ""}`}
              onMouseDown={(event) => {
                event.preventDefault();
                onSuggestionSelect(suggestion);
              }}
            >
              <span>{suggestion.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
