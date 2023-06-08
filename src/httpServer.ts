import express from 'express'
import { createServer } from 'http'
import { addSocketServer } from './socketServer'
import path from 'path'
import cors from 'cors'

const PORT = process.env.PORT || 3001;

const app = express()
const httpServer = createServer(app)
addSocketServer(httpServer)

app.use(cors())

app.use(express.static(path.join(__dirname, 'client', 'build')))

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'build', 'index.html'))
});

httpServer.listen(PORT);
