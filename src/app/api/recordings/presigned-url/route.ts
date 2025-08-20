import { NextRequest, NextResponse } from 'next/server';
import { getPresignedUrl } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uri } = body;

    if (!uri) {
      return NextResponse.json({ error: 'URI is required' }, { status: 400 });
    }

    // Generate presigned URL for the audio file
    const url = await getPresignedUrl(uri, 3600); // 1 hour expiry

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 