import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '../services/authContext';
import { LogOut, User, Shield, BarChart3 } from 'lucide-react';

const roleConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  BORROWER: { label: 'Borrower', icon: User, color: 'bg-blue-500' },
  ADMIN: { label: 'Admin', icon: Shield, color: 'bg-purple-500' },
  ANALYST: { label: 'Credit Analyst', icon: BarChart3, color: 'bg-orange-500' },
  APPROVER: { label: 'Credit Approver', icon: BarChart3, color: 'bg-green-500' },
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  const roleInfo = roleConfig[user.role] || roleConfig.BORROWER;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleDashboard = (role: string) => {
    switch (role) {
      case 'BORROWER':
        return {
          title: 'My Applications',
          description: 'View and track your loan applications.',
        };
      case 'ANALYST':
        return {
          title: 'Review Queue',
          description: 'Review and assess incoming loan applications.',
        };
      case 'APPROVER':
        return {
          title: 'Approval Queue',
          description: 'Make final decisions on loan applications.',
        };
      case 'ADMIN':
        return {
          title: 'Admin Dashboard',
          description: 'Manage users, roles, and system settings.',
        };
      default:
        return {
          title: 'Dashboard',
          description: 'Your dashboard.',
        };
    }
  };

  const dashboardContent = getRoleDashboard(user.role);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${roleInfo.color} text-white`}>
              <roleInfo.icon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">LoanFlow</h1>
              <p className="text-sm text-gray-600">
                {user.email} · {roleInfo.label}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{dashboardContent.title}</CardTitle>
            <CardDescription>{dashboardContent.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Role-specific features will be implemented in subsequent phases.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
