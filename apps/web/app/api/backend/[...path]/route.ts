const API_INTERNAL_URL = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const sourceUrl = new URL(request.url);
  const targetUrl = `${API_INTERNAL_URL}/${path.map(encodeURIComponent).join('/')}${sourceUrl.search}`;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store'
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
  }

  try {
    const upstream = await fetch(targetUrl, init);
    const responseHeaders = new Headers();
    const upstreamContentType = upstream.headers.get('content-type');
    if (upstreamContentType) responseHeaders.set('content-type', upstreamContentType);

    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: responseHeaders
    });
  } catch (error) {
    console.error('Amanat API proxy error', error);
    return Response.json(
      { statusCode: 502, message: 'Backend API недоступен' },
      { status: 502 }
    );
  }
}

export function GET(request: Request, context: RouteContext) {
  return proxy(request, context);
}

export function POST(request: Request, context: RouteContext) {
  return proxy(request, context);
}

export function PATCH(request: Request, context: RouteContext) {
  return proxy(request, context);
}

export function PUT(request: Request, context: RouteContext) {
  return proxy(request, context);
}

export function DELETE(request: Request, context: RouteContext) {
  return proxy(request, context);
}
