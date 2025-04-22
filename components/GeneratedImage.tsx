import { useState } from 'react';
import { Loader2, Image as ImageIcon } from 'lucide-react';

interface GeneratedImageProps {
  url: string;
  prompt: string;
  className?: string;
}

export default function GeneratedImage({ url, prompt, className = '' }: GeneratedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 rounded-lg">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      )}
      <img
        src={url}
        alt={prompt}
        className={`w-full h-auto rounded-lg ${isLoading ? 'invisible' : 'visible'}`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setError('Failed to load image');
        }}
      />
      <div className="mt-2 text-xs text-gray-500">
        <p className="truncate">{prompt}</p>
      </div>
    </div>
  );
} 