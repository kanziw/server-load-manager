// import { expect } from 'chai'
import redis, { RedisClient } from 'redis'
import ServerLoadManager from '../src/index'

describe('Core', () => {
  const type = 'SOCKET'
  let slm: ServerLoadManager
  let client: RedisClient

  before(() => {
    slm = new ServerLoadManager({ type })
    client = redis.createClient()
  })
  afterEach(() => {
    return new Promise((resolve, reject) => {
      client.flushall(err => (err ? reject(err) : resolve()))
    })
  })
  after(() => {
    slm.end(true)
    client.end(true)
  })

  describe('Cache load data', () => {
    it('simple', async() => {
      await slm.register()
    })
  })
})
