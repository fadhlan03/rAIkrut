import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversationId = id;
  
  if (!conversationId) {
    return NextResponse.json(
      { error: "Conversation ID is required" },
      { status: 400 }
    );
  }

  try {
    console.log("Fetching audio for conversation ID:", conversationId);
    console.log("API Key available:", !!process.env.ELEVENLABS_API_KEY);
    
    // Make direct HTTP request to ElevenLabs API
    console.log("Calling ElevenLabs API for conversation audio:", conversationId);
    const audioResponse = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`, {
      method: 'GET',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      },
    });

    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.status} ${audioResponse.statusText}`);
    }

    console.log("Successfully fetched audio data");
    console.log("Audio response status:", audioResponse.status);
    console.log("Audio response headers:", Object.fromEntries(audioResponse.headers.entries()));
    
    // Get the audio as an ArrayBuffer
    const audioBuffer = await audioResponse.arrayBuffer();
    console.log("Audio buffer size:", audioBuffer.byteLength);
    
    // Convert ArrayBuffer to base64
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    
    return NextResponse.json({
      audio: base64Audio,
      contentType: audioResponse.headers.get('content-type') || 'audio/mpeg',
      size: audioBuffer.byteLength
    });
  } catch (error) {
    console.error("Error fetching conversation audio:", error);
    console.error("Error details:", error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error);
    
    return NextResponse.json(
      { 
        error: "Failed to fetch conversation audio",
        conversationId: conversationId,
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
