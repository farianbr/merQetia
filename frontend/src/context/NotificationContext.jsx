import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications';
import { useSocket } from './SocketContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const socket = useSocket();

  const refresh = useCallback(() => {
    getNotifications()
      .then((r) => setNotifications(r.data.notifications || []))
      .catch(() => {});
  }, [setNotifications]);

  useEffect(() => {
    refresh();
    // Poll as a safety net for missed real-time events / reconnects
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  // Live push: prepend new notifications as they arrive
  useEffect(() => {
    if (!socket) return;
    const onNew = (notif) => {
      setNotifications((prev) => {
        if (prev.some((n) => n._id === notif._id)) return prev;
        return [notif, ...prev];
      });
    };
    socket.on('notification:new', onNew);
    return () => socket.off('notification:new', onNew);
  }, [socket]);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try { await markAllNotificationsRead(); } catch { /* ignore */ }
  }, []);

  const markRead = useCallback(async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, read: true } : n))
    );
    try { await markNotificationRead(id); } catch { /* ignore */ }
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead, markRead, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  return useContext(NotificationContext);
}
