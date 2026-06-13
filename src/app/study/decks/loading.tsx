export default function StudyDecksLoading() {
  return (
    <div className="screen study-dashboard-screen">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">QuesIQ Study</p>
          <h1>Decks</h1>
          <p>Loading your Study decks...</p>
        </div>
      </div>
      <section className="panel study-empty-panel">
        <div className="spinner" />
        <h2>Getting your deck library ready</h2>
        <p>Folders, review cards, and trust labels will appear here in a moment.</p>
      </section>
    </div>
  );
}
