import { useState } from 'react';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';

interface AudioPlayerProps {
  text: string;
  className?: string;
}

export default function AudioPlayer({ text, className = '' }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<'HIT' | 'MISS' | null>(null);

  const playText = async () => {
    try {
      setError(null);
      setIsLoading(true);
      setCacheStatus(null);

      // If already playing, stop the current audio
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }

      // Create new audio element
      const newAudio = new Audio();
      setAudio(newAudio);

      console.log('Sending TTS request for text:', text.substring(0, 50) + '...');
      
      // Call TTS server through Next.js API route
      const response = await fetch('/api/tts/stream', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice: 'alloy',
          model: 'tts-1',
          speed: 1.0
        })
      });

      // Check cache status from response header
      const cacheHeader = response.headers.get('X-Cache');
      setCacheStatus(cacheHeader as 'HIT' | 'MISS' | null);

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to generate speech';
        if (response.status === 503) {
          throw new Error('TTS server is not running. Please start the TTS server on port 5002.');
        }
        throw new Error(errorMessage);
      }

      // Get the audio blob and create URL
      const blob = await response.blob();
      console.log('Received audio blob:', blob.size, 'bytes');
      
      if (blob.size === 0) {
        throw new Error('Received empty audio data');
      }

      const url = URL.createObjectURL(blob);
      newAudio.src = url;

      // Set up event listeners
      newAudio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };

      newAudio.onerror = (error) => {
        console.error('Audio playback error:', error);
        setIsPlaying(false);
        URL.revokeObjectURL(url);
        setError('Failed to play audio');
      };

      // Start playing
      await newAudio.play();
      setIsPlaying(true);

    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
      setError(error instanceof Error ? error.message : 'Failed to play audio');
    } finally {
      setIsLoading(false);
    }
  };

  const stopPlaying = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={isPlaying ? stopPlaying : playText}
        disabled={isLoading}
        className={`p-2 rounded-full hover:bg-gray-200 transition-colors ${className} ${
          isLoading ? 'cursor-wait' : ''
        }`}
        aria-label={isPlaying ? 'Stop playing' : 'Play message'}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 text-gray-600 animate-spin" />
        ) : isPlaying ? (
          <VolumeX className="h-4 w-4 text-gray-600" />
        ) : (
          <Volume2 className="h-4 w-4 text-gray-600" />
        )}
      </button>
      {error && (
        <div className="absolute top-full left-0 mt-1 bg-red-100 text-red-700 text-xs p-1 rounded whitespace-nowrap">
          {error}
        </div>
      )}
      {cacheStatus && (
        <div className="absolute top-full left-0 mt-1 bg-blue-100 text-blue-700 text-xs p-1 rounded whitespace-nowrap">
          {cacheStatus === 'HIT' ? 'Playing from cache' : 'Generating new audio'}
        </div>
      )}
    </div>
  );
} 