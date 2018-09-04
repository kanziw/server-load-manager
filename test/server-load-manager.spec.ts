import { expect } from 'chai'
import SharedResourcesManager from 'shared-resources-manager'
import ServerLoadManager from '../src/index'
import { LoadData, ServerLoadManagerOptions } from '../src/interfaces'
import redis, { RedisClient } from 'redis'

const srm = new SharedResourcesManager({ uniqueKey: 'SRM' })

describe('Core, using SocketServerLoadManager', () => {
  let slm: SocketServerLoadManager
  let client: RedisClient

  before(() => {
    client = redis.createClient()
  })
  beforeEach(async () => {
    await new Promise((resolve, reject) => client.flushall(err => err ? reject(err) : resolve()))
    slm = new SocketServerLoadManager()
  })
  afterEach(() => {
    slm.end(true)
  })
  after(() => {
    srm.end(true)
    client.end(true)
  })

  describe('Register', () => {
    it('should work', async () => {
      expect(slm.loadDataCached).to.be.an.instanceof(Array).lengthOf(0)
      await slm.register()

      expect(slm.loadDataCached).to.be.an.instanceof(Array).lengthOf(1)
      const [ loadData ] = slm.loadDataCached
      expect(loadData.id).to.eql(slm.id)
      expect(loadData.load).to.eql(1000)
    })
  })

  describe('Master and Slave nodes', () => {
    let slm2: SocketServerLoadManager
    let slm3: SocketServerLoadManager
    let managers: SocketServerLoadManager[]

    beforeEach(async () => {
      slm2 = new SocketServerLoadManager()
      slm3 = new SocketServerLoadManager()
      managers = [ slm, slm2, slm3 ]
      await Promise.all(managers.map(m => m.register()))
    })
    afterEach(() => {
      slm2.end(true)
      slm3.end(true)
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
})

const numbers1000to1999 = [ ...Array(1000).keys() ].map(val => (val + 1000).toString())

class SocketServerLoadManager extends ServerLoadManager {
  constructor(options: ServerLoadManagerOptions = {}) {
    options.type = 'SOCKET'
    super(options)
  }

  protected async postRegister(): Promise<void> {
    await srm.add(this.id, numbers1000to1999)
  }

  protected async generateLoadData(serverIds: string[]): Promise<LoadData[]> {
    const loads = await Promise.all(serverIds.map(id => srm.sizeOf(id)))
    return serverIds.map((id, idx) => ({ id, load: loads[ idx ] }))
  }
}
