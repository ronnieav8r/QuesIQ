export default function StudyLibraryLoading() {
  return (
    <div className="screen study-dashboard-screen">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">QuesIQ Study</p>
          <h1>Library</h1>
          <p>Loading Study library filters and decks...</p>
        </div>
      </div>
      <section className="panel study-empty-panel">
        <div className="spinner" />
        <h2>Checking the library</h2>
        <p>Public, Mine, Official, and Verified deck labels will load together.</p>
      </section>
    </div>
  );
}
