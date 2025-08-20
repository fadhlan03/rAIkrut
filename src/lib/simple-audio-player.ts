/**
 * Simple Audio Player for ElevenLabs Conversational AI
 * Handles raw PCM audio data streaming
 */
export class SimpleAudioPlayer {
  private audioContext: AudioContext | null = null;
  private audioQueue: ArrayBuffer[] = [];
  private isPlaying = false;
  private currentSourceNode: AudioBufferSourceNode | null = null;
  private isInitialized = false;

  constructor() {
    // Don't initialize here - wait for first play attempt
  }

  private async ensureAudioContext() {
    if (this.audioContext && this.isInitialized) {
      // Resume if suspended (required for user interaction)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('[SimpleAudioPlayer] Audio context resumed');
      }
      return;
    }

    try {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      
      // Resume immediately if suspended (for user interaction requirement)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      this.isInitialized = true;
      console.log('[SimpleAudioPlayer] Initialized with 16kHz sample rate, state:', this.audioContext.state);
    } catch (error) {
      console.error('[SimpleAudioPlayer] Failed to initialize audio context:', error);
      throw error;
    }
  }

  async playAudioChunk(audioData: ArrayBuffer) {
    console.log('[SimpleAudioPlayer] playAudioChunk called with:', audioData.byteLength, 'bytes');
    try {
      // Ensure audio context is ready
      await this.ensureAudioContext();
      
      if (!this.audioContext) {
        console.warn('[SimpleAudioPlayer] Audio context not available');
        return;
      }

      console.log('[SimpleAudioPlayer] Audio context state:', this.audioContext.state);

      // Add to queue
      this.audioQueue.push(audioData);
      console.log('[SimpleAudioPlayer] Added to queue. Queue length:', this.audioQueue.length);

      // Start playing if not already playing
      if (!this.isPlaying) {
        console.log('[SimpleAudioPlayer] Starting playback...');
        this.playNextChunk();
      } else {
        console.log('[SimpleAudioPlayer] Already playing, queued for later');
      }
    } catch (error) {
      console.error('[SimpleAudioPlayer] Error in playAudioChunk:', error);
    }
  }

  private playPCMChunk(audioData: ArrayBuffer) {
    console.log('[SimpleAudioPlayer] playPCMChunk called with:', audioData.byteLength, 'bytes');
    
    if (!this.audioContext) {
      console.warn('[SimpleAudioPlayer] No audio context available for PCM playback');
      return;
    }

    try {
      // Convert ArrayBuffer to Int16Array (PCM 16-bit from ElevenLabs)
      const pcmData = new Int16Array(audioData);
      console.log('[SimpleAudioPlayer] Converted to PCM data, samples:', pcmData.length);
      
      const float32Data = new Float32Array(pcmData.length);
      
      // Convert from Int16 to Float32 for Web Audio API
      for (let i = 0; i < pcmData.length; i++) {
        float32Data[i] = pcmData[i] / 32768.0;
      }

      console.log('[SimpleAudioPlayer] Converted to Float32, samples:', float32Data.length);

      // Create audio buffer (1 channel, 16kHz sample rate)
      const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, 16000);
      audioBuffer.copyToChannel(float32Data, 0);
      console.log('[SimpleAudioPlayer] Created audio buffer, duration:', audioBuffer.duration, 'seconds');

      // Create and configure source node
      const sourceNode = this.audioContext.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(this.audioContext.destination);
      
      sourceNode.onended = () => {
        console.log('[SimpleAudioPlayer] Audio playback ended');
        this.isPlaying = false;
        this.currentSourceNode = null;
        this.playNextChunk(); // Play next chunk in queue
      };

      // Start playback
      console.log('[SimpleAudioPlayer] Starting audio source...');
      sourceNode.start();
      this.currentSourceNode = sourceNode;
      this.isPlaying = true;
      
      console.log(`[SimpleAudioPlayer] Playing PCM chunk: ${audioData.byteLength} bytes, duration: ~${(float32Data.length / 16000 * 1000).toFixed(0)}ms`);
      
    } catch (error) {
      console.error('[SimpleAudioPlayer] Error playing PCM chunk:', error);
      this.isPlaying = false;
      this.currentSourceNode = null;
      // Try to play next chunk
      setTimeout(() => this.playNextChunk(), 100);
    }
  }

  private playNextChunk() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    const nextChunk = this.audioQueue.shift();
    if (nextChunk) {
      this.playPCMChunk(nextChunk);
    }
  }

  stop() {
    if (this.currentSourceNode) {
      try {
        this.currentSourceNode.stop();
      } catch (error) {
        // Ignore errors from stopping already stopped nodes
      }
      this.currentSourceNode = null;
    }
    this.audioQueue = [];
    this.isPlaying = false;
    console.log('[SimpleAudioPlayer] Stopped and cleared queue');
  }

  getQueueLength(): number {
    return this.audioQueue.length;
  }

  // Method to check if audio context is ready
  isReady(): boolean {
    return this.isInitialized && this.audioContext?.state === 'running';
  }
} 