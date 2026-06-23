const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

let io = null;

/**
 * Room naming helpers — keep these in one place so emitters and joiners agree.
 */
const userRoom = (userId) => `user:${userId}`;
const ADMINS_ROOM = 'admins';
const STAFF_ROOM = 'staff'; // admins + employees (support center)

/**
 * Initialize Socket.IO on the given HTTP server.
 * Auth mirrors the REST `protect` middleware: a valid JWT in the handshake.
 */
const initSocket = (server, allowedOrigins) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    },
  });

  // Authenticate every connection during the handshake
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('No token provided'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id role');
      if (!user) return next(new Error('User no longer exists'));

      socket.userId = user._id.toString();
      socket.userRole = user.role;
      next();
    } catch (err) {
      next(new Error('Not authorized'));
    }
  });

  io.on('connection', (socket) => {
    // Every user gets a private room keyed by their id (notifications, DMs)
    socket.join(userRoom(socket.userId));
    // Admins share a broadcast room for org-wide events (new orders, support)
    if (socket.userRole === 'admin') socket.join(ADMINS_ROOM);
    // Admins + employees both manage the support center
    if (socket.userRole === 'admin' || socket.userRole === 'employee') socket.join(STAFF_ROOM);
  });

  return io;
};

/** Emit an event to a single user (all their open tabs/devices). */
const emitToUser = (userId, event, payload) => {
  if (io && userId) io.to(userRoom(String(userId))).emit(event, payload);
};

/** Emit an event to every connected admin. */
const emitToAdmins = (event, payload) => {
  if (io) io.to(ADMINS_ROOM).emit(event, payload);
};

/** Emit an event to all connected staff (admins + employees). */
const emitToStaff = (event, payload) => {
  if (io) io.to(STAFF_ROOM).emit(event, payload);
};

module.exports = { initSocket, emitToUser, emitToAdmins, emitToStaff };
