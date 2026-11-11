import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/Logo";
import {
  Globe,
  Zap,
  Search,
  RotateCcw,
  Settings,
  Shield,
  Check,
  LogIn,
} from "lucide-react";

export default function Index() {
  const features = [
    {
      icon: Globe,
      title: "Integration catalog",
      description:
        "Start from a vendor preset, one JSON sample, an OpenAPI document, or a SOAP/XML payload.",
    },
    {
      icon: Zap,
      title: "Chaos and load tests",
      description:
        "Grow the catalog to thousands of records and page through them. A single response still stops at 500.",
    },
    {
      icon: Shield,
      title: "Dummy auth",
      description:
        "Require the same API key, bearer token, OAuth, or SOAP handshake the integration already sends. Use dummy values.",
    },
    {
      icon: RotateCcw,
      title: "Flow and scenarios",
      description:
        "Save records, return a different body on each call, or reveal one fetch window per poll.",
    },
    {
      icon: Settings,
      title: "Outbound push",
      description:
        "Send generated events to a public https listener when you click Push now.",
    },
    {
      icon: Search,
      title: "Content-pack fixtures",
      description:
        "Export test_data JSON, turn captured calls into fixtures, and diff a real vendor body against the preset.",
    },
  ];

  const useCases = [
    "Prisma Access API Testing",
    "Cortex Webhook Debugging",
    "Panorama Integration Testing",
    "XSOAR Playbook Development",
    "GlobalProtect API Mocking",
    "Cloud Security Development",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex min-h-16 flex-wrap items-center justify-between gap-3 py-2">
          <Logo />
          <nav className="flex flex-wrap items-center gap-3">
            <Link
              to="/docs"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Docs
            </Link>
            <Button asChild>
              <Link to="/login">
                <LogIn className="mr-2 h-4 w-4" />
                Sign in
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="container py-12 md:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <Badge variant="secondary" className="mb-4">
              <Zap className="mr-1 h-3 w-3" />
              Unofficial personal tool
            </Badge>
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl">
              <span className="text-primary">PAN Parrot</span>
              <br />
              Mock the APIs your content pack calls
            </h1>
            <p className="mb-6 text-lg text-muted-foreground">
              A catch URL for XSOAR and XSIAM content developers with a verified
              @paloaltonetworks.com email. Not a Palo Alto Networks service.
            </p>
            <ol className="mx-auto mb-8 max-w-xl space-y-2 text-left text-sm text-muted-foreground">
              <li>1. Sign in, then mock an integration or paste one JSON sample.</li>
              <li>2. Copy the catch URL into the XSOAR server field.</li>
              <li>3. The first call shows up in the log. Chaos, auth, flow, push, and fixtures are on that mock.</li>
            </ol>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" asChild className="text-base">
                <Link to="/login">
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign in
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="text-base">
                <Link to="/docs">Read the docs</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="container px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                What you can exercise before the vendor is ready
              </h2>
              <p className="text-lg text-muted-foreground">
                The same catch URL can page a large catalog, fail on purpose, demand a dummy token, and export the fixture your unit test loads.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className="transition-all hover:shadow-lg hover:shadow-primary/5"
                >
                  <CardHeader>
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="container px-4 py-16">
          <div className="mx-auto max-w-4xl">
            <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold">
                  Built for content packs
                </CardTitle>
                <CardDescription className="text-base">
                  Point a pack at the catch URL while you write the integration, the playbook, or the test.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {useCases.map((useCase, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                      <span className="text-sm font-medium">{useCase}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container px-4 py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight">
              Ready to mock a vendor? 🦜
            </h2>
            <p className="mb-8 text-lg text-muted-foreground">
              Sign in with a one-time code sent to your @paloaltonetworks.com
              email. There is no password.
            </p>
            <Button size="lg" asChild className="text-base">
              <Link to="/login">
                <LogIn className="mr-2 h-4 w-4" />
                Sign in
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t bg-muted/30">
        <div className="container px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Logo size="sm" />
            <p className="text-sm text-muted-foreground">
              Unofficial personal tool. Not a Palo Alto Networks service.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
