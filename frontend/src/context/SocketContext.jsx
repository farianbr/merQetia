import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

// The socket server is the API host without the `/api` path suffix.
const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
  .replace(/\/api\/?$/, '');

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    // Logged out: nothing to connect. The previous effect's cleanup already
    // disconnected and reset the socket, so state is null here.
    if (!user || !token) return;

    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    // Expose the socket only once connected; this also re-attaches consumer
    // listeners automatically after any reconnect.
    s.on('connect', () => setSocket(s));
    s.on('disconnect', () => setSocket(null));

    return () => {
      s.off('connect');
      s.off('disconnect');
      s.disconnect();
      setSocket(null);
    };
    // Reconnect whenever the logged-in user changes (login / logout / switch)
  }, [user]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

/**
 * Returns the live socket instance (or null when disconnected/logged out).
 * Consume it in an effect keyed on the socket so listeners re-attach on connect:
 *
 *   const socket = useSocket();
 *   useEffect(() => {
 *     if (!socket) return;
 *     socket.on('event', handler);
 *     return () => socket.off('event', handler);
 *   }, [socket]);
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useSocket() {
  return useContext(SocketContext);
}
