import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from 'uuid';
import {
    ServerToClientEvents,
    ClientToServerEvents,
    InterServerEvents,
    SocketData,
    ChessGame,
    TicTacToeGame,
    UTicTacToeGame,
    TGameName
} from 'shared'

type TServerSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

interface IGameInvite {
    id: string
    invitee: string
    sender: string
    game: TGameName
}

const games = {
    chess: ChessGame,
    ticTacToe: TicTacToeGame,
    uTicTacToe: UTicTacToeGame
}

const lobby = function () {
    const _instance = {
        ticTacToe: [] as string[],
        uTicTacToe: [] as string[],
        chess: [] as string[]
    }

    return {
        get state() {
            return structuredClone(_instance)
        },

        leaveLobby(username: string) {
            for (let gameName in _instance) {
                const index = _instance[(gameName as keyof typeof _instance)].indexOf(username)
                if (index === -1) continue
                _instance[(gameName as keyof typeof _instance)].splice(index, 1)
            }
        },

        joinLobby(username: string, gameName: TGameName) {
            _instance[gameName].push(username)
        }
    }
}()


const gameInvites = function () {
    const _instance: IGameInvite[] = []

    return {
        get state() {
            return structuredClone(_instance) as IGameInvite[]
        },

        createInvite: function (invite: Omit<IGameInvite, 'id'>) {
            const inviteId = uuidv4() as string
            (invite as IGameInvite).id = inviteId
            _instance.push(invite as IGameInvite)
            setTimeout(() => this.removeInvite(inviteId), 5000)
            return invite as IGameInvite
        },

        removeInvite: function (inviteId: string) {
            const indexToRemove = _instance.findIndex(invite => invite.id === inviteId)
            _instance.splice(indexToRemove, 1)
        }
    }
}()





const users = new Map<string, TServerSocket>()


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

    if (users.has(username)) {
        next(new Error(`Username ${username} is already taken.`))
        return
    }

    socket.data.username = username
    socket.emit('username_accepted', username)

    next()
})


io.on("connection", async (socket) => {
    console.log(socket.data.username + ' connected')

    users.set(socket.data.username!, socket)
    io.emit('users_online_update', Array.from(users.keys()))

    socket.onAny(() => {
        if (!socket.data.username) socket.disconnect(true)
    })


    socket.on('test', () => {
        console.log(socket.listeners('leave_game'))

    })

    socket.on('invite_player', (inviteeUsername, gameName) => {
        console.log(inviteeUsername, gameName)

    })

    socket.on('change_username', async (username) => {
        if (socket.data.username === username) {
            socket.emit('username_accepted', username)
            return
        }

        if (users.has(username)) {
            const errorMessage = `Username ${username} is already taken.`
            socket.emit('username_denied', errorMessage)
            return
        }

        users.delete(socket.data.username!)
        socket.data.username = username
        users.set(username, socket)
        socket.emit('username_accepted', username)
        io.emit('users_online_update', Array.from(users.keys()))
    })

    socket.on('join_lobby', (gameName) => {
        const lobbyState = lobby.state
        const opponentUsername = lobbyState[gameName][0]
        if (!opponentUsername) {
            lobby.joinLobby(socket.data.username!, gameName)
            return
        }
        if (opponentUsername === socket.data.username) return

        lobby.leaveLobby(opponentUsername)
        const opponent = users.get(opponentUsername)
        if (!opponent) return
        const gameRoom = uuidv4()
        const instance = new games[gameName]
        socket.data.gameInstance = instance
        opponent.data.gameInstance = instance
        socket.data.gameRoom = gameRoom
        opponent.data.gameRoom = gameRoom

        socket.join(gameRoom)
        opponent.join(gameRoom)

        const side1 = gameName === 'chess' ? 'w' : 'O'
        const side2 = gameName === 'chess' ? 'b' : 'X'

        socket.emit('start_game',
            gameName,
            opponentUsername,
            side1
        )
        socket.to(opponent.id).emit('start_game',
            gameName,
            socket.data.username!,
            side2
        )
    })

    socket.on('leave_lobby', () => {
        lobby.leaveLobby(socket.data.username!)
    })

    socket.on('game_move', (move) => {
        if (
            !socket.data.gameInstance ||
            !socket.data.gameRoom
        ) {
            delete socket.data.gameInstance
            delete socket.data.gameRoom
            socket.emit('leave_game')
            return
        }

        socket.data.gameInstance.move(move)
        const stateUpdate = socket.data.gameInstance.state
        socket.to(socket.data.gameRoom).emit('game_state_update', stateUpdate, move)
    })

    socket.on('leave_game', () => {
        console.log('leave game')
        if (socket.data.gameRoom)
            socket.to(socket.data.gameRoom).emit('leave_game')
        delete socket.data.gameInstance
        delete socket.data.gameRoom
    })

    socket.on('disconnecting', () => {
        console.log(`${socket.data.username} disconnected`)
        lobby.leaveLobby(socket.data.username!)
        users.delete(socket.data.username!)
        io.emit('users_online_update', Array.from(users.keys()))

        if (socket.data.gameRoom)
            socket.to(socket.data.gameRoom).emit('leave_game')
    })
});

io.listen(3001);
console.log('server up and running')