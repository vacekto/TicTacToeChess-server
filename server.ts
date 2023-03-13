import { Server, Socket } from "socket.io";
import {
    ServerToClientEvents,
    ClientToServerEvents,
    InterServerEvents,
    SocketData,
    ChessGame,
    TicTacToeGame,
    UTicTacToeGame
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

io.on("connection", async (socket) => {

    const sockets = await io.fetchSockets();
    socket.on('test', () => {
        console.log(sockets.map(soc => soc.data.username))
        console.log('test from client')
        socket.emit('test')
    })

    socket.on('setUsername', async (username) => {
        console.log(username + ' wants to come here')
        let status: 'ok' | 'error' = 'ok'
        let message: 'This username is already taken' | 'Success' = 'Success'


        const sockets = await io.fetchSockets();
        const sameUsernameSocket = sockets.find(soc => soc.data.username === username)

        if (
            sameUsernameSocket &&
            socket.data.username !== username
        ) {
            status = 'error'
            message = 'This username is already taken'
            socket.emit('setUsername', status, message, username)
            return
        }

        socket.data.username = username
        console.log(socket.data.username + ' connected')
        socket.emit('setUsername', status, message, username)
    })

    socket.on('joinLobby', (game) => {
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

        socket.emit('startGame',
            game,
            opponent.data.username,
            side1
        )
        socket.to(opponent.id).emit('startGame',
            game,
            socket.data.username,
            side2
        )
    })

    socket.on('gameMove', (move) => {
        if (
            !socket.data.gameInstance ||
            !socket.data.gameRoom
        )
            return

        socket.data.gameInstance.move(move)
        const stateUpdate = socket.data.gameInstance.state
        socket.to(socket.data.gameRoom).emit('gameStateUpdate', stateUpdate, move)
    })

    socket.on('leaveGame', () => {
        console.log('opponent left')
        if (socket.data.gameRoom)
            socket.to(socket.data.gameRoom).emit('opponentLeft')
        delete socket.data.gameInstance
        delete socket.data.gameRoom
    })

    socket.on('leaveLobby', () => {
        leaveLobby(socket.id)
    })

    socket.on('disconnect', () => {
        leaveLobby(socket.id)
        if (socket.data.gameRoom)
            socket.to(socket.data.gameRoom).emit('opponentLeft')
    })
});

io.listen(3001);
console.log('server up and running')