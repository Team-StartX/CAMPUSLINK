import Link from 'next/link';
export default function NotFound() {
  return (
    <main style={{ padding: 80 }}>
      <h1>A new direction is waiting.</h1>
      <p>This page could not be found.</p>
      <Link href="/">Back to CampusLink</Link>
    </main>
  );
}
