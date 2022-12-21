import blessed from 'reblessed'
import { RunCommand } from './RunCommand'
import { Console } from './Console'
import { COLOR } from './Config'

export class UI implements Console {
    private readonly screen: any

    private readonly box: any

    private autoScroll = true

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
            }
        })

        this.screen.append(this.box)

        this.screen.key(['escape', 'q'], () => {
            this.exit()
        })

        this.screen.key(['C-c'], () => {
            this.cmd.handleSignal('SIGTERM')
        })

        // Scrolling

        this.screen.key(['b'], () => {
            this.scrollBy(-this.box.height + 2)
        })
        this.screen.key(['n'], () => {
            this.scrollBy(this.box.height - 2)
        })
        this.screen.key(['up'], () => {
            this.scrollBy(-1)
        })
        this.screen.key(['down'], () => {
            this.scrollBy(1)
        })
        this.screen.key(['g'], () => {
            this.scrollToEnd()
        })

        // Keyboard Help

        this.screen.key(['h'], () => {
            // TODO this.showHelp()
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
        if (this.autoScroll) {
            this.box.setScrollPerc(100)
        }

        this.screen.render()
    }

    private exit (): void {
        process.exit(0)
    }

    private scrollBy (lines: number): void {
        if (lines < 0) {
            this.autoScroll = false
        } else if (this.box.getScrollPerc() === 100) {
            this.autoScroll = true
        }
        this.box.scroll(lines)
        this.screen.render()
    }

    private scrollToEnd (): void {
        this.box.setScrollPerc(100)
        this.autoScroll = true
        this.screen.render()
    }
}
