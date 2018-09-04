import { expect } from 'chai'
import redis, { RedisClient } from 'redis'
import { SocketServerLoadManager } from './helper'

describe('Core, using SocketServerLoadManager', () => {
  const client: RedisClient = redis.createClient()

  beforeEach(() => {
    return new Promise((resolve, reject) => {
      client.flushall(err => err ? reject(err) : resolve())
    })
  })
  after(() => {
    client.end(true)
  })

  describe('Register', () => {
    let slm: SocketServerLoadManager
    beforeEach(() => {
      slm = new SocketServerLoadManager()
    })
    afterEach(() => {
      slm.end(true)
    })

    it('should work', async () => {
      expect(slm.loadDataCached).to.be.an.instanceof(Array).lengthOf(0)
      await slm.register()

      expect(slm.loadDataCached).to.be.an.instanceof(Array).lengthOf(1)
      const [ loadData ] = slm.loadDataCached
      expect(loadData.id).to.eql(slm.id)
      expect(loadData.load).to.eql(0)
    })
  })

  describe('Unregister', () => {
    let slm1: SocketServerLoadManager
    let slm2: SocketServerLoadManager
    let managers: SocketServerLoadManager[]

    beforeEach(async () => {
      slm1 = new SocketServerLoadManager()
      slm2 = new SocketServerLoadManager()
      managers = [ slm1, slm2 ]
      await Promise.all(managers.map(m => m.register()))
      await Promise.all(managers.map(m => m.reloadLoadData()))
    })
    afterEach(() => managers.forEach(m => m.end(true)))

    it('should work', async () => {
      expect(slm1.amIMaster()).to.eql(true)
      expect(slm1.loadDataCached).to.be.an.instanceof(Array).lengthOf(2)
      expect(slm2.loadDataCached).to.be.an.instanceof(Array).lengthOf(2)

      await slm2.unregister()
      await slm1.reloadLoadData()
      await slm2.reloadLoadData()

      expect(slm1.loadDataCached).to.be.an.instanceof(Array).lengthOf(1)
      expect(slm1.loadDataCached[ 0 ].id).to.eql(slm1.id)
      expect(slm2.loadDataCached).to.be.an.instanceof(Array).lengthOf(1)
      expect(slm2.loadDataCached[ 0 ].id).to.eql(slm1.id)
    })
  })

  describe('Master and Slave nodes', () => {
    let slm1: SocketServerLoadManager
    let slm2: SocketServerLoadManager
    let slm3: SocketServerLoadManager
    let managers: SocketServerLoadManager[]

    beforeEach(async () => {
      slm1 = new SocketServerLoadManager()
      slm2 = new SocketServerLoadManager()
      slm3 = new SocketServerLoadManager()
      managers = [ slm1, slm2, slm3 ]
      await Promise.all(managers.map(m => m.register()))
      await Promise.all(managers.map(m => m.reloadLoadData()))
    })
    afterEach(() => {
      managers.forEach(m => m.end(true))
    })

    it('the leading ID should be master', () => {
      const [ masterManagerId ] = managers.map(m => m.id).sort()

      const masterNodes = managers.filter(m => m.amIMaster())
      const slaveNodes = managers.filter(m => !m.amIMaster())

      expect(masterNodes).to.be.an.instanceof(Array).lengthOf(1)
      expect(slaveNodes).to.be.an.instanceof(Array).lengthOf(2)

      expect(masterNodes[ 0 ].id).to.eql(masterManagerId)
      expect(slaveNodes.map(m => m.id).includes(masterManagerId)).to.eql(false)
    })
  })

  describe('GetIdleServer', () => {
    let slm1: SocketServerLoadManager
    let slm2: SocketServerLoadManager
    let managers: SocketServerLoadManager[]

    beforeEach(async () => {
      slm1 = new SocketServerLoadManager()
      slm2 = new SocketServerLoadManager()
      managers = [ slm1, slm2 ]
      await Promise.all(managers.map(m => m.register()))
    })
    afterEach(() => {
      managers.forEach(m => m.end(true))
    })

    it('should get the lowest load server', async () => {
      expect(slm1.load).to.eql(0)
      expect(slm2.load).to.eql(0)

      await slm1.srm.take(slm1.id, 10)
      await slm1.reloadLoadData()
      await slm2.reloadLoadData()

      expect(slm1.load).to.eql(10)
      expect(slm2.load).to.eql(0)

      expect(slm1.getIdleServer()).to.eql(slm2.id)
      expect(slm2.getIdleServer()).to.eql(slm2.id)
    })
  })
})
