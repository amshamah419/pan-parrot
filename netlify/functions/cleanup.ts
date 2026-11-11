/** The daily cleanup job is off. It is not needed to keep the app correct, and it woke the database. */
export default function handler() {
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
