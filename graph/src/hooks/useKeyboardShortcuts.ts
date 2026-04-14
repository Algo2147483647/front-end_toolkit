import { useEffect } from "react";

interface KeyboardShortcutHandlers {
  onEscape: () => void;
}

export function useKeyboardShortcuts({ onEscape }: KeyboardShortcutHandlers): void {
  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onEscape();
      }
    }

    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [onEscape]);
}
