import assert from 'assert'
import debug from 'debug'
import objectId from 'objectid'
import redis, { RedisClient } from 'redis'
import { LoadData, ServerLoadManagerOptions } from './interfaces'

export { LoadData, ServerLoadManagerOptions }

const logger = debug('SLM')

export default class ServerLoadManager {
  public readonly SLMKey: string
  public readonly type: string
  public readonly id: string
  protected readonly client: RedisClient

  public loadDataCached: LoadData[]

  constructor(options: ServerLoadManagerOptions, client?: RedisClient) {
    const { port = 6379, host = '127.0.0.1', type = '__MISSING', SLMKey = '' } = options
    assert(type && type !== '__MISSING', 'Missing type.')

    this.client = client instanceof RedisClient ? client : redis.createClient(port, host)
    this.SLMKey = SLMKey || 'SLM'
    this.type = type

    this.loadDataCached = []
    this.id = objectId().toString()
  }

  protected async postRegister(): Promise<any> {
    this.overrideRequired('postRegister: () => Promise<any>')
  }

  protected async generateLoadData(serverIds: string[]): Promise<LoadData[]> {
    this.overrideRequired('generateLoadData: string[] => Promise<LoadData[]>')
    return []
  }

  public async register(): Promise<void> {
    await new Promise((resolve, reject) => {
      this.client.sadd(this.getKey('SET'), this.id, (err, ret) => {
        return err ? reject(err) : resolve(ret)
      })
    })

    await this.postRegister()
    await this.getServerLoad()
  }

  public getIdleServer(): string | null {
    const idleServerInfo = this.loadDataCached.sort((loadData1, loadData2) => loadData1.load - loadData2.load)[ 0 ]
    return idleServerInfo ? idleServerInfo.id : null
  }

  public end(flush: boolean = false): void {
    this.client.end(flush)
    this.postEnd()
  }

  protected postEnd(): void {
    //
  }

  protected async getServerLoad(): Promise<void> {
    this.log('+++GET_SERVER_LOAD')
    const data = await new Promise((resolve, reject) => {
      this.client.get(this.getKey('DATA'), (err, ret) => {
        return err ? reject(err) : resolve(ret)
      })
    }) as string

    this.loadDataCached = global.JSON.parse(data) as LoadData[] || []
    this.log('>> LOAD DATA CACHED', this.loadDataCached)

    if (this.loadDataCached.length === 0 || this.amIMaster()) {
      await this.updateLoadData()
    }

    this.log('---GET_SERVER_LOAD')
    // setTimeout(this.getServerLoad, 1000)
  }

  private async updateLoadData() {
    this.log('+++UPDATE_SERVER_LOAD')
    const serverIds = await new Promise((resolve, reject) => {
      this.client.smembers(this.getKey('SET'), (err, ret) => {
        return err ? reject(err) : resolve(ret)
      })
    }) as string[]
    this.log('>> SERVER IDS', serverIds)

    const data = await this.generateLoadData(serverIds)
    this.loadDataCached = data

    this.log('>> UPDATE THIS DATA', data)
    await new Promise((resolve, reject) => {
      this.client.set(this.getKey('DATA'), global.JSON.stringify(data), (err, ret) => {
        return err ? reject(err) : resolve(ret)
      })
    })
    this.log('---UPDATE_SERVER_LOAD')
  }

  public amIMaster(): boolean {
    return this.loadDataCached.map(loadData => loadData.id).sort()[ 0 ] === this.id
  }

  public get load(): number {
    return this.loadInfo.load
  }

  private get loadInfo(): LoadData {
    return this.loadDataCached.find(loadData => loadData.id === this.id) || {
      id: this.id,
      load: Number.POSITIVE_INFINITY,
    }
  }

  private overrideRequired(fnDesc: string) {
    assert(false, `${this.prefixLogger} [${fnDesc}] OVERRIDE REQUIRED!`)
  }

  private log(...msg: any[]): void {
    logger(this.prefixLogger, ...msg)
  }

  private getKey(postfix: string): string {
    return `${this.prefix}:${postfix}`
  }

  private get prefix(): string {
    return `${this.SLMKey}:${this.type}`
  }

  private get prefixLogger(): string {
    return `[${this.type}:${this.id}]`
  }
}
