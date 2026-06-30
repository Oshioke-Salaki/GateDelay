const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { router, setService } = require('./routes/heartbeat');
const { HeartbeatService } = require('./services/heartbeat');
const monitor = require('./jobs/heartbeatMonitor');

const PORT = parseInt(process.env.HEARTBEAT_PORT || '4001', 10);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use('/api/heartbeat', router);

io.on('connection', (socket) => {
  console.log(`[HeartbeatServer] Socket connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[HeartbeatServer] Socket disconnected: ${socket.id}`);
  });
});

const service = new HeartbeatService();
setService(service);

service.on('alert', (alert) => {
  io.emit('heartbeat:alert', alert);
});

service.on('recovered', (data) => {
  io.emit('heartbeat:recovered', data);
});

monitor.startMonitoring(service);

server.listen(PORT, () => {
  console.log(`Heartbeat server running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down heartbeat server...');
  monitor.stopMonitoring();
  await service.destroy();
  io.close();
  server.close();
  process.exit(0);
});

module.exports = { app, server, io, service };
