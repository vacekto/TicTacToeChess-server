import express from 'express'
import { createServer } from 'http'
import { addSocketServer } from './socketServer'
import path from 'path'
import cors from 'cors'

const PORT = process.env.PORT || 3001;

const app = express()

app.use(cors())

app.use(express.static(path.join(__dirname, 'client')))

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'index.html'))
});

const httpServer = createServer(app)
addSocketServer(httpServer)

httpServer.listen(PORT);
