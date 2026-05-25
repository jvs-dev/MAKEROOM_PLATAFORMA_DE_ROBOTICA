import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Bell, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!auth.currentUser?.email) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', 'in', [auth.currentUser.email, auth.currentUser.uid]),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    }, (err) => {
      console.error('Error in notification bell listener:', err);
    });

    return () => unsubscribe();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    const batch = writeBatch(db);
    notifications.filter(n => !n.read).forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded-xl transition-all duration-200"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-[60]" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 z-[70] overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-900">Notificações</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-[10px] font-bold text-brand-600 uppercase tracking-wider hover:text-brand-700"
                  >
                    Ler todas
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length > 0 ? (
                  <div className="divide-y divide-slate-50">
                    {notifications.map((notification) => (
                      <div 
                        key={notification.id}
                        className={`p-4 transition-colors hover:bg-slate-50 relative group ${!notification.read ? 'bg-brand-50/30' : ''}`}
                      >
                        {!notification.read && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500" />
                        )}
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <h4 className={`text-sm font-bold ${notification.read ? 'text-slate-700' : 'text-slate-900'}`}>
                            {notification.title}
                          </h4>
                          {!notification.read && (
                            <button 
                              onClick={() => markAsRead(notification.id)}
                              className="p-1 text-slate-300 hover:text-brand-500 transition-colors"
                              title="Marcar como lida"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed mb-2">
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {notification.createdAt?.toDate?.()?.toLocaleString() || 'Recentemente'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Bell className="w-12 h-12 text-slate-100 mx-auto mb-3" />
                    <p className="text-sm text-slate-400">Nenhuma notificação por aqui.</p>
                  </div>
                )}
              </div>
              
              <Link 
                to="/notifications" 
                onClick={() => setIsOpen(false)}
                className="block p-3 text-center text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border-t border-slate-100 transition-colors"
              >
                Ver todas as notificações
              </Link>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
