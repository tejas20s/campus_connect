import { Navigate, useLocation } from 'react-router-dom';

const getStoredUser = () => {
  try {
    const raw = sessionStorage.getItem('campusconnect_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const user = getStoredUser();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
