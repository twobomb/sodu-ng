import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePublicSettings } from '../hooks/useSettings';
import MaintenancePage from '../pages/MaintenancePage';

const MaintenanceGuard = ({ children }) => {
    const { user } = useAuth();
    const { data } = usePublicSettings();

    // Читаем флаг «кикнуло по ТО» один раз при монтировании
    const [wasKicked] = useState(
        () =>
            typeof window !== 'undefined' &&
            sessionStorage.getItem('logout_reason') === 'maintenance_mode'
    );

    const maintenance = data?.data?.maintenance_mode;
    const isDeveloper = user?.role === 'developer';

    // Показываем заглушку, если:
    //   - режим ТО включён (maintenance === true)
    //   - пользователь не developer
    //   - пользователь залогинен ИЛИ его недавно выкинуло по ТО
    const shouldShow =
        maintenance === true &&
        !isDeveloper &&
        (!!user || wasKicked);

    if (shouldShow) {
        return <MaintenancePage />;
    }

    return children;
};

export default MaintenanceGuard;