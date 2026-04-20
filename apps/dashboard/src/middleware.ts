import { NextResponse, type NextRequest } from 'next/server';

const COOKIE_NAME = 'imuniza_session';
const STATIC_EXT = /\.(?:svg|png|jpe?g|gif|webp|ico|bmp|avif|css|js|map|woff2?|ttf|otf|txt)$/i;

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  if (
    pathname === '/login' ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    STATIC_EXT.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME);
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
