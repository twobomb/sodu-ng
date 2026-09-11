import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';

const PermissionRoute = ({ permission, children }) => {
    const { has } = usePermissions();
    if (!has(permission)) return <Navigate to="/" replace />;
    return children;
};

export default PermissionRoute;