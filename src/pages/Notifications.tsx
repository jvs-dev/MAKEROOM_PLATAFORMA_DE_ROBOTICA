import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Bell, Trash2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser?.uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', 'in', [auth.currentUser.email, auth.currentUser.uid]),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
      setIsLoading(false);
    }, (err) => {
      console.error('Error in notifications page listener:', err);
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

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const markAllAsRead = async () => {
    const batch = writeBatch(db);
    notifications.filter(n => !n.read).forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  const clearAll = async () => {
    const batch = writeBatch(db);
    notifications.forEach(n => {
      batch.delete(doc(db, 'notifications', n.id));
    });
    await batch.commit();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 transition-colors">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">Notificações 🔔</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400">Fique por dentro das novidades e conquistas.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {notifications.some(n => !n.read) && (
            <button 
              onClick={markAllAsRead}
              className="px-4 py-3 md:py-2 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-xl text-sm font-bold hover:bg-brand-100 dark:hover:bg-brand-500/20 transition-colors flex items-center gap-2 min-h-[44px]"
            >
              <CheckCircle2 className="w-4 h-4" /> Ler Todas
            </button>
          )}
          {notifications.length > 0 && (
            <button 
              onClick={clearAll}
              className="px-4 py-3 md:py-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex items-center gap-2 min-h-[44px]"
            >
              <Trash2 className="w-4 h-4" /> Limpar Tudo
            </button>
          )}
        </div>
      </header>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <motion.div
                key={notification.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`bg-white dark:bg-zinc-900 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border transition-all duration-200 group relative ${
                  notification.read ? 'border-slate-100 dark:border-white/5 opacity-80' : 'border-brand-100 dark:border-brand-500/20 bg-brand-50/10 dark:bg-brand-500/5'
                }`}
              >
                {!notification.read && (
                  <div className="absolute left-0 top-4 bottom-4 md:top-6 md:bottom-6 w-1 bg-brand-500 rounded-r-full" />
                )}
                
                <div className="flex items-start gap-3 md:gap-4">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    notification.read ? 'bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-500' : 'bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400'
                  }`}>
                    {notification.title.includes('Temporada') ? <Trophy className="w-5 h-5 md:w-6 md:h-6" /> : <Bell className="w-5 h-5 md:w-6 md:h-6" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5 md:mb-1">
                      <h3 className={`font-bold truncate text-sm md:text-base ${notification.read ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                        {notification.title}
                      </h3>
                      <div className="flex items-center gap-1 md:gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notification.read && (
                          <button 
                            onClick={() => markAsRead(notification.id)}
                            className="p-3 md:p-2 text-brand-500 hover:bg-brand-50 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                            title="Marcar como lida"
                          >
                            <CheckCircle2 className="w-5 h-5 md:w-4 md:h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => deleteNotification(notification.id)}
                          className="p-3 md:p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                          title="Excluir"
                        >
                          <Trash2 className="w-5 h-5 md:w-4 md:h-4" />
                        </button>
                      </div>
                    </div>
                    <p className={`text-xs md:text-sm leading-relaxed mb-2 md:mb-3 ${notification.read ? 'text-slate-500 dark:text-slate-500' : 'text-slate-600 dark:text-slate-300'}`}>
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      <Clock className="w-3 h-3" />
                      {notification.createdAt?.toDate?.()?.toLocaleString() || 'Recentemente'}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-[40px] border border-slate-100">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Bell className="w-10 h-10 text-slate-200" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Tudo limpo por aqui!</h3>
              <p className="text-slate-400">Você não tem nenhuma notificação no momento.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

import { Trophy } from 'lucide-react';
