import { Task } from './config/Config'

export interface Console {
    write: (data: string, task?: Task, logger: 'out' | 'err' = 'out') => void
    verbose: (data: string, task?: Task) => void
}
