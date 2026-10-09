// Liveness check for the load balancer and container health checks. Doesn't call the api, so a
// slow api can't take the web containers out of rotation.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok' });
}
