import { Server, Socket } from "socket.io";
import http from 'http'
import {
    ServerToClientEvents,
    ClientToServerEvents,
    InterServerEvents,
    SocketData,
    ChessGame,
    TicTacToeGame,
    UTicTacToeGame
} from 'shared'

type TServerSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

const games = {
    chess: ChessGame,
    ticTacToe: TicTacToeGame,
    uTicTacToe: UTicTacToeGame
}


const lobby: {
    ticTacToe: TServerSocket[],
    uTicTacToe: TServerSocket[],
    chess: TServerSocket[]
} = {
    ticTacToe: [],
    uTicTacToe: [],
    chess: []
}


const leaveLobby = (socketId: string) => {
    for (let game in lobby) {
        lobby[game] = lobby[game].filter(soc => {
            return soc.id !== socketId
        })
    }
}


const usernames = new Set<string>()


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



io.use(async (socket, next) => {
    const username = socket.handshake.auth.username

    if (!username) {
        next(new Error('Username not provided'))
        return
    }

    if (usernames.has(username)) {
        next(new Error(`Username ${username} is already taken.`))
        return
    }
    socket.data.username = username
    usernames.add(username)
    socket.emit('username_accepted', username)
    io.emit('users_online_update', Array.from(usernames))

    next()
})


io.on("connection", async (socket) => {
    console.log(socket.data.username + ' connected')

    socket.onAny(() => {
        if (!socket.data.username) socket.disconnect(true)
    })


    socket.on('test', () => {
        console.log('test 1')
    })

    socket.on('test', () => {
        console.log('test 2')
    })

    socket.on('set_username', async (username) => {
        if (socket.data.username === username) {
            socket.emit('username_accepted', username)
            return
        }

        if (usernames.has(username)) {
            const errorMessage = `Username ${username} is already taken.`
            socket.emit('username_denied', errorMessage)
            return
        }

        usernames.delete(socket.data.username!)
        socket.data.username = username
        usernames.add(username)
        socket.emit('username_accepted', username)
        io.emit('users_online_update', Array.from(usernames))
    })

    socket.on('join_lobby', (game) => {
        console.log(game)
        if (!socket.data.username) return
        const opponent = lobby[game].shift()
        if (!opponent || !opponent.data.username) {
            lobby[game].push(socket)
            return
        }
        if (opponent.data.username === socket.data.username) return
        leaveLobby(socket.id)
        leaveLobby(opponent.id)

        const gameId = socket.id + opponent.id
        const instance = new games[game]
        socket.data.gameInstance = instance
        opponent.data.gameInstance = instance
        socket.data.gameRoom = gameId
        opponent.data.gameRoom = gameId

        socket.join(gameId)
        opponent.join(gameId)

        const side1 = game === 'chess' ? 'w' : 'O'
        const side2 = game === 'chess' ? 'b' : 'X'

        socket.emit('start_game',
            game,
            opponent.data.username,
            side1
        )
        socket.to(opponent.id).emit('start_game',
            game,
            socket.data.username,
            side2
        )
    })

    socket.on('game_move', (move) => {
        if (
            !socket.data.gameInstance ||
            !socket.data.gameRoom
        )
            return

        socket.data.gameInstance.move(move)
        const stateUpdate = socket.data.gameInstance.state
        socket.to(socket.data.gameRoom).emit('game_state_update', stateUpdate, move)
    })

    socket.on('leave_game', () => {
        console.log('opponent left')
        if (socket.data.gameRoom)
            socket.to(socket.data.gameRoom).emit('opponent_left')
        delete socket.data.gameInstance
        delete socket.data.gameRoom
    })

    socket.on('leave_lobby', () => {
        leaveLobby(socket.id)
    })

    socket.on('disconnecting', () => {
        console.log(`${socket.data.username} disconnected`)
        leaveLobby(socket.id)
        if (socket.data.username) {
            usernames.delete(socket.data.username)
            io.emit('users_online_update', Array.from(usernames))
        }
        if (socket.data.gameRoom)
            socket.to(socket.data.gameRoom).emit('opponent_left')
    })
});

io.listen(3001);
console.log('server up and running')