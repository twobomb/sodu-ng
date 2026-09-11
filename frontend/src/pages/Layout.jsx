import { Outlet } from 'react-router-dom';
import NavBar from '../components/NavBar';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';

const Layout = () => {
    const { user } = useAuth();
    const token = localStorage.getItem('token');

    // Держим socket-соединение активным всё время, пока пользователь авторизован.
    // Именно здесь приходят события: online_users, force_refresh, force_logout,
    // maintenance_mode_on/off.
    useSocket(user ? token : null);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
            <NavBar />
            <div className="px-8 py-6 max-w-full">
                <Outlet />
            </div>
        </div>
    );
};

export default Layout;