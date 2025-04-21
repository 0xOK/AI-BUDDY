import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

interface VoiceButtonProps {
  isRecording?: boolean;
  isProcessing?: boolean;
  onStart?: () => Promise<void>;
  onStop?: () => void;
  onInterrupt?: () => void;
  label?: string;
}

export function VoiceButton({ 
  isRecording = false,
  isProcessing = false, 
  onStart, 
  onStop,
  onInterrupt,
  label = "Start Conversation"
}: VoiceButtonProps) {
  // Prevent rapid repeated clicks
  const clickCooldownRef = useRef(false);
  // Animation state for "thinking" dots
  const [animationDots, setAnimationDots] = useState(1);
  
  // Debug prop changes
  useEffect(() => {
    console.log('VoiceButton props updated:', { isRecording, isProcessing });
  }, [isRecording, isProcessing]);
  
  // Animate dots when processing
  useEffect(() => {
    let animationInterval: ReturnType<typeof setInterval>;
    
    if (isProcessing) {
      animationInterval = setInterval(() => {
        setAnimationDots(prev => (prev % 3) + 1);
      }, 500);
    }
    
    return () => {
      if (animationInterval) clearInterval(animationInterval);
    };
  }, [isProcessing]);
  
  const handleClick = useCallback(async () => {
    // Prevent rapid clicks
    if (clickCooldownRef.current) {
      console.log('Button click ignored - cooldown active');
      return;
    }
    
    console.log('Button clicked, current state:', { isRecording, isProcessing });
    
    // Set cooldown
    clickCooldownRef.current = true;
    
    // Handle the click based on state
    if (isProcessing) {
      console.log('Processing interrupted - calling onInterrupt');
      if (onInterrupt) {
        onInterrupt();
      }
    } else if (isRecording) {
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
    
    // Clear cooldown after a short delay
    setTimeout(() => {
      clickCooldownRef.current = false;
    }, 300); // 300ms cooldown to prevent accidental double-clicks
  }, [isRecording, isProcessing, onStart, onStop, onInterrupt]);

  // Get animation dots
  const getDots = () => {
    return '.'.repeat(animationDots);
  };

  // Define pulse animation classes
  const getPulseClass = () => {
    if (isRecording) {
      return 'animate-pulse-recording';
    } else if (isProcessing) {
      return 'animate-pulse-processing';
    }
    return '';
  };

  return (
    <Button
      size="lg"
      variant={isRecording ? "destructive" : isProcessing ? "secondary" : "default"}
      disabled={clickCooldownRef.current}
      onClick={handleClick}
      className={`w-32 h-32 rounded-full relative shadow-lg hover:shadow-xl transition-shadow ${
        getPulseClass()
      } ${isProcessing ? 'opacity-90' : ''}`}
    >
      {isProcessing ? (
        <>
          <div className="flex flex-col items-center">
            <span>Thinking{getDots()}</span>
            <div className="mt-2 flex space-x-1">
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
          <span className="absolute -bottom-6 text-xs text-gray-500">Tap to interrupt</span>
        </>
      ) : isRecording ? (
        <>
          <div className="flex flex-col items-center">
            <span>Listening{getDots()}</span>
            <div className="mt-2 flex space-x-1">
              <span className="w-2 h-2 bg-white rounded-full animate-ping" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-white rounded-full animate-ping" style={{ animationDelay: '200ms' }}></span>
              <span className="w-2 h-2 bg-white rounded-full animate-ping" style={{ animationDelay: '400ms' }}></span>
            </div>
          </div>
          <span className="absolute -bottom-6 text-xs text-gray-500">Tap to stop</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <span className="absolute -bottom-6 text-xs text-gray-500">Tap to start</span>
        </>
      )}
    </Button>
  );
} 