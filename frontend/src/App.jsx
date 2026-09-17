import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';

import LoginPage from './pages/LoginPage';
import Layout from './pages/Layout';

import CallsList from './pages/calls/CallsList';
import CallDetail from './pages/calls/CallDetail';
import UnitsList from './pages/units/UnitsList';
import UsersList from './pages/users/UsersList';
import OnlineUsers from './pages/users/OnlineUsers';
import RolesList from './pages/roles/RolesList';
import DepartmentsList from './pages/departments/DepartmentsList.jsx';
import MunicipalitiesList from './pages/municipalities/MunicipalitiesList.jsx';
import FireCategoriesList from './pages/dictionaries/FireCategoriesList.jsx';
import FireCausesList from './pages/dictionaries/FireCausesList.jsx';
import FireNonaccountList from './pages/dictionaries/FireNonaccountList.jsx';
import SettingsPage from './pages/settings/SettingsPage';

import PermissionRoute from './components/PermissionRoute';
import DeveloperRoute from './components/DeveloperRoute';
import HomeRedirect from './components/HomeRedirect';
import MaintenanceGuard from './components/MaintenanceGuard';
import UnitTypesList from './components/units/UnitTypesList';
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

// Data Router — нужен для useBlocker (предупреждение о несохранённых данных)
const router = createBrowserRouter([
    { path: '/login', element: <LoginPage /> },
    {
        path: '/',
        element: (
            <PrivateRoute>
                <Layout />
            </PrivateRoute>
        ),
        children: [
            { index: true, element: <HomeRedirect /> },
            {
                path: 'units-grid',
                element: (
                    <PermissionRoute permission="units.view">
                        <UnitsGrid />
                    </PermissionRoute>
                ),
            },
            {
                path: 'calls',
                element: (
                    <PermissionRoute permission="calls.view">
                        <CallsList />
                    </PermissionRoute>
                ),
            },
            {
                path: 'calls/:id',
                element: (
                    <PermissionRoute permission="calls.view">
                        <CallDetail />
                    </PermissionRoute>
                ),
            },
            {
                path: 'units',
                element: (
                    <PermissionRoute permission="units.view">
                        <UnitsList />
                    </PermissionRoute>
                ),
            },
            { path: 'help', element: <HelpPage /> },
            {
                path: 'unit-types',
                element: (
                    <PermissionRoute permission="units.view">
                        <UnitTypesList />
                    </PermissionRoute>
                ),
            },
            {
                path: 'departments',
                element: (
                    <PermissionRoute permission="departments.view">
                        <DepartmentsList />
                    </PermissionRoute>
                ),
            },
            {
                path: 'municipalities',
                element: (
                    <PermissionRoute permission="departments.view">
                        <MunicipalitiesList />
                    </PermissionRoute>
                ),
            },
            {
                path: 'dictionaries/fire-categories',
                element: (
                    <PermissionRoute permission="calls.view">
                        <FireCategoriesList />
                    </PermissionRoute>
                ),
            },
            {
                path: 'dictionaries/fire-causes',
                element: (
                    <PermissionRoute permission="calls.view">
                        <FireCausesList />
                    </PermissionRoute>
                ),
            },
            {
                path: 'dictionaries/fire-nonaccount',
                element: (
                    <PermissionRoute permission="calls.view">
                        <FireNonaccountList />
                    </PermissionRoute>
                ),
            },
            {
                path: 'users',
                element: (
                    <PermissionRoute permission="users.view">
                        <UsersList />
                    </PermissionRoute>
                ),
            },
            {
                path: 'online',
                element: (
                    <PermissionRoute permission="users.view_online">
                        <OnlineUsers />
                    </PermissionRoute>
                ),
            },
            {
                path: 'roles',
                element: (
                    <PermissionRoute permission="roles.view">
                        <RolesList />
                    </PermissionRoute>
                ),
            },
            {
                path: 'settings',
                element: (
                    <DeveloperRoute>
                        <SettingsPage />
                    </DeveloperRoute>
                ),
            },
            { path: '*', element: <Navigate to="/" replace /> },
        ],
    },
]);

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <ChatProvider>
                    <MaintenanceGuard>
                        <RouterProvider router={router} />
                    </MaintenanceGuard>
                </ChatProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}

export default App;