import { expect } from 'chai'
import SharedResourcesManager from 'shared-resources-manager'
import ServerLoadManager from '../src/index'
import { LoadData, ServerLoadManagerOptions } from '../src/interfaces'

const srm = new SharedResourcesManager({ uniqueKey: 'SRM' })

describe('Core, using SocketServerLoadManager', () => {
  let slm: SocketServerLoadManager

  beforeEach(() => {
    slm = new SocketServerLoadManager()
  })
  afterEach(() => {
    slm.end(true)
  })
  after(() => {
    srm.end(true)
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
