import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthMode, MockAuth } from "@shared/mock-spec";

const MODES: Array<{ id: AuthMode; label: string }> = [
  { id: "none", label: "No auth" },
  { id: "api-key", label: "API key" },
  { id: "basic", label: "HTTP Basic" },
  { id: "bearer", label: "Bearer token" },
  { id: "oauth2", label: "OAuth2 client credentials" },
  { id: "session", label: "Session cookie" },
  { id: "panos-key", label: "PAN-OS keygen" },
  { id: "edgegrid", label: "Akamai EdgeGrid" },
  { id: "signed-headers", label: "Signed headers (format only)" },
  { id: "sigv4", label: "AWS SigV4" },
  { id: "digest", label: "HTTP Digest" },
  { id: "jwt", label: "JWT bearer (HS256)" },
  { id: "wsse", label: "WS-Security UsernameToken" },
  { id: "ntlm", label: "NTLM handshake" },
];

export function MockAuthPanel({
  auth,
  onChange,
}: {
  auth: MockAuth;
  onChange: (auth: MockAuth) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        These are dummy credentials for the mock. Never paste a real API key, password, or customer token. Mutual TLS is not supported: Netlify functions cannot ask a client for a certificate.
      </div>
      <Label>
        What the integration must send
        <select
          className="mt-1 w-full rounded border bg-background px-2 py-2 text-sm"
          value={auth.mode}
          onChange={(event) => onChange(blankAuth(event.target.value as AuthMode))}
        >
          {MODES.map((mode) => (
            <option key={mode.id} value={mode.id}>{mode.label}</option>
          ))}
        </select>
      </Label>
      <p className="text-sm text-muted-foreground">{describe(auth)}</p>
      {auth.mode === "api-key" && auth.apiKey && (
        <div className="grid gap-2 sm:grid-cols-3">
          <Label className="text-xs">Location
            <select className="mt-1 w-full rounded border bg-background px-2 py-1" value={auth.apiKey.in} onChange={(event) => onChange({ ...auth, apiKey: { ...auth.apiKey!, in: event.target.value as "header" | "query" | "form" } })}>
              <option value="header">Header</option>
              <option value="query">Query</option>
              <option value="form">Form field</option>
            </select>
          </Label>
          <Label className="text-xs">Name<Input value={auth.apiKey.name} onChange={(event) => onChange({ ...auth, apiKey: { ...auth.apiKey!, name: event.target.value } })} /></Label>
          <Label className="text-xs">Dummy value<Input value={auth.apiKey.value} onChange={(event) => onChange({ ...auth, apiKey: { ...auth.apiKey!, value: event.target.value } })} /></Label>
        </div>
      )}
      {auth.mode === "basic" && auth.basic && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Label className="text-xs">Username<Input value={auth.basic.username} onChange={(event) => onChange({ ...auth, basic: { ...auth.basic!, username: event.target.value } })} /></Label>
          <Label className="text-xs">Password<Input value={auth.basic.password} onChange={(event) => onChange({ ...auth, basic: { ...auth.basic!, password: event.target.value } })} /></Label>
        </div>
      )}
      {auth.mode === "bearer" && auth.bearer && (
        <Label className="text-xs">Dummy bearer token<Input value={auth.bearer.token} onChange={(event) => onChange({ ...auth, bearer: { token: event.target.value } })} /></Label>
      )}
      {auth.mode === "oauth2" && auth.oauth2 && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Label className="text-xs">Token path<Input value={auth.oauth2.tokenPath} onChange={(event) => onChange({ ...auth, oauth2: { ...auth.oauth2!, tokenPath: event.target.value } })} /></Label>
          <Label className="text-xs">Shape
            <select className="mt-1 w-full rounded border bg-background px-2 py-1" value={auth.oauth2.shape} onChange={(event) => onChange({ ...auth, oauth2: { ...auth.oauth2!, shape: event.target.value as "generic" | "microsoft" | "crowdstrike" } })}>
              <option value="generic">Generic</option>
              <option value="microsoft">Microsoft identity</option>
              <option value="crowdstrike">CrowdStrike</option>
            </select>
          </Label>
          <Label className="text-xs">Dummy client id<Input value={auth.oauth2.clientId} onChange={(event) => onChange({ ...auth, oauth2: { ...auth.oauth2!, clientId: event.target.value } })} /></Label>
          <Label className="text-xs">Dummy client secret<Input value={auth.oauth2.clientSecret} onChange={(event) => onChange({ ...auth, oauth2: { ...auth.oauth2!, clientSecret: event.target.value } })} /></Label>
        </div>
      )}
      {auth.mode === "session" && auth.session && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Label className="text-xs">Login path<Input value={auth.session.loginPath} onChange={(event) => onChange({ ...auth, session: { ...auth.session!, loginPath: event.target.value } })} /></Label>
          <Label className="text-xs">Username<Input value={auth.session.username} onChange={(event) => onChange({ ...auth, session: { ...auth.session!, username: event.target.value } })} /></Label>
          <Label className="text-xs">Password<Input value={auth.session.password} onChange={(event) => onChange({ ...auth, session: { ...auth.session!, password: event.target.value } })} /></Label>
        </div>
      )}
      {auth.mode === "panos-key" && auth.panos && (
        <div className="grid gap-2 sm:grid-cols-3">
          <Label className="text-xs">User<Input value={auth.panos.username} onChange={(event) => onChange({ ...auth, panos: { ...auth.panos!, username: event.target.value } })} /></Label>
          <Label className="text-xs">Password<Input value={auth.panos.password} onChange={(event) => onChange({ ...auth, panos: { ...auth.panos!, password: event.target.value } })} /></Label>
          <Label className="text-xs">API key returned by keygen<Input value={auth.panos.apiKey} onChange={(event) => onChange({ ...auth, panos: { ...auth.panos!, apiKey: event.target.value } })} /></Label>
        </div>
      )}
      {auth.mode === "edgegrid" && auth.edgegrid && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Label className="text-xs">Client token<Input value={auth.edgegrid.clientToken} onChange={(event) => onChange({ ...auth, edgegrid: { ...auth.edgegrid!, clientToken: event.target.value } })} /></Label>
          <Label className="text-xs">Access token<Input value={auth.edgegrid.accessToken} onChange={(event) => onChange({ ...auth, edgegrid: { ...auth.edgegrid!, accessToken: event.target.value } })} /></Label>
          <Label className="text-xs">Client secret<Input value={auth.edgegrid.clientSecret} onChange={(event) => onChange({ ...auth, edgegrid: { ...auth.edgegrid!, clientSecret: event.target.value } })} /></Label>
          <Label className="text-xs">Check
            <select className="mt-1 w-full rounded border bg-background px-2 py-1" value={auth.edgegrid.verify} onChange={(event) => onChange({ ...auth, edgegrid: { ...auth.edgegrid!, verify: event.target.value as "signature" | "format-only" } })}>
              <option value="signature">Verify the signature</option>
              <option value="format-only">Header format only</option>
            </select>
          </Label>
        </div>
      )}
      {auth.mode === "signed-headers" && auth.signedHeaders && (
        <Label className="text-xs">Required headers, comma separated
          <Input value={auth.signedHeaders.names.join(", ")} onChange={(event) => onChange({ ...auth, signedHeaders: { verify: "format-only", names: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) } })} />
        </Label>
      )}
      {auth.mode === "sigv4" && auth.sigv4 && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Label className="text-xs">Access key id<Input value={auth.sigv4.accessKeyId} onChange={(event) => onChange({ ...auth, sigv4: { ...auth.sigv4!, accessKeyId: event.target.value } })} /></Label>
          <Label className="text-xs">Dummy secret key<Input value={auth.sigv4.secretAccessKey} onChange={(event) => onChange({ ...auth, sigv4: { ...auth.sigv4!, secretAccessKey: event.target.value } })} /></Label>
          <Label className="text-xs">Region<Input value={auth.sigv4.region} onChange={(event) => onChange({ ...auth, sigv4: { ...auth.sigv4!, region: event.target.value } })} /></Label>
          <Label className="text-xs">Service<Input value={auth.sigv4.service} onChange={(event) => onChange({ ...auth, sigv4: { ...auth.sigv4!, service: event.target.value } })} /></Label>
        </div>
      )}
      {auth.mode === "digest" && auth.digest && (
        <div className="grid gap-2 sm:grid-cols-3">
          <Label className="text-xs">Realm<Input value={auth.digest.realm} onChange={(event) => onChange({ ...auth, digest: { ...auth.digest!, realm: event.target.value } })} /></Label>
          <Label className="text-xs">Username<Input value={auth.digest.username} onChange={(event) => onChange({ ...auth, digest: { ...auth.digest!, username: event.target.value } })} /></Label>
          <Label className="text-xs">Password<Input value={auth.digest.password} onChange={(event) => onChange({ ...auth, digest: { ...auth.digest!, password: event.target.value } })} /></Label>
        </div>
      )}
      {auth.mode === "jwt" && auth.jwt && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Label className="text-xs">HMAC secret<Input value={auth.jwt.hmacSecret} onChange={(event) => onChange({ ...auth, jwt: { ...auth.jwt!, hmacSecret: event.target.value } })} /></Label>
          <Label className="text-xs">Issuer<Input value={auth.jwt.issuer} onChange={(event) => onChange({ ...auth, jwt: { ...auth.jwt!, issuer: event.target.value } })} /></Label>
          <Label className="text-xs">Audience<Input value={auth.jwt.audience} onChange={(event) => onChange({ ...auth, jwt: { ...auth.jwt!, audience: event.target.value } })} /></Label>
        </div>
      )}
      {auth.mode === "wsse" && auth.wsse && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Label className="text-xs">Username<Input value={auth.wsse.username} onChange={(event) => onChange({ ...auth, wsse: { ...auth.wsse!, username: event.target.value } })} /></Label>
          <Label className="text-xs">Password<Input value={auth.wsse.password} onChange={(event) => onChange({ ...auth, wsse: { ...auth.wsse!, password: event.target.value } })} /></Label>
        </div>
      )}
      {auth.mode === "ntlm" && auth.ntlm && (
        <div className="grid gap-2 sm:grid-cols-3">
          <Label className="text-xs">Username<Input value={auth.ntlm.username} onChange={(event) => onChange({ ...auth, ntlm: { ...auth.ntlm!, username: event.target.value } })} /></Label>
          <Label className="text-xs">Password<Input value={auth.ntlm.password} onChange={(event) => onChange({ ...auth, ntlm: { ...auth.ntlm!, password: event.target.value } })} /></Label>
          <Label className="text-xs">Domain<Input value={auth.ntlm.domain} onChange={(event) => onChange({ ...auth, ntlm: { ...auth.ntlm!, domain: event.target.value } })} /></Label>
        </div>
      )}
    </div>
  );
}

