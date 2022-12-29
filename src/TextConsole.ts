import chalk, { Chalk } from 'chalk'
import { Console } from './Console'
import { Config, Task } from './Config'

const { black, blue, cyan, gray, green, magenta, red, white, yellow } = chalk

const TEXT_COLORS: Record<string, Chalk> = {
    red,
    green,
    yellow,
    blue,
    magenta,
    cyan,
    gray,
    black,
    white
} as const

export class TextConsole implements Console {
    constructor (private readonly colors: boolean, private readonly config: Config) {}

    public write (data: string, task?: Task, logger: 'out' | 'err' = 'out'): void {
        const { name, color } = task ?? { name: '', color: 'red' }
        const lines = data.split('\n')
        const lastLineIndex = lines.length - 1
        const withoutLastLine = lines[lastLineIndex] === '' ? lines.slice(0, lastLineIndex) : lines
        const log = logger === 'out' ? console.log : console.error
        const chalkColor = TEXT_COLORS[color]
        withoutLastLine.forEach((line: string) => {
            if (this.colors) {
                const coloredLine = logger === 'out' ? line : chalk.red(line)
                log(name ? chalkColor(name + ': ') + coloredLine : coloredLine)
            } else {
                log(name ? `${name}: ${line}` : line)
            }
        })
    }

    public verbose (data: string, task?: Task): void {
        if (this.config.verbose) {
            this.write(data, task, 'err')
        }
    }
}
