const API_INTERNAL_URL = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const sourceUrl = new URL(request.url);
  const targetPath = path.map(encodeURIComponent).join('/');
  const targetUrl = `${API_INTERNAL_URL}/${targetPath}${sourceUrl.search}`;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
    redirect: 'manual'
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(targetUrl, init);

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get('location');
      if (!location) {
        return Response.json(
          { statusCode: 502, message: 'Backend API вернул redirect без Location' },
          { status: 502 }
        );
      }

      return new Response(null, {
        status: upstream.status,
        headers: { location }
      });
    }

    const responseHeaders = new Headers();
    const upstreamContentType = upstream.headers.get('content-type');
    const disposition = upstream.headers.get('content-disposition');
    const sha256 = upstream.headers.get('x-evidence-sha256');
    if (upstreamContentType) responseHeaders.set('content-type', upstreamContentType);
    if (disposition) responseHeaders.set('content-disposition', disposition);
    if (sha256) responseHeaders.set('x-evidence-sha256', sha256);

    const body = await upstream.arrayBuffer();

    if (
      upstream.ok &&
      request.method !== 'HEAD' &&
      body.byteLength === 0
    ) {
      console.error(`Amanat API proxy received empty success response: ${request.method} /${targetPath} -> ${upstream.status}`);
      return Response.json(
        {
          statusCode: 502,
          message: `Backend API вернул пустой успешный ответ для ${request.method} /${targetPath}`
        },
        { status: 502 }
      );
    }

    return new Response(body, {
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
