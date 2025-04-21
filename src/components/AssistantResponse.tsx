import { useState, useEffect } from 'react';

interface AssistantResponseProps {
  message: string;
  role: 'user' | 'assistant';
  timestamp?: string;
  isTyping?: boolean;
}

// Simple function to format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  
  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export function AssistantResponse({ 
  message, 
  role, 
  timestamp, 
  isTyping = false 
}: AssistantResponseProps) {
  const [formattedTime, setFormattedTime] = useState<string>('');
  const [showFullTimestamp, setShowFullTimestamp] = useState(false);
  
  // Format the timestamp
  useEffect(() => {
    if (timestamp) {
      try {
        const date = new Date(timestamp);
        setFormattedTime(formatRelativeTime(date));
      } catch (error) {
        console.error('Error formatting timestamp:', error);
        setFormattedTime('');
      }
    }
  }, [timestamp]);

  // Toggle timestamp format
  const toggleTimestampFormat = () => {
    setShowFullTimestamp(!showFullTimestamp);
  };

  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
      {role === 'assistant' && (
        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center mr-2">
          AI
        </div>
      )}
      
      <div className="flex flex-col">
        <div className={`message-bubble ${role} ${isTyping ? 'is-typing' : ''}`}>
          {isTyping ? (
            <div className="typing-animation">
              <span></span>
              <span></span>
              <span></span>
            </div>
          ) : (
            <div>{message}</div>
          )}
        </div>
        
        {timestamp && (
          <span 
            className="text-xs text-gray-500 mt-1 cursor-pointer" 
            onClick={toggleTimestampFormat}
          >
            {showFullTimestamp 
              ? new Date(timestamp).toLocaleString() 
              : formattedTime}
          </span>
        )}
      </div>
      
      {role === 'user' && (
        <div className="w-8 h-8 rounded-full bg-gray-400 text-white flex items-center justify-center ml-2">
          You
        </div>
      )}
    </div>
  );
} 