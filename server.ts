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
    TGameName,
    IGameInvite
} from 'shared'

type TServerSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

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

    const leaveLobby = (username: string) => {
        for (let gameName in _instance) {
            const index = _instance[(gameName as keyof typeof _instance)].indexOf(username)
            if (index === -1) continue
            _instance[(gameName as keyof typeof _instance)].splice(index, 1)
        }
    }

    const joinLobby = (username: string, gameName: TGameName) => {
        _instance[gameName].push(username)
    }

    return {
        get state() {
            return structuredClone(_instance)
        },
        leaveLobby,
        joinLobby
    }
}()


const gameInvites = function () {
    const _instance: IGameInvite[] = []

    const inviteTimers = new Map<string, NodeJS.Timeout>

    const _createInvite = function (data: Omit<IGameInvite, 'id'>) {
        const id = uuidv4();
        (data as IGameInvite).id = id
        const timer = setTimeout(() => removeInvite(id), 90000)
        inviteTimers.set(id, timer)
        _instance.push(structuredClone(data) as IGameInvite)
        return data as IGameInvite
    }

    const _resetTimer = function (inviteId: string) {
        const oldTimer = inviteTimers.get(inviteId)
        clearTimeout(oldTimer)
        const newTimer = setTimeout(() => removeInvite(inviteId), 90000)
        inviteTimers.set(inviteId, newTimer)
    }

    const removeInvitesContainingUsername = function (username: string) {
        const senderInvites = getInvites({
            sender: username
        })

        const inviteeInvites = getInvites({
            invitee: username
        })

        for (let invite of [...senderInvites, ...inviteeInvites]) {
            removeInvite(invite.id)
        }
    }

    const getInvites = function (filter?: Partial<IGameInvite>) {
        const invites = structuredClone(_instance) as IGameInvite[]
        if (!filter) return invites

        const filteredInvites = invites.filter(invite => {
            for (let prop in filter) {
                if (
                    invite[prop as keyof IGameInvite] !==
                    filter[prop as keyof IGameInvite]
                )
                    return false
            }
            return true
        })

        return filteredInvites

    }

    const createInvite = function (data: Omit<IGameInvite, 'id'>) {
        const invite = getInvites(data)[0]
        if (invite) {
            _resetTimer(invite.id)
            return invite
        }

        return _createInvite(data)
    }

    const removeInvite = function (inviteId: string) {
        const index = _instance.findIndex(invite => invite.id === inviteId)
        if (index !== -1) _instance.splice(index, 1)
    }

    return {
        getInvites,
        createInvite,
        removeInvite,
        removeInvitesContainingUsername
    }
}()


const connectedUsers = new Map<string, TServerSocket>()


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

    if (connectedUsers.has(username)) {
        next(new Error(`Username ${username} is already taken.`))
        return
    }

    socket.data.username = username
    socket.emit('username_accepted', username)

    next()
})


io.on("connection", async (socket) => {
    console.log(socket.data.username + ' connected')
    connectedUsers.set(socket.data.username!, socket)
    io.emit('online_users_update', Array.from(connectedUsers.keys()))

    socket.onAny(() => {
        if (!socket.data.username) socket.disconnect(true)
    })


    socket.on('test', () => {
        console.log(gameInvites.getInvites())

    })

    socket.on('invite_player', (inviteeUsername, gameName) => {
        const invitee = connectedUsers.get(inviteeUsername)
        if (!invitee) return
        const invite = gameInvites.createInvite({
            game: gameName,
            invitee: inviteeUsername,
            sender: socket.data.username!
        })

        const test = gameInvites.createInvite({
            game: gameName,
            invitee: inviteeUsername,
            sender: socket.data.username!
        })

        socket.to(invitee.id).emit("game_invite", invite)
    })

    socket.on('fetch_game_invites', () => {
        const invites = gameInvites.getInvites({
            invitee: socket.data.username
        })
        socket.emit("game_invites_update", invites)
    })

    socket.on('fetch_online_users', () => {
        socket.emit('online_users_update', Array.from(connectedUsers.keys()))
    })

    socket.on('change_username', async (username) => {
        if (socket.data.username === username) {
            socket.emit('username_accepted', username)
            return
        }

        if (connectedUsers.has(username)) {
            const errorMessage = `Username ${username} is already taken.`
            socket.emit('username_denied', errorMessage)
            return
        }

        connectedUsers.delete(socket.data.username!)
        lobby.leaveLobby(socket.data.username!)
        gameInvites.removeInvitesContainingUsername(socket.data.username!)

        socket.data.username = username
        connectedUsers.set(username, socket)
        socket.emit('username_accepted', username)
        io.emit('online_users_update', Array.from(connectedUsers.keys()))
    })

    socket.on('accept_invite', (inviteId) => {
        const invite = gameInvites.getInvites({
            id: inviteId
        })[0]
        if (!invite) {
            socket.emit('invite_expired', inviteId)
            return
        }
        const opponent = connectedUsers.get(invite.sender)
        if (!opponent) return
        const gameInstance = new games[invite.game]
        const gameRoom = uuidv4()
        lobby.leaveLobby(socket.data.username!)
        lobby.leaveLobby(opponent.data.username!)
        socket.data.gameInstance = gameInstance
        opponent.data.gameInstance = gameInstance
        socket.data.gameRoom = gameRoom
        opponent.data.gameRoom = gameRoom

        socket.join(gameRoom)
        opponent.join(gameRoom)

        const side1 = invite.game === 'chess' ? 'w' : 'O'
        const side2 = invite.game === 'chess' ? 'b' : 'X'

        socket.emit('start_game',
            invite.game,
            opponent.data.username!,
            side1
        )
        socket.to(opponent.id).emit('start_game',
            invite.game,
            socket.data.username!,
            side2
        )

    })

    socket.on('decline_invite', inviteId => {
        const invite = gameInvites.getInvites({ id: inviteId })[0]
        if (!invite) return
        gameInvites.removeInvite(inviteId)
        const sender = connectedUsers.get(invite.sender)
        if (!sender) return
        socket.emit('invite_declined', invite)
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
        const opponent = connectedUsers.get(opponentUsername)
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
        if (socket.data.gameRoom)
            socket.to(socket.data.gameRoom).emit('leave_game')
        delete socket.data.gameInstance
        delete socket.data.gameRoom
    })

    socket.on('disconnecting', () => {
        console.log(`${socket.data.username} disconnected`)
        if (socket.data.gameRoom)
            socket.to(socket.data.gameRoom).emit('leave_game')
        lobby.leaveLobby(socket.data.username!)
        gameInvites.removeInvitesContainingUsername(socket.data.username!)
        connectedUsers.delete(socket.data.username!)
        io.emit('online_users_update', Array.from(connectedUsers.keys()))

        if (socket.data.gameRoom)
            socket.to(socket.data.gameRoom).emit('leave_game')
    })
});

io.listen(3001);