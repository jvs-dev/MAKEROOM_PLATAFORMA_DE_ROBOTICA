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
import ManageRankPrize from './pages/admin/ManageRankPrize';
import ProjectNotes from './pages/admin/ProjectNotes';
import ManageAnnouncements from './pages/admin/ManageAnnouncements';
import ManageReportedVideos from './pages/admin/ManageReportedVideos';
import ErrorBoundary from './components/ErrorBoundary';
import LevelUpOverlay from './components/LevelUpOverlay';

import { requestNotificationPermission, initNotificationListener } from './services/notificationService';

import { AlertCircle } from 'lucide-react';

export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    // Request permission on mount
    requestNotificationPermission();

    let stopListener: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const userDoc = await getDoc(doc(db, 'users', user.email));
        let banned = false;
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserRole(userData.role);
          if (userData.banned === true) {
            banned = true;
          }
        }
        setIsBanned(banned);
        
        // Initialize notification listener for the user
        if (stopListener) stopListener();
        stopListener = initNotificationListener(user.uid);
      } else {
        setUserRole(null);
        setIsBanned(false);
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
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-deep-black transition-colors">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (isBanned) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white font-sans p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6">
          <AlertCircle size={40} />
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-red-500 mb-2">Conta Suspensa</h1>
        <p className="text-slate-400 max-w-md mb-8">
          Sua conta foi suspensa temporariamente ou permanentemente por violar as diretrizes de conteúdo da comunidade Makeroom (especialmente em denúncias de vídeos no MakerShorts). Elas foram analisadas e decididas pela administração.
        </p>
        <button
          onClick={async () => {
            await auth.signOut();
            setIsBanned(false);
          }}
          className="bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-bold px-6 py-3 rounded-2xl transition-all shadow-lg active:scale-95 whitespace-nowrap"
        >
          Sair da Conta
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <LevelUpOverlay />
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
              <Route path="/admin/rank-prize" element={<ManageRankPrize />} />
              <Route path="/admin/schools" element={<ManageSchools />} />
              <Route path="/admin/notes" element={<ProjectNotes />} />
              <Route path="/admin/announcements" element={<ManageAnnouncements />} />
              <Route path="/admin/reported-videos" element={<ManageReportedVideos />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
