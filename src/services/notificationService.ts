import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('Este navegador não suporta notificações desktop');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

export const showBrowserNotification = (title: string, options?: NotificationOptions) => {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/favicon.ico', // Adjust if you have a specific icon
      ...options
    });
  }
};

export const sendNotification = async (userId: string, title: string, message: string) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId, // Now stores UID
      title,
      message,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error('Erro ao enviar notificação:', err);
  }
};

export const initNotificationListener = (userId: string) => {
  if (!userId) return () => {};

  // Listen for new notifications added after the listener starts
  const startTime = new Date();
  const q = query(
    collection(db, 'notifications'),
    where('userId', 'in', [userId, auth.currentUser?.email].filter(Boolean)),
    where('createdAt', '>=', startTime),
    orderBy('createdAt', 'desc'),
    limit(1)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const data = change.doc.data();
        // Only show if it's actually new (createdAt might be null initially due to serverTimestamp)
        if (data.title && data.message) {
          showBrowserNotification(data.title, {
            body: data.message
          });
        }
      }
    });
  }, (err) => {
    console.error('Error in notification service listener:', err);
  });

  return unsubscribe;
};
