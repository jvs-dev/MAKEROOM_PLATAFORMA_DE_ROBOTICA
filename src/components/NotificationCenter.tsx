import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Bell, X, Check, Trash2, ShoppingBag, Zap, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
  type?: 'order' | 'challenge' | 'achievement' | 'system';
  orderId?: string;
}

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!auth.currentUser?.email) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', auth.currentUser.email),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
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
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.read).forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'notifications', id));
      await batch.commit();
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case 'order': return <ShoppingBag className="w-4 h-4 text-brand-500" />;
      case 'challenge': return <Zap className="w-4 h-4 text-amber-500" />;
      case 'achievement': return <Award className="w-4 h-4 text-purple-500" />;
      default: return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
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
              <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-900">Notificações</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-[10px] font-bold text-brand-600 hover:text-brand-700 uppercase tracking-widest"
                  >
                    Ler todas
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length > 0 ? (
                  <div className="divide-y divide-slate-50">
                    {notifications.map((n) => (
                      <div 
                        key={n.id} 
                        className={`p-4 transition-colors group relative ${n.read ? 'bg-white' : 'bg-brand-50/30'}`}
                      >
                        <div className="flex gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            n.read ? 'bg-slate-100' : 'bg-white shadow-sm'
                          }`}>
                            {getIcon(n.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold text-slate-900 truncate ${n.read ? 'opacity-70' : ''}`}>
                              {n.title}
                            </p>
                            <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                              {n.message}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-2">
                              {n.createdAt?.toDate ? new Intl.DateTimeFormat('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: '2-digit',
                                month: '2-digit'
                              }).format(n.createdAt.toDate()) : 'Agora mesmo'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!n.read && (
                            <button 
                              onClick={() => markAsRead(n.id)}
                              className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                              title="Marcar como lida"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button 
                            onClick={() => deleteNotification(n.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Bell className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-400 italic">Nenhuma notificação por aqui.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
