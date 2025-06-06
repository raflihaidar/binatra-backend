// socket.js
import { Server as SocketIO } from 'socket.io'

export const setupSocket = (server, getSensorData) => {
  const io = new SocketIO(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)
    socket.emit('sensor-data', getSensorData())

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })

  return io
}
