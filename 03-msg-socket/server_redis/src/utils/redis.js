const redis = require('redis')
const bluebird = require('bluebird')
const redisOption = require('../../redis.config')

bluebird.promisifyAll(redis)

const redisClient = redis.createClient(redisOption)

// 对连接信息的监听
redisClient.on('connect', function () {
  console.log('redis连接到了服务器')
})
// 对错误信息的监听
redisClient.on('error', function (err) {
  console.log('redis报了一个错误：' + err)
})
/**
 * setValue 方法
 * @param {string} key 对象的属性
 * @param {string} value 对象的值 JSON.stringify() -> Object
 * @param {*} time 过期时间
 */
const setValue = function (key, value, time) {
  if (time) {
    redisClient.set(key, value, 'EX', time, redis.print)
  } else {
    redisClient.set(key, value, redis.print)
  }

}
/**
 * getValue 方法
 * @param {string} key 
 * @returns 需要对对象形式的值使用JSON.parse()
 */
const getValue = async function (key) {
  return await redisClient.getAsync(key)
}
/**
 * 增加计数
 * @param {string} key 
 * @returns 
 */
const increase = async function (key) {
  return await redisClient.incrAsync(key)
}
/**
 * 减法计数
 * @param {string} key 
 * @returns 
 */
const decrease = async function (key) {
  return await redisClient.decrAsync(key)
}
/**
 * 返回所有相关reg的keys
 * @param {string} reg 定义一个查询的正则表达式
 * @returns 
 */
const getKeys = async function (reg) {
  return await redisClient.keysAsync(reg)
}
/**
 * 检查给定 key 是否存在
 * @param {string} key 
 * @returns 
 */
const existKey = async function (key) {
  return await redisClient.existsAsync(key)
}
/**
 * 删除key
 * @param {string} key 
 * @returns 
 */
const delKey = async function (key) {
  return await redisClient.delAsync(key)
}
module.exports = {
  setValue,
  getValue,
  increase,
  decrease,
  getKeys,
  existKey,
  delKey
}