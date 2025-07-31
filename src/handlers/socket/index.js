import deviceHandler from "./deviceHandler.js"

export const setupSocketHandler = (io, socketManager, mqttClient) => {
    io.on('connection', (socket) => {
        socketManager.handleConnection(socket)

        deviceHandler(socket, mqttClient)
    })
}
  