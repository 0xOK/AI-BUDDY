import React, { useEffect } from 'react';

interface AssistantResponseProps {
  message: string;
  role: 'user' | 'assistant';
  timestamp?: string;
}

export function AssistantResponse({ message, role, timestamp }: AssistantResponseProps) {
  const isUser = role === 'user';
  
  // Debug render
  useEffect(() => {
    console.log('Rendering message:', { message, role, timestamp });
  }, [message, role, timestamp]);
  
  // Format the timestamp or use current time
  const formattedTime = timestamp 
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white mr-2 flex-shrink-0">
          AI
        </div>
      )}
      
      <div 
        className={`max-w-[80%] rounded-lg p-4 ${
          isUser 
            ? 'bg-primary text-primary-foreground rounded-tr-none' 
            : 'bg-muted text-muted-foreground rounded-tl-none'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message}</p>
        <span className="text-xs mt-1 opacity-70 block text-right">
          {formattedTime}
        </span>
      </div>
      
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white ml-2 flex-shrink-0">
          You
        </div>
      )}
    </div>
  );
} 