import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import ClientLayout from './components/ClientLayout';
import AdminLayout from './components/AdminLayout';
import EmployeeLayout from './components/EmployeeLayout';

// Auth
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import RegisterEmployee from './pages/auth/RegisterEmployee';

// Client
import ClientDashboard from './pages/client/Dashboard';
import ClientOrders from './pages/client/Orders';
import ClientServices from './pages/client/Services';
import ClientInvoices from './pages/client/Invoices';
import ClientSettings from './pages/client/Settings';
import ClientNotifications from './pages/client/Notifications';
import ClientProfile from './pages/client/Profile';
import ClientEmployeeProfile from './pages/client/EmployeeProfile';
import ClientHelpCenter from './pages/client/HelpCenter';

// Admin
import AdminDashboard from './pages/admin/Dashboard';
import AdminOrders from './pages/admin/Orders';
import AdminOrderDetail from './pages/admin/OrderDetail';
import AdminServices from './pages/admin/Services';
import AdminInvoices from './pages/admin/Invoices';
import AdminReports from './pages/admin/Reports';
import AdminExpenses from './pages/admin/Expenses';
import AdminEmployees from './pages/admin/Employees';
import AdminEmployeeProfile from './pages/admin/EmployeeProfile';
import AdminClients from './pages/admin/Clients';
import AdminClientProfile from './pages/admin/ClientProfile';
import AdminSettings from './pages/admin/Settings';
import AdminNotifications from './pages/admin/Notifications';
import AdminSupport from './pages/admin/Support';

// Employee
import EmployeeDashboard from './pages/employee/Dashboard';
import EmployeeOrders from './pages/employee/Orders';
import EmployeeSettings from './pages/employee/Settings';
import EmployeeNotifications from './pages/employee/Notifications';
import EmployeeProfile from './pages/employee/Profile';
import EmployeeClientProfile from './pages/employee/ClientProfile';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'employee') return <Navigate to="/employee" replace />;
  return <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/register/employee" element={<RegisterEmployee />} />

      {/* ── Client ── */}
      <Route path="/dashboard"      element={<ProtectedRoute roles={['client']}><ClientLayout><ClientDashboard /></ClientLayout></ProtectedRoute>} />
      <Route path="/orders"         element={<ProtectedRoute roles={['client']}><ClientLayout><ClientOrders /></ClientLayout></ProtectedRoute>} />
      <Route path="/services"       element={<ProtectedRoute roles={['client']}><ClientLayout><ClientServices /></ClientLayout></ProtectedRoute>} />
      <Route path="/invoices"       element={<ProtectedRoute roles={['client']}><ClientLayout><ClientInvoices /></ClientLayout></ProtectedRoute>} />
      <Route path="/settings"       element={<ProtectedRoute roles={['client']}><ClientLayout><ClientSettings /></ClientLayout></ProtectedRoute>} />
      <Route path="/profile"         element={<ProtectedRoute roles={['client']}><ClientLayout><ClientProfile /></ClientLayout></ProtectedRoute>} />
      <Route path="/team/:id"        element={<ProtectedRoute roles={['client']}><ClientLayout><ClientEmployeeProfile /></ClientLayout></ProtectedRoute>} />
      <Route path="/notifications"  element={<ProtectedRoute roles={['client']}><ClientLayout><ClientNotifications /></ClientLayout></ProtectedRoute>} />
      <Route path="/help"           element={<ProtectedRoute roles={['client']}><ClientLayout><ClientHelpCenter /></ClientLayout></ProtectedRoute>} />

      {/* ── Admin ── */}
      <Route path="/admin"               element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminDashboard /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/orders"        element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminOrders /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/orders/:id"    element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminOrderDetail /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/services"      element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminServices /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/invoices"      element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminInvoices /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/reports"       element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminReports /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/expenses"      element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminExpenses /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/employees"      element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminEmployees /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/employees/:id" element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminEmployeeProfile /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/clients"       element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminClients /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/clients/:id"   element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminClientProfile /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/settings"      element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminSettings /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/notifications"  element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminNotifications /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/support"       element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminSupport /></AdminLayout></ProtectedRoute>} />

      {/* ── Employee ── */}
      <Route path="/employee"                element={<ProtectedRoute roles={['employee']}><EmployeeLayout><EmployeeDashboard /></EmployeeLayout></ProtectedRoute>} />
      <Route path="/employee/orders"         element={<ProtectedRoute roles={['employee']}><EmployeeLayout><EmployeeOrders /></EmployeeLayout></ProtectedRoute>} />
      <Route path="/employee/clients/:id"    element={<ProtectedRoute roles={['employee']}><EmployeeLayout><EmployeeClientProfile /></EmployeeLayout></ProtectedRoute>} />
      <Route path="/employee/notifications"   element={<ProtectedRoute roles={['employee']}><EmployeeLayout><EmployeeNotifications /></EmployeeLayout></ProtectedRoute>} />

      <Route path="/employee/settings"       element={<ProtectedRoute roles={['employee']}><EmployeeLayout><EmployeeSettings /></EmployeeLayout></ProtectedRoute>} />
      <Route path="/employee/profile"         element={<ProtectedRoute roles={['employee']}><EmployeeLayout><EmployeeProfile /></EmployeeLayout></ProtectedRoute>} />
      <Route path="/employee/support"         element={<ProtectedRoute roles={['employee']}><EmployeeLayout><AdminSupport /></EmployeeLayout></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}
