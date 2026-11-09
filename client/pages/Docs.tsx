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
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <nav className="flex items-center space-x-6">
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
              Dashboard
            </Link>
            <Button asChild>
              <Link to="/login">Login</Link>
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
              PAN Parrot is an unofficial personal webhook catcher. It is not
              a Palo Alto Networks product. Sign in with a one-time code sent
              to a verified @paloaltonetworks.com address, create an endpoint,
              and point a client at the /catch URL. The dashboard polls for
              new requests. Captured bodies are shown as text. Requests older
              than the retention window, and requests past the per-endpoint
              cap, are deleted automatically. Do not send secrets or customer
              data.
            </p>
          </div>

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
