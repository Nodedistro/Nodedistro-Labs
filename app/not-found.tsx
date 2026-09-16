import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty" style={{ height: "100vh" }}>
      <h1>This connection goes nowhere.</h1>
      <p>The page or project could not be found.</p>
      <Link className="btn btn-primary" href="/dashboard">
        Return to workspace
      </Link>
    </div>
  );
}
