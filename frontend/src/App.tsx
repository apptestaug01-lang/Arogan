import { Routes, Route } from 'react-router-dom';
import { useAuth } from './services/authContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import OtpVerify from './pages/OtpVerify';
import Workspace from './pages/Workspace';
import WelcomeView from './pages/workspace/WelcomeView';
import DashboardView from './pages/workspace/DashboardView';
import ApplicationsView from './pages/workspace/ApplicationsView';
import NewApplicationView from './pages/workspace/NewApplicationView';
import DocumentUploadView from './pages/workspace/DocumentUploadView';
import DocumentVaultView from './pages/workspace/DocumentVaultView';
import DocumentManageView from './pages/workspace/DocumentManageView';
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
        <Route path="/" element={user ? <Workspace /> : <Login />} />
        <Route path="/login" element={user ? <Workspace /> : <Login />} />
        <Route path="/signup" element={user ? <Workspace /> : <Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/otp" element={<OtpVerify />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Workspace />}>
            <Route index element={<DashboardView />} />
            <Route path="overview" element={<WelcomeView />} />
            <Route path="applications" element={<ApplicationsView />} />
            <Route path="applications/new" element={<NewApplicationView />} />
            <Route path="documents" element={<DocumentUploadView />} />
            <Route path="vault" element={<DocumentVaultView />} />
            <Route path="manage" element={<DocumentManageView />} />
          </Route>
        </Route>
      </Routes>
    </AppErrorBoundary>
  );
}

export default App;
