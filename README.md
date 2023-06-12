# About
This is simple game platform for chess, tic tac toe and ultimate tic tac toe. You can play by yourself in hotseat mode, chalange your friend to a game or even test your skill against computer. The AI however was not focus of this project and so has much room for improvement, more on that later. If you are not familiar with ultimate tic tac toe, it is simply put tic tac toe within tic tac toe, where your every move determins wherever your opponent can play next. You can read up more on rules [here](https://www.thegamegal.com/2018/09/01/ultimate-tic-tac-toe/).

# Dev stack
- React
- express
- (socket.io)[https://socket.io/]
- typescript
- Sass

game logic is written without any third party libraries in (TicTacToeChess-shared)[https://github.com/vacekto/TicTacToeChess-shared] repo.

# Ai
The Ai for tic tac toe uses (minimax algorithm)[https://www.javatpoint.com/mini-max-algorithm-in-ai] with (alpha-beta pruning)[https://www.javatpoint.com/ai-alpha-beta-pruning] optimalization to determine best next move. This was however motivated more by curiosity then practicality and has some sevire flaws that are so far left unaddressed. The evaluation function simply rewards longer streak for each opponent, which would suffice with enough processing power, but that is obviously unreasonable demand for client. Ultimate tic tac toe uses this algorithm in case when next game field is determined, otherwise it first randomly selects next game field. Chess uses third pary package (js-chess-engine)[https://github.com/josefjadrny/js-chess-engine] for ai, but uses game logic implemented in shared repo.
