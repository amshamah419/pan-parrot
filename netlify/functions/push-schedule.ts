/** The 15-minute push job is off. It woke Netlify Database often enough to stop autosuspend. */
export default function handler() {
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
