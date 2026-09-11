import { useAuth } from '../context/AuthContext';
import { usePublicSettings } from '../hooks/useSettings';
import MaintenancePage from '../pages/MaintenancePage';

/**
 * Если включён режим ТО — показывает заглушку всем, кроме developer.
 * Public-настройки опрашиваются каждые 30 сек, так что переход в режим ТО
 * подхватится автоматически.
 */
const MaintenanceGuard = ({ children }) => {
    const { user } = useAuth();
    const { data } = usePublicSettings();

    const maintenance = data?.data?.maintenance_mode;
    const isDeveloper = user?.role === 'developer';

    if (maintenance && !isDeveloper) {
        return <MaintenancePage />;
    }
    return children;
};

export default MaintenanceGuard;