import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';

import LoginPage from './pages/LoginPage';
import Layout from './pages/Layout';

import FiresList from './pages/fires/FiresList';
import UnitsList from './pages/units/UnitsList';
import UsersList from './pages/users/UsersList';
import OnlineUsers from './pages/users/OnlineUsers';
import RolesList from './pages/roles/RolesList';
import DepartmentsList from './pages/departments/DepartmentsList.jsx';
import SettingsPage from './pages/settings/SettingsPage';

import PermissionRoute from './components/PermissionRoute';
import DeveloperRoute from './components/DeveloperRoute';
import HomeRedirect from './components/HomeRedirect';
import MaintenanceGuard from './components/MaintenanceGuard';
import UnitTypesList from './components/units/UnitTypesList';
import UnitStatusesList from './components/units/UnitStatusesList';
import UnitsGrid from './pages/units/UnitsGrid';
import HelpPage from './pages/HelpPage';

const queryClient = new QueryClient();

const PrivateRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                Загрузка...
            </div>
        );
    }
    if (!user) return <Navigate to="/login" replace />;
    return children;
};

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <AuthProvider>
                    <ChatProvider>
                        <MaintenanceGuard>
                            <Routes>
                                <Route path="/login" element={<LoginPage />} />

                                <Route
                                    path="/"
                                    element={
                                        <PrivateRoute>
                                            <Layout />
                                        </PrivateRoute>
                                    }
                                >
                                    <Route index element={<HomeRedirect />} />

                                    <Route
                                        path="units-grid"
                                        element={
                                            <PermissionRoute permission="units.view">
                                                <UnitsGrid />
                                            </PermissionRoute>
                                        }
                                    />
                                    <Route
                                        path="fires"
                                        element={
                                            <PermissionRoute permission="fires.view">
                                                <FiresList />
                                            </PermissionRoute>
                                        }
                                    />
                                    <Route
                                        path="units"
                                        element={
                                            <PermissionRoute permission="units.view">
                                                <UnitsList />
                                            </PermissionRoute>
                                        }
                                    />
                                    <Route path="help" element={<HelpPage />} />
                                    <Route
                                        path="unit-types"
                                        element={
                                            <PermissionRoute permission="units.view">
                                                <UnitTypesList />
                                            </PermissionRoute>
                                        }
                                    />
                                    <Route
                                        path="unit-statuses"
                                        element={
                                            <PermissionRoute permission="units.view">
                                                <UnitStatusesList />
                                            </PermissionRoute>
                                        }
                                    />
                                    <Route
                                        path="departments"
                                        element={
                                            <PermissionRoute permission="departments.view">
                                                <DepartmentsList />
                                            </PermissionRoute>
                                        }
                                    />
                                    <Route
                                        path="users"
                                        element={
                                            <PermissionRoute permission="users.view">
                                                <UsersList />
                                            </PermissionRoute>
                                        }
                                    />
                                    <Route
                                        path="online"
                                        element={
                                            <PermissionRoute permission="users.view_online">
                                                <OnlineUsers />
                                            </PermissionRoute>
                                        }
                                    />
                                    <Route
                                        path="roles"
                                        element={
                                            <PermissionRoute permission="roles.view">
                                                <RolesList />
                                            </PermissionRoute>
                                        }
                                    />
                                    <Route
                                        path="settings"
                                        element={
                                            <DeveloperRoute>
                                                <SettingsPage />
                                            </DeveloperRoute>
                                        }
                                    />

                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Route>
                            </Routes>
                        </MaintenanceGuard>
                    </ChatProvider>
                </AuthProvider>
            </BrowserRouter>
        </QueryClientProvider>
    );
}

export default App;