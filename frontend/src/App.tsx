import { Routes, Route } from 'react-router-dom';
import { useAuth } from './services/authContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import OtpVerify from './pages/OtpVerify';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppErrorBoundary } from './components/ErrorBoundary';

function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <AppErrorBoundary>
      <Routes>
        <Route path="/" element={user ? <Dashboard /> : <Login />} />
        <Route path="/login" element={user ? <Dashboard /> : <Login />} />
        <Route path="/signup" element={user ? <Dashboard /> : <Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/otp" element={<OtpVerify />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
      </Routes>
    </AppErrorBoundary>
  );
}

export default App;
