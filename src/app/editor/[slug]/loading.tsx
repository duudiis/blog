export default function LoadingEditor() {
  return (
    <div className="container layout">
      <aside className="sidebar">
        <ul className="post-list">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={`sk-${i}`} className="post-item" aria-busy="true">
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-meta" />
            </li>
          ))}
        </ul>
      </aside>
      <section className="content">
        <article className="post fade-in" aria-busy="true">
          <div className="spinner" />
        </article>
      </section>
    </div>
  );
}


