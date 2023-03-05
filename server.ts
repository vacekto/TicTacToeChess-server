import { Server } from "socket.io";
import {
    ServerToClientEvents,
    ClientToServerEvents,
    InterServerEvents,
    SocketData,
} from 'shared'

const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>({
    cors: {
        origin: "http://localhost:3000",
    }
});


const activeUsernames = new Set<string>()

io.on("connection", (socket) => {
    socket.on('setUsername', (username, callback) => {
        if (socket.data.username === username) {
            callback({
                status: 'ok',
                message: 'You are already logged in'
            })
            return
        }
        if (activeUsernames.has(username)) {
            callback({
                status: 'error',
                message: 'This username is already taken'
            })
            return
        }
        activeUsernames.add(username)
        socket.data.username = username
        console.log(username + ' connected')
        callback({
            status: 'ok',
            message: 'Success'
        })
    })

    socket.on('disconnect', () => {
        if (socket.data.username)
            activeUsernames.delete(socket.data.username)
    })
});

io.listen(3001);
console.log('server up and running')