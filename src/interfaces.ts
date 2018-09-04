import { ClientOpts } from 'redis'

export interface ServerLoadManagerOptions extends ClientOpts {
  SLMKey?: string
  type?: string
  interval?: number
}

export interface LoadData {
  id: string
  load: number
}
