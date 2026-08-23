import { Routes, Route } from 'react-router-dom';
import { useAuth } from './services/authContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OtpVerify from './pages/OtpVerify';

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={user ? <Dashboard /> : <Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Login />} />
      <Route path="/otp" element={<OtpVerify />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
}

export default App;
