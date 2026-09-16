export default function Loading() {
  return (
    <div style={{ padding: 40 }}>
      <div
        className="skeleton"
        style={{ height: 38, width: 280, marginBottom: 25 }}
      />
      <div className="skeleton" style={{ height: 280 }} />
    </div>
  );
}
