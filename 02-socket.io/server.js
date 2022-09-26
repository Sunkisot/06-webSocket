const express = require('express')
const app = express()
const http = require('http').createServer(app)
const io = require('socket.io')(http)


app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html')
})

io.on('connection', function(socket) {
  console.log('a socket is connection')
  socket.on('chatMsg', function(msg) {
    socket.send(msg)
  })
})

http.listen('8025', function() {
  console.log('server is running on:8025')
})