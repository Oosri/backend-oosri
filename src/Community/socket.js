const { Server } = require('socket.io');
const { verifyJwt } = require('../utils/jwt');

let io;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
        : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = verifyJwt(token);
      socket.user = decoded;
      socket.userId = decoded.id || decoded._id || decoded.sellerId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { userId } = socket;

    // Join personal room for direct negotiation notifications
    socket.join(`user:${userId}`);

    socket.on('join:product', (productId) => {
      socket.join(`product:${productId}`);
    });

    socket.on('leave:product', (productId) => {
      socket.leave(`product:${productId}`);
    });

    socket.on('join:discussion', (discussionId) => {
      socket.join(`discussion:${discussionId}`);
    });

    socket.on('leave:discussion', (discussionId) => {
      socket.leave(`discussion:${discussionId}`);
    });

    socket.on('disconnect', () => {});
  });

  return io;
};

const getIo = () => {
  if (!io) throw new Error('Socket.IO not initialised');
  return io;
};

module.exports = { initSocket, getIo };
