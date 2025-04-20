import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Register } from './pages/Register';
import VoiceTestPage from './VoiceTestPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/voice-test" element={<VoiceTestPage />} />
      </Routes>
    </Router>
  );
}

export default App;
