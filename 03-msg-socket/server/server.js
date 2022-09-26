const WebSocket = require('ws')
const jwt = require('jsonwebtoken')
const wss = new WebSocket.Server({ port: 8025 })

// let token = jwt.sign({
//   data: 'foobar'
// }, 'secret', { expiresIn: 60 * 60 });
// console.log(token)
// 多聊天室的功能
// 记录房间ID -> roomid -> 指定对应的roomid进行广播
// 否则就广播到大厅 （default默认ID）

// 存放roomid： 1. ws对象上，存储在内存中 2.借助redis、mongodb这样的数据库进行持久化
// redis -> set -> group[roomid] -> 对应的会话ID
// mongodb -> 用户历史加入的房间/会话 -> 用户历史发消息 -> 收藏 等用户相关的需要持久化的数据
var group = {}
// 定时去检测客户端的时长
var timeInterval = 5000

// 提高服务的稳定性
// 检测客户端的连接 -> 定时器 -> 超过指定时间 -> 主动断开客户端的连接
wss.on('connection', function (ws) {
  console.log('a new client is connected!');
  ws.isAlive = true
  ws.on('message', function (msg, isBinary) {
    var msgObj = JSON.parse(msg)
    if (msgObj.name) {
      ws.name = msgObj.name
    }
    if (msgObj.event == 'auth' && msgObj.msg) {
      // 拿到token,并且去校验时效性
      jwt.verify(msgObj.msg, 'secret', function (err, decoded) {
        // 鉴权通过的逻辑
        // 这里可以拿到decode，即payload里面的内容
        if (err) {
          console.log('auth error')
          return
        } else {
          ws.isAuth = true
          console.log('decoded:' + decoded)
          return
        }
      });
    }
    // 拦截，非鉴权的请求
    if (!ws.isAuth) {
      // 去给客户端发送重新鉴权的消息
      ws.send(JSON.stringify({
        event: 'noAuth',
        message: 'please auth again, your token is expired!'
      }))
      return
    }
    if (msgObj.event == 'heartbeat' && msgObj.msg == 'pong') {
      console.log('心跳连接')
      ws.isAlive = true
      return
    }
    if (typeof ws.roomid === 'undefined' && msgObj.roomid) {
      ws.roomid = msgObj.roomid
      if (typeof group[ws.roomid] == 'undefined') {
        group[ws.roomid] = 1
      } else {
        group[ws.roomid]++
      }
    }
    wss.clients.forEach(client => {
      msgObj.num = group[ws.roomid]
      if (client.readyState === WebSocket.OPEN && client.roomid === ws.roomid) {
        client.send(JSON.stringify(msgObj), { binary: isBinary })
      }
    })
  })
  // 客户端断开链接
  ws.on('close', function () {
    console.log('one client is closed :' + ws.name);

    if (typeof ws.name !== 'undefined') {
      group[ws.roomid]--
      // 广播到其他的客户端
      wss.clients.forEach(function each(client) {
        // 广播给非自己的其他客户端
        if (client !== ws && client.roomid === ws.roomid && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            name: ws.name,
            event: 'logout',
            num: group[ws.roomid]
          }));
        }
      });
    }
  })
})

const interval = setInterval(function () {
  // 遍历所有的客户端，发送一个ping/pong消息
  // 检测是否有返回，如果没有返回或者超时之后，主动断开与客户端的连接
  wss.clients.forEach(client => {
    if (client.isAlive === false) {
      console.log('客户端断开了连接')
      client.terminate() // 强制断开连接
      return
    }
    client.isAlive = false

    client.send(JSON.stringify({
      event: 'heartbeat',
      msg: 'ping'
    }))
  })
}, timeInterval)

