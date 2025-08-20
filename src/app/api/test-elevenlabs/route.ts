import { NextRequest, NextResponse } from 'next/server';

interface Voice {
  voice_id: string;
  name: string;
  category: string;
  description: string;
}

// Default voice IDs that should work (from ElevenLabs documentation)
const DEFAULT_VOICE_IDS = [
  'EXAVITQu4vr4xnSDxMaL', // Sarah - young female, soft, news
  'TX3LPaxmHKxFdv7VOQHJ', // Liam - young male, articulate, narration  
  'cgSgspJ2msm6clMCkdW9', // Jessica - young female, expressive, conversational
  'bIHbv24MWmeRgasZH58o', // Will - young male, friendly, social media
  '9BWtsMINqrJLrRacOk9x', // Aria - middle-aged female, expressive, social media
];

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    const configuredVoiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_ELEVENLABS_API_KEY not found' },
        { status: 400 }
      );
    }

    // First, try to fetch all available voices
    let availableVoices = [];
    try {
      const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': apiKey,
        },
      });

      if (voicesResponse.ok) {
        const voicesData = await voicesResponse.json();
        availableVoices = voicesData.voices || [];
      }
    } catch (error) {
      console.warn('Could not fetch available voices:', error);
    }

    // Determine which voice ID to test
    let voiceIdToTest = configuredVoiceId;
    let voiceTestResult = null;

    // Test the configured voice ID first (if provided)
    if (configuredVoiceId) {
      try {
        const response = await fetch(`https://api.elevenlabs.io/v1/voices/${configuredVoiceId}`, {
          headers: {
            'xi-api-key': apiKey,
          },
        });

        if (response.ok) {
          voiceTestResult = await response.json();
        } else {
          console.warn(`Configured voice ID ${configuredVoiceId} not found, trying defaults...`);
        }
      } catch (error) {
        console.warn(`Error testing configured voice ID: ${error}`);
      }
    }

    // If configured voice failed, try default voices
    if (!voiceTestResult) {
      for (const defaultVoiceId of DEFAULT_VOICE_IDS) {
        try {
          const response = await fetch(`https://api.elevenlabs.io/v1/voices/${defaultVoiceId}`, {
            headers: {
              'xi-api-key': apiKey,
            },
          });

          if (response.ok) {
            voiceTestResult = await response.json();
            voiceIdToTest = defaultVoiceId;
            break;
          }
        } catch (error) {
          console.warn(`Default voice ${defaultVoiceId} failed:`, error);
        }
      }
    }

    // If all voices failed, return error with suggestions
    if (!voiceTestResult) {
      return NextResponse.json(
        { 
          error: `No valid voice IDs found. Configured voice "${configuredVoiceId}" is invalid.`,
                     suggestions: availableVoices.slice(0, 10).map((voice: Voice) => ({
             voice_id: voice.voice_id,
             name: voice.name,
             category: voice.category,
             description: voice.description
           })),
          defaultVoiceIds: DEFAULT_VOICE_IDS,
          status: 404 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      voiceName: voiceTestResult.name,
      voiceId: voiceTestResult.voice_id,
      category: voiceTestResult.category,
      description: voiceTestResult.description,
      isConfiguredVoice: configuredVoiceId === voiceIdToTest,
      configuredVoiceId: configuredVoiceId,
      testedVoiceId: voiceIdToTest,
      availableVoicesCount: availableVoices.length,
             availableVoices: availableVoices.slice(0, 20).map((voice: Voice) => ({
         voice_id: voice.voice_id,
         name: voice.name,
         category: voice.category,
         description: voice.description
       })),
      message: configuredVoiceId === voiceIdToTest 
        ? 'ElevenLabs connection successful with configured voice!'
        : `ElevenLabs connection successful using fallback voice "${voiceTestResult.name}" (${voiceIdToTest}). Update NEXT_PUBLIC_ELEVENLABS_VOICE_ID to use this voice.`
    });

  } catch (error) {
    console.error('Test ElevenLabs error:', error);
    return NextResponse.json(
      { error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 