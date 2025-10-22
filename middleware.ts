import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host');
  const url = request.nextUrl.clone();
  
  // Only redirect Vercel deployment URLs to custom domain
  if (hostname && hostname.includes('-oduduabasiav-4616s-projects.vercel.app')) {
    // Redirect to custom domain
    url.hostname = 'resumemax.ai';
    url.protocol = 'https:';
    
    console.log(`Redirecting from ${hostname} to resumemax.ai`);
    
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

// Only run middleware on specific paths (not on _next, api, etc)
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
