import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';

import LoginPage from './pages/LoginPage';
import Layout from './pages/Layout';

import FiresList from './pages/fires/FiresList';
import UnitsList from './pages/units/UnitsList';
import UsersList from './pages/users/UsersList';
import OnlineUsers from './pages/users/OnlineUsers';
import RolesList from './pages/roles/RolesList';
import DepartmentsList from './pages/departments/DepartmentsList.jsx';
import SettingsPage from './pages/settings/SettingsPage';
import { ChatProvider } from './context/ChatContext';

import PermissionRoute from './components/PermissionRoute';
import DeveloperRoute from './components/DeveloperRoute';
import HomeRedirect from './components/HomeRedirect';
import MaintenanceGuard from './components/MaintenanceGuard';

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
            <AuthProvider>
                <MaintenanceGuard>
                    <AuthProvider>
                        <ChatProvider>
                    <BrowserRouter>
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
                                {/* Главная — редирект на первый доступный раздел */}
                                <Route index element={<HomeRedirect />} />

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
                                        <PermissionRoute permission="users.view">
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

                                {/* Конфигурация — только developer */}
                                <Route
                                    path="settings"
                                    element={
                                        <DeveloperRoute>
                                            <SettingsPage />
                                        </DeveloperRoute>
                                    }
                                />

                                {/* 404 внутри приложения */}
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Route>
                        </Routes>
                    </BrowserRouter>
                        </ChatProvider>
                    </AuthProvider>
                </MaintenanceGuard>
            </AuthProvider>
        </QueryClientProvider>
    );
}

export default App;