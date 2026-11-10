import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [magicToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) return "";
    sessionStorage.setItem("pp_magic", token);
    params.delete("token");
    const search = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (search ? `?${search}` : ""),
    );
    return token;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [devCode, setDevCode] = useState("");

  useEffect(() => {
    if (step === "code") document.getElementById("code")?.focus();
  }, [step]);

  const finish = async (response: Response) => {
    const data = (await response.json()) as {
      error?: string;
      user?: { id: string; email: string; name: string; role: "user" | "admin" };
    };
    if (!response.ok || !data.user) {
      throw new Error(data.error || "Sign-in failed");
    }
    sessionStorage.removeItem("pp_magic");
    login(data.user);
    navigate("/dashboard");
  };

  const requestCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setDevCode("");
    try {
      const response = await fetch("/api/auth/request", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as {
        error?: string;
        message?: string;
        devCode?: string;
      };
      if (!response.ok) throw new Error(data.error || "Could not send a code");
      setInfo(data.message || "Check your email for a sign-in code.");
      if (data.devCode) setDevCode(data.devCode);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a code");
    } finally {
      setIsLoading(false);
    }
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      await finish(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmLink = async () => {
    const token = magicToken || sessionStorage.getItem("pp_magic") || "";
    if (!token) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      await finish(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo className="justify-center mb-4" size="lg" />
          <h1 className="text-2xl font-bold">Sign in to PAN Parrot</h1>
          <p className="text-muted-foreground">
            A verified @paloaltonetworks.com email is required.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{magicToken ? "Confirm sign-in" : "Email code"}</CardTitle>
            <CardDescription>
              We email a one-time code. Opening the link does not sign you in
              until you confirm here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {magicToken && (
              <Button className="w-full" onClick={confirmLink} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  "Confirm and continue"
                )}
              </Button>
            )}

            {step === "email" ? (
              <form onSubmit={requestCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="your.name@paloaltonetworks.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending code...
                    </>
                  ) : (
                    "Email me a code"
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={submitCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">8-digit code</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="12345678"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    required
                  />
                </div>
                {info && <p className="text-sm text-muted-foreground">{info}</p>}
                {devCode && (
                  <Alert>
                    <AlertDescription>
                      Local development code: <code>{devCode}</code>. This is
                      never returned in production.
                    </AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep("email")}
                >
                  Use a different email
                </Button>
              </form>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription role="alert">{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button variant="ghost" asChild>
            <Link to="/">← Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
