import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import WaitingRoom from './pages/WaitingRoom';
import Game from './pages/Game';
import Review from './pages/Review';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:password" element={<WaitingRoom />} />
        <Route path="/game/:password" element={<Game />} />
        <Route path="/review/:password" element={<Review />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
