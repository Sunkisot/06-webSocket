const WebSocket = require('ws')
const jwt = require('jsonwebtoken')
const { setValue,
  getValue,
  increase,
  decrease,
  getKeys,
  existKey,
  delKey } = require('./src/utils/redis')
const wss = new WebSocket.Server({ port: 8025 })


// 多聊天室的功能
// 记录房间ID -> roomid -> 指定对应的roomid进行广播
// 否则就广播到大厅 （default默认ID）

// 存放roomid： 1. ws对象上，存储在内存中 2.借助redis、mongodb这样的数据库进行持久化
// redis -> set -> group[roomid] -> 对应的会话ID
// mongodb -> 用户历史加入的房间/会话 -> 用户历史发消息 -> 收藏 等用户相关的需要持久化的数据

// redis储存
// 1. roomid -> key uid -> value, key: Array<value>
// 2. uid => key message -> value, key: Array<Object>
// 3. 在下一步就是储存到mongDB中， 读取历史数据

// 定时去检测客户端的时长
var timeInterval = 5000

var prefix = 'room-'

async function init() {
  const keys = await getKeys(prefix)
  if (keys.length > 0) {
    keys.forEach(async function (item) {
      await delKey(item)
    })
  }
}
init()

// 提高服务的稳定性
// 检测客户端的连接 -> 定时器 -> 超过指定时间 -> 主动断开客户端的连接
wss.on('connection', async function (ws) {
  console.log('a new client is connected!');

  ws.isAlive = true
  ws.on('message', async function (msg, isBinary) {
    var msgObj = JSON.parse(msg)
    if (msgObj.name) {
      ws.name = msgObj.name
    }
    if (msgObj.uid) {
      ws.uid = msgObj.uid
    }
    if (msgObj.event == 'heartbeat' && msgObj.msg == 'pong') {
      console.log('心跳连接')
      ws.isAlive = true
      return
    }
    if (typeof ws.roomid === 'undefined' && msgObj.roomid) {
      ws.roomid = msgObj.roomid
      let result = await existKey(prefix + msgObj.roomid)
      if (result == 0) {
        setValue(prefix + msgObj.roomid, JSON.stringify([ws.uid]))
      } else {
        let uids = await getValue(prefix + msgObj.roomid)
        let arr1 = JSON.parse(uids)
        if (arr1.indexOf(ws.uid) == -1) {
          arr1.push(ws.uid)
          setValue(prefix + msgObj.roomid, JSON.stringify(arr1))
        }
      }
    }
    // 计算在线人数
    let arrStr1 = JSON.parse(await getValue(prefix + ws.roomid)) || []
    msgObj.total = arrStr1.length
    msgObj.num = wss.clients.size

    wss.clients.forEach(async client => {
      if (client.readyState === WebSocket.OPEN && client.roomid === ws.roomid) {
        // 所有连接的 同一个链接的其他人发送消息
        client.send(JSON.stringify(msgObj), { binary: isBinary })
        // 删除发送的  剩余的为断掉连接的没有收到消息的其他人
        arrStr1.splice(arrStr1.indexOf(ws.uid), 1)

        // 判断当前人有没有留言
        if (await existKey('uid-' + ws.uid) == 1) {
          let arr = JSON.parse(await getValue('uid-' + ws.uid))
          if (arr.length > 0) {
            // 便利数组，判断是否是同一个roomid，否则的话，就保存数据
            JSON.parse(JSON.stringify(arr)).forEach(e => {
              if (e.roomid == client.roomid) {
                client.send(JSON.stringify(e.msg), { binary: isBinary })
                arr.splice(arr.indexOf(e))
              }
            })
            setValue('uid-' + ws.uid, JSON.stringify(arr))
          }
        }
      }
    })

    // 剩余的为断掉连接的没有收到消息的其他人
    if (arrStr1.length > 0) {
      arrStr1.forEach(async uid => {
        // 储存要发送给离线客户端的消息
        if (await existKey('uid-' + uid) == 0) {
          setValue('uid-' + uid, JSON.stringify([{
            roomid: ws.roomid,
            msg: msgObj
          }]))
        } else {
          let msgs = JSON.parse(await getValue('uid-' + uid))
          msgs.push({
            roomid: ws.roomid,
            msg: msgObj
          })
          setValue('uid-' + uid, JSON.stringify(msgs))
        }
      })

    }
  })
  // 客户端断开链接
  ws.on('close', async function () {
    console.log('one client is closed :' + ws.name);

    if (typeof ws.name !== 'undefined') {
      // group[ws.roomid]--
      let uids = JSON.parse(await getValue(prefix + ws.roomid))
      let total = uids.length
      // 广播到其他的客户端
      wss.clients.forEach(function each(client) {
        // 广播给非自己的其他客户端
        if (client !== ws && client.roomid === ws.roomid && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            name: ws.name,
            event: 'logout',
            num: wss.clients.size,
            total
          }));
        }
      });
    }
  })
})
// 心跳连接耽误断点
// const interval = setInterval(function () {
//   // 遍历所有的客户端，发送一个ping/pong消息
//   // 检测是否有返回，如果没有返回或者超时之后，主动断开与客户端的连接
//   wss.clients.forEach(client => {
//     if (client.isAlive === false) {
//       console.log('客户端断开了连接')
//       client.terminate() // 强制断开连接
//       return
//     }
//     client.isAlive = false

//     client.send(JSON.stringify({
//       event: 'heartbeat',
//       msg: 'ping'
//     }))
//   })
// }, timeInterval)

