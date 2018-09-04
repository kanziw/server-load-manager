import SharedResourcesManager from 'shared-resources-manager'
import ServerLoadManager from '../src'
import { LoadData, ServerLoadManagerOptions } from '../src/interfaces'

const count = 1000
const numbers1000to1999 = [ ...Array(count).keys() ].map(val => (val + count).toString())

export class SocketServerLoadManager extends ServerLoadManager {
  public srm: SharedResourcesManager

  constructor(options: ServerLoadManagerOptions = {}) {
    options.type = 'SOCKET'
    super(options)
    this.srm = new SharedResourcesManager({ uniqueKey: 'SRM' })
  }

  protected async postRegister(): Promise<void> {
    await this.srm.add(this.id, numbers1000to1999)
  }

  protected async generateLoadData(serverIds: string[]): Promise<LoadData[]> {
    const loads = await Promise.all(serverIds.map(id => this.srm.sizeOf(id)))
    return serverIds.map((id, idx) => ({ id, load: count - loads[ idx ] }))
  }

  /**
   * only for test case
   * @returns {Promise<void>}
   */
  public reloadLoadData() {
    return this.getServerLoad()
  }

  /**
   * only for test case
   */
  protected postEnd() {
    this.srm.end(true)
  }
}