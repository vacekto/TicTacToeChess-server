import { ExtendedError } from "socket.io/dist/namespace"
import { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "tic-tac-toe-chess-shared"
import { Server, Socket } from "socket.io"
import { initLobby } from "./util/data"
import { Server as HttpServer, IncomingMessage, ServerResponse } from "http"
import { socketListener } from "./socketEvents"

export type TIOSocket = Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>

export type TIOServer = Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>

type TSocketMiddleware = (
    socket: TIOSocket,
    next: (err?: ExtendedError | undefined) => void
) => void

export const lobby = initLobby()
export const connectedUsers = new Map<string, TIOSocket>()


const socketAuthMiddleware: TSocketMiddleware = async (socket, next) => {
    const username = socket.handshake.auth.username

    if (!username) {
        next(new Error('Username not provided'))
        return
    }

    if (connectedUsers.has(username)) {
        next(new Error(`Username ${username} is already taken.`))
        return
    }

    socket.data.username = username
    socket.emit('username_accepted', username)

    next()
}


export const addSocketServer = (server: HttpServer<typeof IncomingMessage, typeof ServerResponse>) => {

    const io = new Server<
        ClientToServerEvents,
        ServerToClientEvents,
        InterServerEvents,
        SocketData
    >(server, { cors: { origin: "*" } });

    io.use(socketAuthMiddleware)

    io.on("connection", socketListener(io))
}