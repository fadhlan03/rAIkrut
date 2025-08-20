import { NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export async function GET() {
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!agentId) {
    return NextResponse.json(
      { error: "ELEVENLABS_AGENT_ID is not set" },
      { status: 500 }
    );
  }
  
  try {
    const client = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY
    });
    
    const response = await client.conversationalAi.conversations.getSignedUrl({
      agentId: agentId,
    });
    
    return NextResponse.json({ signedUrl: response.signedUrl });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Failed to get signed URL" },
      { status: 500 }
    );
  }
}

// Keep POST for backward compatibility
export async function POST() {
  return GET();
} 