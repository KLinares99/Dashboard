import Link from "next/link";

export default function NotFound() {
  return (
    <main className="login-form" style={{ minHeight: "100%" }}>
      <div className="stack" style={{ gap: 12, maxWidth: 420 }}>
        <div className="eyebrow">Not found</div>
        <h2 style={{ fontFamily: "var(--display)", fontWeight: 500, fontSize: 34, margin: 0, color: "var(--ink)" }}>That page isn&apos;t here.</h2>
        <p className="muted" style={{ margin: 0 }}>It may have been archived, or you may not have access to it.</p>
        <Link className="btn" href="/">Go to my dashboard</Link>
      </div>
    </main>
  );
}
