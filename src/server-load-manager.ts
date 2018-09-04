import assert from 'assert'
import debug from 'debug'
import objectid from 'objectid'
import redis, { RedisClient } from 'redis'
import { LoadData, ServerLoadManagerOptions } from './interfaces'

export { LoadData, ServerLoadManagerOptions }

const logger = debug('SLM')

export default class ServerLoadManager {
  public readonly SLMKey: string
  public readonly type: string
  private readonly client: RedisClient
  private readonly id: string

  private loadDataCached: LoadData[]

  constructor(options: ServerLoadManagerOptions, client?: RedisClient) {
    const { port = 6379, host = '127.0.0.1', type = '__MISSING', SLMKey = '' } = options
    assert(type && type !== '__MISSING', 'Missing type.')

    this.client = client instanceof RedisClient ? client : redis.createClient(port, host)
    this.SLMKey = SLMKey || 'SLM'
    this.type = type

    this.loadDataCached = []
    this.id = objectid().toString()
  }

  public async register(): Promise<void> {
    await new Promise((resolve, reject) => {
      this.client.sadd(this.getKey('SET'), this.id, (err, ret) => {
        return err ? reject(err) : resolve(ret)
      })
    })

    await this.getServerLoad()
  }

  public end(flush: boolean): void {
    this.client.end(flush)
  }

  private async getServerLoad(): Promise<void> {
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

    const data = serverIds.map(id => ({ id, load: 100 }))
    this.log('>> UPDATE THIS DATA', data)
    await new Promise((resolve, reject) => {
      this.client.set(this.getKey('DATA'), global.JSON.stringify(data), (err, ret) => {
        return err ? reject(err) : resolve(ret)
      })
    })
    this.log('---UPDATE_SERVER_LOAD')
  }

  private amIMaster(): boolean {
    return this.loadDataCached.map(loadData => loadData.id).sort()[ 0 ] === this.id
  }

  private log(...msg: any[]): void {
    logger(`[${this.type}:${this.id}]`, ...msg)
  }

  private getKey(postfix: string): string {
    return `${this.prefix}:${postfix}`
  }

  private get prefix() {
    return `${this.SLMKey}:${this.type}`
  }
}
