import { TGameName } from "tic_tac_toe_chess_shared"

export const initLobby = () => {
    const _instance: Record<TGameName, string[]> = {
        ticTacToe: [],
        uTicTacToe: [],
        chess: []
    }

    const leaveLobby = (username: string) => {
        for (let gameName in _instance) {
            _instance[gameName as TGameName] = _instance[gameName as TGameName]
                .filter(name => name !== username)
        }
    }

    const joinLobby = (username: string, gameName: TGameName) => {
        const index = _instance[gameName].indexOf(username)
        if (index === -1) {
            _instance[gameName].push(username)
        }
    }


    const findOpponent = (username: string, game: TGameName) => {
        const playersArr = _instance[game]
        for (const palyerUsername of playersArr) {
            if (palyerUsername === username) continue
            return palyerUsername
        }
    }


    return {
        findOpponent,
        leaveLobby,
        joinLobby,
    }
}