function blankAuth(mode: AuthMode): MockAuth {
  if (mode === "api-key") return { mode, apiKey: { in: "header", name: "x-api-key", value: "dummy-key" } };
  if (mode === "basic") return { mode, basic: { username: "lab", password: "dummy-not-a-real-password" } };
  if (mode === "bearer") return { mode, bearer: { token: "dummy-bearer" } };
  if (mode === "oauth2") {
    return { mode, oauth2: { tokenPath: "/oauth/token", clientId: "dummy-client", clientSecret: "dummy-secret", ttlSeconds: 3600, shape: "generic" } };
  }
  if (mode === "session") return { mode, session: { loginPath: "/login", username: "lab", password: "dummy-not-a-real-password" } };
  if (mode === "panos-key") return { mode, panos: { username: "lab-admin", password: "dummy-not-a-real-password", apiKey: "dummy-panos-api-key" } };
  if (mode === "edgegrid") {
    return { mode, edgegrid: { clientToken: "dummy-client-token", accessToken: "dummy-access-token", clientSecret: "dummy-not-a-real-secret", verify: "signature" } };
  }
  if (mode === "signed-headers") return { mode, signedHeaders: { names: ["authorization"], verify: "format-only" } };
  if (mode === "sigv4") return { mode, sigv4: { accessKeyId: "AKIA_DUMMY", secretAccessKey: "dummy-secret-key", region: "us-east-1", service: "execute-api" } };
  if (mode === "digest") return { mode, digest: { realm: "pan-parrot", username: "lab", password: "dummy-not-a-real-password" } };
  if (mode === "jwt") return { mode, jwt: { hmacSecret: "dummy-hmac-secret", issuer: "lab", audience: "parrot" } };
  if (mode === "wsse") return { mode, wsse: { username: "lab", password: "dummy-not-a-real-password" } };
  if (mode === "ntlm") return { mode, ntlm: { username: "lab", password: "dummy-not-a-real-password", domain: "CORP" } };
  return { mode: "none" };
}

