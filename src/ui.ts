import blessed from 'reblessed'
import { RunCommand } from './RunCommand'
import { Console } from './Console'
import { COLOR } from './Config'

export class UI implements Console {
    private readonly screen: any

    private readonly box: any

    constructor (private readonly cmd: RunCommand) {
        this.screen = blessed.screen({
            smartCSR: true
        })

        this.screen.title = 'porc'

        // Create a box perfectly centered horizontally and vertically.
        this.box = blessed.box({
            top: '1',
            left: '1',
            width: '100%',
            height: '100%',
            scrollable: true,
            alwaysScroll: true,
            tags: true,
            border: {
                type: 'line'
            },
            style: {
                fg: 'white',
                bg: 'black',
                border: {
                    fg: '#f0f0f0'
                }
            }
        })

        this.screen.append(this.box)

        this.screen.key(['escape', 'q', 'C-c'], () => {
            this.exit()
        })

        this.box.focus()

        this.screen.render()
    }

    public async perform (tasks: string[]): Promise<void> {
        this.cmd.console = this
        return await this.cmd.perform(tasks)
    }

    public write (data: string, name: string, color: COLOR, logger: 'out' | 'err' = 'out'): void {
        const lines = data.split('\n')
        const lastLineIndex = lines.length - 1
        const withoutLastLine = lines[lastLineIndex] === '' ? lines.slice(0, lastLineIndex) : lines
        withoutLastLine.forEach((line: string) => {
            const coloredLine = logger === 'out' ? line : `{red-fg}${line}{/red-fg}`
            this.box.pushLine(`{${color}-fg}${name}: {/${color}-fg}${coloredLine}`)
        })

        // scroll to bottom
        this.box.setScrollPerc(100)

        this.screen.render()
    }

    private exit (): void {
        process.exit(0)
    }
}
