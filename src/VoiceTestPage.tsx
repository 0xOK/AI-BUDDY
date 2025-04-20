import React from 'react';
import { VoiceTest } from './components/VoiceTest';

function VoiceTestPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold text-center mb-8">Voice WebSocket Testing</h1>
      <VoiceTest />
    </div>
  );
}

export default VoiceTestPage; 