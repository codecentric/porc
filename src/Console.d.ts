import { COLOR } from './Config'

export interface Console {
    write: (data: string, name: string, color: COLOR, logger: 'out' | 'err' = 'out') => void
}
