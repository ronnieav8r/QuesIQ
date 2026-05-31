export default function StudyDeckLoading() {
  return (
    <div className="screen study-dashboard-screen">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">QuesIQ Study</p>
          <h1>Deck</h1>
          <p>Loading deck details...</p>
        </div>
      </div>
      <section className="panel study-empty-panel">
        <div className="spinner" />
        <h2>Opening this Study deck</h2>
        <p>Cards, progress, and trust labels will appear here in a moment.</p>
      </section>
    </div>
  );
}
