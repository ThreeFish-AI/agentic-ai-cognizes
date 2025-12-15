import { NextRequest, NextResponse } from 'next/server';

const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Forward the form data to the backend
    const response = await fetch(`${BACKEND_API_URL}/api/papers/upload`, {
      method: 'POST',
      body: formData, // Don't set Content-Type header, let browser set it with boundary
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend upload error:', errorText);
      return NextResponse.json(
        { error: 'Failed to upload paper' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error proxying paper upload:', error);
    return NextResponse.json(
      { error: 'Failed to upload paper' },
      { status: 500 }
    );
  }
}