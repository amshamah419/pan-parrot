import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Simulate authentication
    try {
      // Test user credentials
      const isTestUser = email === "test@paloaltonetworks.com" && password === "test123";

      // Basic validation
      if (!isTestUser && !email.includes("@paloaltonetworks.com")) {
        throw new Error("Please use your PAN email address or test credentials");
      }

      // Check password for non-test users
      if (!isTestUser && password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));

      // Store user session (in real app, this would be handled by auth service)
      const userData = {
        email,
        name: isTestUser ? "Test User" : email.split("@")[0].replace(/[._]/g, ' ').replace(/\w\S*/g, (txt) =>
          txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        ),
        id: isTestUser ? "test-user-123" : Math.random().toString(36).substr(2, 9)
      };

      localStorage.setItem("pan-parrot-user", JSON.stringify(userData));

      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo className="justify-center mb-4" size="lg" />
          <h1 className="text-2xl font-bold">Welcome to PAN Parrot</h1>
          <p className="text-muted-foreground">Login with your PAN credentials</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Access your HTTP debugging workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.name@paloaltonetworks.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="mt-6 space-y-3">
              <div className="p-3 bg-muted/50 rounded-lg border">
                <p className="text-sm font-medium mb-1">Test Credentials:</p>
                <p className="text-sm text-muted-foreground">
                  Email: <code className="bg-background px-1 py-0.5 rounded">test@paloaltonetworks.com</code>
                </p>
                <p className="text-sm text-muted-foreground">
                  Password: <code className="bg-background px-1 py-0.5 rounded">test123</code>
                </p>
              </div>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Don't have access?{" "}
                  <Link to="/docs" className="text-primary hover:underline">
                    Contact your admin
                  </Link>
                </p>
              </div>
            </div>
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
