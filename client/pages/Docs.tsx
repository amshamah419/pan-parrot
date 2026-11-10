import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { ArrowLeft, Book, FileText, Zap } from "lucide-react";

export default function Docs() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex min-h-16 flex-wrap items-center justify-between gap-3 py-2">
          <Logo />
          <nav className="flex flex-wrap items-center gap-3">
            <Link
              to="/"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Home
            </Link>
            <Link
              to="/dashboard"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Mocks
            </Link>
            <Button asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <Button variant="outline" asChild className="mb-4">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
            <h1 className="text-4xl font-bold tracking-tight">Documentation</h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Unofficial personal webhook catcher for a @paloaltonetworks.com
              address. Do not send secrets, credentials, customer data, or
              production traffic.
            </p>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>First minute</CardTitle>
              <CardDescription>
                Sign in with the 8-digit code from your email. There is no password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Choose Mock an integration and start with Akamai WAF SIEM, or paste one JSON sample.</li>
                <li>Copy the catch URL. It looks like https://&lt;site&gt;/catch/&lt;path&gt;.</li>
                <li>Paste it into the XSOAR server field and send one call. The dashboard log shows what arrived.</li>
              </ol>
              <p className="mt-4 text-sm text-muted-foreground">
                A guessed-shape preset is a starting point. The badge says when a preset was checked against a public vendor reference. On the mock page, the buttons under the catch URL jump to chaos, auth, flow, and push. Presets and integration YAML imports also list the XSOAR instance fields, with copy buttons and an instance JSON download. A normal page stops at 500 records and 2 MB. Set Virtual records into the thousands when you want a load test, then page through. The catch URL is public; sharing only changes who can edit the studio. The same notes are in docs/USER_GUIDE.md.
              </p>
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="mr-2 h-5 w-5 text-primary" />
                Personal tokens and the CLI
              </CardTitle>
              <CardDescription>
                Create a token on the dashboard. It is shown once. The CLI stores it outside the repo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <pre className="overflow-auto rounded bg-muted p-3 text-xs text-foreground">{`npm run parrot -- login --url https://your-site --token pp_...
npm run parrot -- create --name "Hello" --yaml HelloWorld.yml
npm run parrot -- export <endpoint-id> --out ./tests`}</pre>
              <p>
                <code>create --preset &lt;id&gt;</code> uses a catalog preset. <code>mocks</code> lists what you already have.
                Export writes <code>test_pan_parrot.py</code> and <code>test_data.json</code> for <code>requests_mock</code>. The tests do not call the live catch URL, and dummy mock credentials are not included.
              </p>
              <p>
                A mock can require AWS SigV4, HTTP Digest, an HS256 JWT, a SOAP UsernameToken, or an NTLM handshake. SigV4 stays off until you check the box. A bad signature is 403 SignatureDoesNotMatch XML. Use dummy secrets only. Mutual TLS is not supported: a Netlify function cannot ask the client for a certificate. A normal page stays at 2 MB. Streamed NDJSON and file downloads stop at 6 MB. Netlify allows 6 MB buffered and 20 MB streamed, and the function stops after 60 seconds.
              </p>
              <p>
                A normal page stays at 2 MB and 500 records. Streamed NDJSON and CSV, zip, or gzip downloads can grow to 6 MB. Netlify allows 6 MB buffered and 20 MB streamed, and the function stops after 60 seconds, so a mock does not try to fill 20 MB. One byte Range is supported on a file download.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Book className="mr-2 h-5 w-5 text-primary" />
                  Quick Start
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-muted-foreground">
                  Jump right in and start using Parrot to inspect your HTTP
                  requests.
                </p>
                <Button asChild>
                  <Link to="/dashboard">Go to Dashboard</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5 text-primary" />
                  API Reference
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-muted-foreground">
                  Send <code>Authorization: Bearer pp_...</code> to <code>GET/POST /api/endpoints</code>, <code>POST /api/specs/import</code>, and <code>GET /api/endpoints/:id/export</code>. Creating a token uses the browser session, not the token itself. Full notes are in docs/API.md.
                </p>
                <Button variant="outline" asChild>
                  <Link to="/dashboard">Create a token</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
