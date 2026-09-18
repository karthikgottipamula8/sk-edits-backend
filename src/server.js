import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { dbStore } from './services/supabase.js';

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Socket.IO Setup for Local Realtime Communication & Notifications
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

io.on('connection', (socket) => {
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
  });

  socket.on('send_message', (data) => {
    if (data && data.conversationId) {
      io.to(data.conversationId).emit('receive_message', data);
    }
  });

  socket.on('notify_user', (data) => {
    if (data && data.userId) {
      io.to(`user_${data.userId}`).emit('notification', data);
    }
  });

  socket.on('disconnect', () => {});
});

// Start local persistent server
async function startServer() {
  try {
    await dbStore.init();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 SK Edits Local Backend Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start local backend server:', err);
  }
}

startServer();
