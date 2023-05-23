import {
    IChessMove,
    ITicTacToeMove,
    IUTicTacToeMove,
} from "shared"

export const isChessMove = (move: any): move is IChessMove => {
    if (typeof move !== 'object') return false
    const keys = Object.keys(move)
    if (keys.length !== 2) return false
    for (const prop in move) {
        const coord = move[prop]
        if (
            !['from', 'to'].includes(prop) ||
            !Array.isArray(coord) ||
            coord.length !== 2 ||
            typeof coord[0] !== 'number' ||
            typeof coord[1] !== 'number' ||
            coord[0] < 0 ||
            coord[0] > 7 ||
            coord[1] < 0 ||
            coord[1] > 7
        )
            return false
    }

    return true
}

export const isTicTacToeMove = (move: any): move is ITicTacToeMove => {
    if (typeof move !== 'object') return false
    const keys = Object.keys(move)
    if (keys.length !== 2) return false
    for (const prop in move)
        if (
            !['X', 'Y'].includes(prop) ||
            typeof move[prop] !== 'number'
        )
            return false
    return true
}


export const isUTicTacToeMove = (move: any): move is IUTicTacToeMove => {
    if (typeof move !== 'object') return false
    const keys = Object.keys(move)
    if (keys.length !== 4) return false
    for (const prop in move)
        if (
            !['X', 'Y', 'SX', 'SY'].includes(prop) ||
            typeof move[prop] !== 'number' ||
            move[prop] < 0 ||
            move[prop] > 2
        )
            return false
    return true
}

