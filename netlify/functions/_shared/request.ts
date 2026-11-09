export function withClientIp(request: Request, ip: string | undefined): Request {
  const headers = new Headers(request.headers);
  if (ip) headers.set("x-nf-client-connection-ip", ip);
  return new Request(request, { headers });
}