function describe(auth: MockAuth): string {
  if (auth.mode === "none") return "The catch URL answers without credentials. Turn a scheme on when you want to exercise the integration's login code.";
  if (auth.mode === "api-key") return "The named header, query parameter, or form field must equal the dummy value.";
  if (auth.mode === "basic") return "Send Authorization: Basic with the dummy username and password.";
  if (auth.mode === "bearer") return "Send Authorization: Bearer and the dummy token.";
  if (auth.mode === "oauth2") return "POST the token path with the dummy client id and secret. Later calls use the access token that endpoint returns. Tokens expire.";
  if (auth.mode === "session") return "POST the login path. The mock sets a pp-mock cookie. Later calls must send that cookie.";
  if (auth.mode === "panos-key") return "type=keygen with the dummy user and password returns the API key. Other calls must send that key.";
  if (auth.mode === "edgegrid") return auth.edgegrid?.verify === "format-only"
    ? "The Authorization header must look like EdgeGrid. The signature is not checked."
    : "The Authorization header is an EdgeGrid signature over the request, checked with the dummy client secret. The timestamp must be within 30 seconds.";
  if (auth.mode === "sigv4") return "Authorization must be an AWS SigV4 header. The access key, region, and service must match, the signature is checked with the dummy secret, and x-amz-date must be within 15 minutes. Presigned query URLs are not checked.";
  if (auth.mode === "digest") return "The first call gets a Digest challenge. The nonce is valid for 10 minutes and does not need a sticky connection. The response is MD5, which is what RFC 2617 clients send.";
  if (auth.mode === "jwt") return "Authorization: Bearer must be an HS256 JWT signed with the dummy secret. exp is required. iss and aud are checked when those boxes are filled. alg none and other algorithms are rejected.";
  if (auth.mode === "wsse") return "The SOAP body must contain a UsernameToken. PasswordText is compared directly. PasswordDigest is Base64(SHA1(nonce + created + password)) and Created must be within 5 minutes. A DTD in the body is rejected.";
  if (auth.mode === "ntlm") return "A Type 1 message gets a Type 2 challenge. A Type 3 message must name this user and carry an NTLMv2 response for the dummy password. The challenge is derived from that password because Netlify cannot keep a connection open between the two legs.";
  return "The named headers must be present. Their signature is not checked.";
}
