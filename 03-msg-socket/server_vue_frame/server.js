const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 8025 })

wss.on('connection', function (ws) {
  ws.on('message', function (msg, isBinary) {
    console.log(arguments)
    wss.clients.forEach(client => {
      if (ws !== client && client.readyState === WebSocket.OPEN) {
        client.send(msg, { binary: isBinary })
      }
    })
  })
})
