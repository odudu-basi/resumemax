import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Security: Only allow whitelisted filename prefixes and png extension
    const allowedPrefixes = ['error-', 'success-', 'hybrid-', 'form-', 'auto-apply-', 'intelligent-apply-'];
    const isAllowedPrefix = allowedPrefixes.some(prefix => filename.startsWith(prefix));
    if (!isAllowedPrefix || !filename.endsWith('.png')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    // Ensure we only read files from safe locations (no path traversal)
    const safeName = filename.replace(/[^a-zA-Z0-9_.\-]/g, '');

    // Try multiple locations (for backwards compatibility)
    const possiblePaths = [
      resolve(process.cwd(), 'public/screenshots', safeName), // New location
      resolve(process.cwd(), safeName), // Old location (project root)
    ];

    let filePath: string | null = null;
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        filePath = path;
        break;
      }
    }

    if (!filePath) {
      return NextResponse.json({ error: 'Screenshot not found' }, { status: 404 });
    }

    const imageBuffer = readFileSync(filePath);
    
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving screenshot:', error);
    return NextResponse.json({ error: 'Failed to load screenshot' }, { status: 500 });
  }
}
