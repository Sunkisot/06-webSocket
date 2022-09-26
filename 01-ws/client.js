const WebSocket = require('ws')
const ws = new WebSocket('ws://localhost:8088')

ws.on('open', function () {
  for (var i = 0; i < 3; i++) {
    ws.send('hello server' + i)
  }
  ws.on('message', function (msg) {
    console.log(msg)
  })
})