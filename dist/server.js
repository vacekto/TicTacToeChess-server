"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_1 = require("socket.io");
const uuid_1 = require("uuid");
const shared_1 = require("shared");
const games = {
    chess: shared_1.ChessGame,
    ticTacToe: shared_1.TicTacToeGame,
    uTicTacToe: shared_1.UTicTacToeGame
};
const lobby = function () {
    const _instance = {
        ticTacToe: [],
        uTicTacToe: [],
        chess: []
    };
    return {
        get state() {
            return structuredClone(_instance);
        },
        leaveLobby(username) {
            for (let gameName in _instance) {
                const index = _instance[gameName].indexOf(username);
                if (index === -1)
                    continue;
                _instance[gameName].splice(index, 1);
            }
        },
        joinLobby(username, gameName) {
            _instance[gameName].push(username);
        }
    };
}();
const gameInvites = function () {
    const _instance = [];
    return {
        get state() {
            return structuredClone(_instance);
        },
        createInvite: function (invite) {
            const inviteId = (0, uuid_1.v4)();
            invite.id = inviteId;
            _instance.push(invite);
            setTimeout(() => this.removeInvite(inviteId), 5000);
            return invite;
        },
        removeInvite: function (inviteId) {
            const indexToRemove = _instance.findIndex(invite => invite.id === inviteId);
            _instance.splice(indexToRemove, 1);
        }
    };
}();
const users = new Map();
const io = new socket_io_1.Server({
    cors: {
        origin: "http://localhost:3000",
    }
});
io.use((socket, next) => __awaiter(void 0, void 0, void 0, function* () {
    const username = socket.handshake.auth.username;
    if (!username) {
        next(new Error('Username not provided'));
        return;
    }
    if (users.has(username)) {
        next(new Error(`Username ${username} is already taken.`));
        return;
    }
    socket.data.username = username;
    socket.emit('username_accepted', username);
    next();
}));
io.on("connection", (socket) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(socket.data.username + ' connected');
    users.set(socket.data.username, socket);
    io.emit('users_online_update', Array.from(users.keys()));
    socket.onAny(() => {
        if (!socket.data.username)
            socket.disconnect(true);
    });
    socket.on('test', () => {
        console.log(socket.listeners('leave_game'));
    });
    socket.on('invite_player', (inviteeUsername, gameName) => {
        console.log(inviteeUsername, gameName);
    });
    socket.on('change_username', (username) => __awaiter(void 0, void 0, void 0, function* () {
        if (socket.data.username === username) {
            socket.emit('username_accepted', username);
            return;
        }
        if (users.has(username)) {
            const errorMessage = `Username ${username} is already taken.`;
            socket.emit('username_denied', errorMessage);
            return;
        }
        users.delete(socket.data.username);
        socket.data.username = username;
        users.set(username, socket);
        socket.emit('username_accepted', username);
        io.emit('users_online_update', Array.from(users.keys()));
    }));
    socket.on('join_lobby', (gameName) => {
        const lobbyState = lobby.state;
        const opponentUsername = lobbyState[gameName][0];
        if (!opponentUsername) {
            lobby.joinLobby(socket.data.username, gameName);
            return;
        }
        if (opponentUsername === socket.data.username)
            return;
        const opponent = users.get(opponentUsername);
        if (!opponent)
            return;
        const gameRoom = (0, uuid_1.v4)();
        const instance = new games[gameName];
        socket.data.gameInstance = instance;
        opponent.data.gameInstance = instance;
        socket.data.gameRoom = gameRoom;
        opponent.data.gameRoom = gameRoom;
        socket.join(gameRoom);
        opponent.join(gameRoom);
        const side1 = gameName === 'chess' ? 'w' : 'O';
        const side2 = gameName === 'chess' ? 'b' : 'X';
        socket.emit('start_game', gameName, opponentUsername, side1);
        socket.to(opponent.id).emit('start_game', gameName, socket.data.username, side2);
    });
    socket.on('leave_lobby', () => {
        lobby.leaveLobby(socket.data.username);
    });
    socket.on('game_move', (move) => {
        if (!socket.data.gameInstance ||
            !socket.data.gameRoom) {
            delete socket.data.gameInstance;
            delete socket.data.gameRoom;
            socket.emit('leave_game');
            return;
        }
        socket.data.gameInstance.move(move);
        const stateUpdate = socket.data.gameInstance.state;
        socket.to(socket.data.gameRoom).emit('game_state_update', stateUpdate, move);
    });
    socket.on('leave_game', () => {
        console.log('leave game');
        if (socket.data.gameRoom)
            socket.to(socket.data.gameRoom).emit('leave_game');
        delete socket.data.gameInstance;
        delete socket.data.gameRoom;
    });
    socket.on('disconnecting', () => {
        console.log(`${socket.data.username} disconnected`);
        lobby.leaveLobby(socket.data.username);
        users.delete(socket.data.username);
        io.emit('users_online_update', Array.from(users.keys()));
        if (socket.data.gameRoom)
            socket.to(socket.data.gameRoom).emit('leave_game');
    });
}));
io.listen(3001);
console.log('server up and running');
//# sourceMappingURL=server.js.map