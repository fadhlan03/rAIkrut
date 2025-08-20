import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

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
    console.log("Fetching conversation with ID:", conversationId);
    console.log("API Key available:", !!process.env.ELEVENLABS_API_KEY);
    
    const client = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY
    });

    // Get conversation details including transcript
    console.log("Calling ElevenLabs API for conversation:", conversationId);
    const conversation = await client.conversationalAi.conversations.get(conversationId);

    console.log("Successfully fetched conversation data");
    // console.log("Conversation structure:", JSON.stringify(conversation, null, 2));
    console.log("Available fields:", Object.keys(conversation));
    
    return NextResponse.json(conversation);
  } catch (error) {
    console.error("Error fetching conversation:", error);
    console.error("Error details:", error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error);
    
    return NextResponse.json(
      { 
        error: "Failed to fetch conversation details",
        conversationId: conversationId,
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
