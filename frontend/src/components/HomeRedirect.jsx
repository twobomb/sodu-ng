import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { ShieldOff } from 'lucide-react';

/**
 * Редиректит на первый доступный раздел.
 * Порядок приоритета: Пожары → Техника → Подразделения → Пользователи → Роли.
 * Если ничего не доступно — показывает заглушку.
 */
const HomeRedirect = () => {
    const { has } = usePermissions();

    if (has('fires.view')) return <Navigate to="/fires" replace />;
    if (has('units.view')) return <Navigate to="/units" replace />;
    if (has('departments.view')) return <Navigate to="/departments" replace />;
    if (has('users.view')) return <Navigate to="/users" replace />;
    if (has('roles.view')) return <Navigate to="/roles" replace />;

    return (
        <div className="flex flex-col items-center justify-center h-96 text-slate-500">
            <ShieldOff className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-lg font-medium">Нет доступных разделов</p>
            <p className="text-sm">Обратитесь к администратору для назначения прав</p>
        </div>
    );
};

export default HomeRedirect;