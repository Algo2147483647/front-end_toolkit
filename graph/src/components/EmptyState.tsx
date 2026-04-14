interface EmptyStateProps {
  message: string;
  hidden: boolean;
}

export default function EmptyState({ message, hidden }: EmptyStateProps) {
  return (
    <section id="empty-state" className={`empty-state${hidden ? " is-hidden" : ""}`}>
      <p className="empty-state__eyebrow">Visual dependency map</p>
      <h2>Inspect your graph with a clearer visual hierarchy</h2>
      <p id="empty-state-message" className="empty-state__message">
        {message}
      </p>
    </section>
  );
}
