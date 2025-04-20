import { useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface VoiceButtonProps {
  isRecording?: boolean;
  isProcessing?: boolean;
  onStart?: () => Promise<void>;
  onStop?: () => void;
  label?: string;
}

export function VoiceButton({ 
  isRecording = false,
  isProcessing = false, 
  onStart, 
  onStop,
  label = "Start Conversation"
}: VoiceButtonProps) {
  // Debug prop changes
  useEffect(() => {
    console.log('VoiceButton props updated:', { isRecording, isProcessing });
  }, [isRecording, isProcessing]);
  
  const handleClick = useCallback(async () => {
    console.log('Button clicked, current state:', { isRecording, isProcessing });
    
    if (isProcessing) {
      console.log('Button click ignored - currently processing');
      return;
    }
    
    if (isRecording) {
      console.log('Stopping recording - calling onStop');
      if (onStop) {
        onStop();
      }
    } else {
      console.log('Starting recording - calling onStart');
      if (onStart) {
        try {
          await onStart();
        } catch (error) {
          console.error('Error in onStart callback:', error);
        }
      }
    }
  }, [isRecording, isProcessing, onStart, onStop]);

  return (
    <Button
      size="lg"
      variant={isRecording ? "destructive" : "default"}
      disabled={isProcessing}
      onClick={handleClick}
      className={`w-32 h-32 rounded-full relative shadow-lg hover:shadow-xl transition-shadow ${
        isRecording ? 'animate-pulse bg-red-500' : ''
      } ${isProcessing ? 'opacity-70' : ''}`}
    >
      {isProcessing ? (
        <>
          <div className="flex flex-col items-center">
            <span>Processing...</span>
            <div className="mt-2 flex space-x-1">
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
          <span className="absolute -bottom-6 text-xs text-gray-500">Please wait</span>
        </>
      ) : isRecording ? (
        <>
          <div className="flex flex-col items-center">
            <span>Listening...</span>
            <div className="mt-2 flex space-x-1">
              <span className="w-2 h-2 bg-white rounded-full animate-ping" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-white rounded-full animate-ping" style={{ animationDelay: '200ms' }}></span>
              <span className="w-2 h-2 bg-white rounded-full animate-ping" style={{ animationDelay: '400ms' }}></span>
            </div>
          </div>
          <span className="absolute -bottom-6 text-xs text-gray-500">Click to stop</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <span className="absolute -bottom-6 text-xs text-gray-500">Click to start</span>
        </>
      )}
    </Button>
  );
} 