import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/Logo";
import {
  Monitor,
  Globe,
  Zap,
  Search,
  RotateCcw,
  Settings,
  Shield,
  Clock,
  ArrowRight,
  Check,
  LogIn
} from "lucide-react";

export default function Index() {
  const features = [
    {
      icon: Globe,
      title: "Custom Endpoints",
      description: "Create unique endpoint paths with UUID-based or custom naming"
    },
    {
      icon: Monitor,
      title: "Real-Time Console",
      description: "Watch HTTP requests in real-time with WebSocket streaming"
    },
    {
      icon: Search,
      title: "Advanced Filtering",
      description: "Filter by method, endpoint, status, or keyword in body/headers"
    },
    {
      icon: RotateCcw,
      title: "Request Replay",
      description: "Inspect and replay requests with modifications"
    },
    {
      icon: Settings,
      title: "Mock Responses",
      description: "Configure static or conditional mock responses per endpoint"
    },
    {
      icon: Shield,
      title: "Request Persistence",
      description: "Store and access your request history across sessions"
    }
  ];

  const useCases = [
    "API Development & Testing",
    "Webhook Debugging",
    "Third-party Integration Testing",
    "Mock Server Setup",
    "Request Analysis",
    "Development Workflow"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <nav className="flex items-center space-x-6">
            <Link to="/docs" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Docs
            </Link>
            <Button asChild>
              <Link to="/login">
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="container px-4 py-24 md:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <Badge variant="secondary" className="mb-4">
              <Zap className="mr-1 h-3 w-3" />
              Internal PAN Development Tool
            </Badge>
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl md:text-7xl">
              <span className="text-primary">PAN Parrot</span>
              <br />
              HTTP Debugging Made Fun
            </h1>
            <p className="mb-8 text-lg text-muted-foreground sm:text-xl">
              Your friendly internal HTTP inspection companion. Create endpoints, catch webhooks,
              and mock responses while developing PAN's next-generation security solutions. 🦜
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" asChild className="text-base">
                <Link to="/login">
                  <LogIn className="mr-2 h-4 w-4" />
                  Login to Start
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="text-base">
                <Link to="/docs">Read the Docs</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="container px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need for HTTP inspection
              </h2>
              <p className="text-lg text-muted-foreground">
                All the features you expect from a modern webhook testing platform
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <Card key={index} className="transition-all hover:shadow-lg hover:shadow-primary/5">
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
                <CardTitle className="text-2xl font-bold">Perfect for Development Teams</CardTitle>
                <CardDescription className="text-base">
                  Streamline your API development workflow with these common use cases
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
              Ready to start debugging?
            </h2>
            <p className="mb-8 text-lg text-muted-foreground">
              Create your first endpoint and start capturing HTTP requests in seconds.
            </p>
            <Button size="lg" asChild className="text-base">
              <Link to="/dashboard">
                <Clock className="mr-2 h-4 w-4" />
                Get Started Now
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t bg-muted/30">
        <div className="container px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center space-x-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
                <Code2 className="h-4 w-4" />
              </div>
              <span className="font-semibold">Parrot</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Self-hosted HTTP webhook inspection and mocking platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
