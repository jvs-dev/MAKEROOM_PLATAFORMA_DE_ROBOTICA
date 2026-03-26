/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import Layout from './components/Layout';
import AuthGuard from './components/AuthGuard';
import AdminGuard from './components/AdminGuard';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Store from './pages/Store';
import Challenges from './pages/Challenges';
import Ranking from './pages/Ranking';
import Teams from './pages/Teams';
import CourseView from './pages/CourseView';
import Notifications from './pages/Notifications';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageLessons from './pages/admin/ManageLessons';
import ManageProducts from './pages/admin/ManageProducts';
import ManageChallenges from './pages/admin/ManageChallenges';
import ManageSubmissions from './pages/admin/ManageSubmissions';
import ManageOrders from './pages/admin/ManageOrders';
import ManageSchools from './pages/admin/ManageSchools';
import ManageUsers from './pages/admin/ManageUsers';
import ManageCourses from './pages/admin/ManageCourses';
import ProjectNotes from './pages/admin/ProjectNotes';
import ErrorBoundary from './components/ErrorBoundary';

import { requestNotificationPermission, initNotificationListener } from './services/notificationService';

export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    // Request permission on mount
    requestNotificationPermission();

    let stopListener: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const userDoc = await getDoc(doc(db, 'users', user.email));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        }
        
        // Initialize notification listener for the user
        if (stopListener) stopListener();
        stopListener = initNotificationListener(user.email);
      } else {
        setUserRole(null);
        if (stopListener) {
          stopListener();
          stopListener = null;
        }
      }
      setIsAuthReady(true);
    });

    return () => {
      unsubscribe();
      if (stopListener) stopListener();
    };
  }, []);

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<AuthGuard><Layout /></AuthGuard>}>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/store" element={<Store />} />
            <Route path="/challenges" element={<Challenges />} />
            <Route path="/ranking" element={<Ranking />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/courses/:id" element={<CourseView />} />
            
            {/* Admin Routes */}
            <Route element={<AdminGuard role={userRole} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/lessons" element={<ManageLessons />} />
              <Route path="/admin/products" element={<ManageProducts />} />
              <Route path="/admin/challenges" element={<ManageChallenges />} />
              <Route path="/admin/submissions" element={<ManageSubmissions />} />
              <Route path="/admin/orders" element={<ManageOrders />} />
              <Route path="/admin/users" element={<ManageUsers />} />
              <Route path="/admin/courses" element={<ManageCourses />} />
              <Route path="/admin/schools" element={<ManageSchools />} />
              <Route path="/admin/notes" element={<ProjectNotes />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
