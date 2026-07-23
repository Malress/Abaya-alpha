import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container section center" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
      <div>
        <p className="eyebrow" style={{ marginBottom: 12 }}>404</p>
        <h1 className="section-title" style={{ marginBottom: 16 }}>Page not found</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          The page you are looking for doesn&apos;t exist or has moved.
        </p>
        <Link href="/" className="btn btn-outline">Return home</Link>
      </div>
    </div>
  );
}
