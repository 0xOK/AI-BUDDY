import { useState } from 'react'
import { VoiceButton } from './components/VoiceButton'
import './App.css'

function App() {
  const [transcription, setTranscription] = useState('');
  const [response, setResponse] = useState('');

  const handleMessage = (message: any) => {
    if (message.type === 'transcription') {
      setTranscription(message.text);
    } else if (message.type === 'response') {
      setResponse(message.text);
    }
  };

  return (
    <div className="app">
      <h1>AI Voice Assistant</h1>
      <div className="voice-control">
        <VoiceButton onMessage={handleMessage} />
      </div>
      <div className="conversation">
        {transcription && (
          <div className="message user">
            <h2>You said:</h2>
            <p>{transcription}</p>
          </div>
        )}
        {response && (
          <div className="message assistant">
            <h2>Assistant:</h2>
            <p>{response}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
