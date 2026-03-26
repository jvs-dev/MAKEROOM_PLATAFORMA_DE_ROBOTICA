import { Navigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  if (!auth.currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
