import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DeveloperRoute = ({ children }) => {
    const { user } = useAuth();
    if (user?.role !== 'developer') {
        return <Navigate to="/" replace />;
    }
    return children;
};

export default DeveloperRoute;