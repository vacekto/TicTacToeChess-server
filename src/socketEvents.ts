import {
    ChessGame,
    TicTacToeGame,
    UTicTacToeGame,
    IGameInvite,
    TGameInstance,
    TGameSide
} from 'tic-tac-toe-chess-shared'
import { v4 as uuidv4 } from 'uuid';
import {
    isChessMove,
    isTicTacToeMove,
    isUTicTacToeMove
} from './util/typeGuards'
import { ExtendedError } from "socket.io/dist/namespace";
import {
    TIOServer,
    TIOSocket,
    connectedUsers,
    lobby
} from "./socketServer";


type TSocketListener = (io: TIOServer) => (socket: TIOSocket) => void

export const socketListener: TSocketListener = (io) => (socket) => {

    connectedUsers.set(socket.data.username!, socket)
    io.emit('online_users_update', Array.from(connectedUsers.keys()))

    socket.onAny(() => {
        if (!socket.data.username) socket.disconnect(true)
    })


    socket.on('get_ai_move', (game, props) => {
        if (game === 'ticTacToe') {

        }
        if (game === 'chess') {

        }
        if (game === 'uTicTacToe') { }
    })

    socket.on('game_invite', (invite: IGameInvite) => {
        const inviteeSocket = connectedUsers.get(invite.inviteeUsername)
        if (!inviteeSocket) return
        socket.to(inviteeSocket.id).emit("game_invite", invite)
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

        lobby.leaveLobby(socket.data.username!)
        connectedUsers.delete(socket.data.username!)
        socket.data.username = username
        connectedUsers.set(username, socket)
        socket.emit('username_accepted', username)
        io.emit('online_users_update', Array.from(connectedUsers.keys()))
    })


    socket.on('accept_invite', (invite: IGameInvite) => {
        const opponentSocket = connectedUsers.get(invite.senderUsername)
        if (!opponentSocket) return

        let instance: TGameInstance

        if (invite.game === 'chess')
            instance = new ChessGame()
        if (invite.game === 'ticTacToe')
            instance = new TicTacToeGame(invite.ticTacToeBoardSize, invite.ticTacToeWinCondition)
        if (invite.game === 'uTicTacToe')
            instance = new UTicTacToeGame()


        lobby.leaveLobby(socket.data.username!)
        lobby.leaveLobby(opponentSocket.data.username!)

        const roomId = uuidv4()

        socket.data.game = {
            instance: instance!,
            roomId,
            opponentUsername: opponentSocket.data.username!,
            playAgain: false
        }

        opponentSocket.data.game = {
            instance: instance!,
            roomId,
            opponentUsername: socket.data.username!,
            playAgain: false
        }

        socket.join(roomId)
        opponentSocket.join(roomId)

        socket.emit('start_game',
            invite.game,
            opponentSocket.data.username!,
            invite.ticTacToeBoardSize,
            invite.ticTacToeWinCondition
        )

        socket.to(opponentSocket.id).emit('start_game',
            invite.game,
            socket.data.username!,
            invite.ticTacToeBoardSize,
            invite.ticTacToeWinCondition
        )
    })

    socket.on('play_again', () => {
        if (!socket.data.game) {
            socket.emit('leave_game')
            return
        }

        const opponent = connectedUsers.get(socket.data.game.opponentUsername)

        if (!opponent?.data.game) {
            delete socket.data.game
            socket.emit('leave_game')
            return
        }
        if (opponent.data.game.playAgain) {
            opponent.data.game.playAgain = false
            socket.data.game.playAgain = false
            io.in(socket.data.game.roomId).emit('new_game')
        }
        else socket.data.game.playAgain = true
    })



    socket.on('select_side', (side) => {
        if (!socket.data.game || socket.data.game.side) return
        socket.data.game.side = side
        const opponentSocket = connectedUsers.get(socket.data.game.opponentUsername)
        if (!opponentSocket || !opponentSocket.data.game) {
            io.in(socket.data.game.roomId).emit('leave_game')
            delete socket.data.game
            return
        }
        const opponentSide = opponentSocket.data.game.side
        if (!opponentSide) return
        if (opponentSide !== side) {
            socket.data.game.opponentSide = opponentSide
            opponentSocket.data.game.opponentSide = side
            socket.emit('set_side', side)
            socket.to(opponentSocket.id).emit('set_side', opponentSide)
            return
        }

        const randIndex = Math.floor(Math.random() * 2);
        let sides: [TGameSide, TGameSide] = ['O', 'X']
        if (socket.data.game.instance instanceof ChessGame)
            sides = ['w', 'b']


        socket.data.game.side = sides[randIndex]
        socket.data.game.opponentSide = sides[(randIndex + 1) % 2]

        opponentSocket.data.game.side = socket.data.game.opponentSide
        opponentSocket.data.game.opponentSide = socket.data.game.side

        socket.emit('set_side', socket.data.game.side)
        socket.to(opponentSocket.id).emit('set_side', socket.data.game.opponentSide)
        return
    })


    socket.on('join_lobby', (gameName) => {
        const opponentUsername = lobby.findOpponent(socket.data.username!, gameName)
        if (!opponentUsername) {
            lobby.joinLobby(socket.data.username!, gameName)
            return
        }
        if (opponentUsername === socket.data.username) return
        const opponentSocket = connectedUsers.get(opponentUsername)
        if (!opponentSocket) return

        let instance: TGameInstance

        const roomId = uuidv4()

        if (gameName === 'chess')
            instance = new ChessGame()
        if (gameName === 'ticTacToe')
            instance = new TicTacToeGame()
        if (gameName === 'uTicTacToe')
            instance = new UTicTacToeGame()



        socket.data.game = {
            instance: instance!,
            roomId,
            opponentUsername: opponentSocket.data.username!,
            playAgain: false
        }

        opponentSocket.data.game = {
            instance: instance!,
            roomId,
            opponentUsername: socket.data.username!,
            playAgain: false
        }

        socket.join(roomId)
        opponentSocket.join(roomId)

        lobby.leaveLobby(socket.data.username!)
        lobby.leaveLobby(socket.data.game.opponentUsername)

        socket.emit('start_game',
            gameName,
            socket.data.game.opponentUsername,
        )

        socket.to(opponentSocket.id).emit('start_game',
            gameName,
            socket.data.username!,
        )
    })

    socket.on('leave_lobby', () => {
        lobby.leaveLobby(socket.data.username!)
    })

    socket.on('game_move', (move) => {
        if (!socket.data.game) {
            socket.emit('leave_game')
            return
        }

        const gameInstance = socket.data.game.instance
        const roomId = socket.data.game.roomId

        if (
            isChessMove(move) &&
            gameInstance instanceof ChessGame
        ) {
            gameInstance.move(move)
            const updatedState = gameInstance.state
            io.in(roomId).emit('game_state_update', updatedState)
            return
        }

        if (
            isTicTacToeMove(move) &&
            gameInstance instanceof TicTacToeGame
        ) {
            gameInstance.move(move)
            const updatedState = gameInstance.state
            io.in(roomId).emit('game_state_update', updatedState)
            return
        }

        if (
            isUTicTacToeMove(move) &&
            gameInstance instanceof UTicTacToeGame
        ) {
            gameInstance.move(move)
            const updatedState = gameInstance.state
            io.in(roomId).emit('game_state_update', updatedState)
            return
        }
    })

    socket.on('leave_game', () => {
        if (socket.data.game)
            io.in(socket.data.game.roomId).emit('leave_game')
        delete socket.data.game
    })

    socket.on('disconnecting', () => {
        if (socket.data.game)
            io.in(socket.data.game.roomId).emit('leave_game')

        lobby.leaveLobby(socket.data.username!)
        connectedUsers.delete(socket.data.username!)
        io.emit('online_users_update', Array.from(connectedUsers.keys()))
    })
}

type TSocketMiddleware = (
    socket: TIOSocket,
    next: (err?: ExtendedError | undefined) => void
) => void

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