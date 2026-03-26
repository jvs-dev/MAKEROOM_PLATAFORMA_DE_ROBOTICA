import { Navigate, Outlet } from 'react-router-dom';

export default function AdminGuard({ role }: { role: string | null }) {
  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
