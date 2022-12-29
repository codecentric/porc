import blessed from 'reblessed'
import { RunCommand } from './RunCommand'
import { Console } from './Console'
import { Config, Task } from './Config'

export class UI implements Console {
    private readonly screen: any

    private readonly box: any

    private autoScroll = true

    constructor (private readonly cmd: RunCommand, private readonly config: Config) {
        this.screen = blessed.screen({
            smartCSR: true,
            title: 'porc'
        })

        // Create a box perfectly centered horizontally and vertically.
        this.box = blessed.box({
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            scrollable: true,
            alwaysScroll: true,
            tags: true,
            border: {
                type: 'line'
            }
        })

        this.screen.append(this.box)

        this.box.key(['escape', 'q'], () => {
            this.exit()
        })

        this.box.key(['C-c'], () => {
            this.cmd.handleSignal('SIGTERM')
        })

        this.box.key(['tab'], () => {
            this.write('\n=== Process Status')
            Array.from(this.cmd.executions.values()).forEach(exec => {
                this.write(exec.status, exec.task)
            })
            this.write('==================')
        })

        // Scrolling

        this.box.key(['b'], () => {
            this.scrollBy(-this.box.height + 2)
        })
        this.box.key(['n'], () => {
            this.scrollBy(this.box.height - 2)
        })
        this.box.key(['up'], () => {
            this.scrollBy(-1)
        })
        this.box.key(['down'], () => {
            this.scrollBy(1)
        })
        this.box.key(['g'], () => {
            this.scrollToEnd()
        })

        // Keyboard Help

        this.box.key(['h'], () => {
            // TODO this.showHelp()
        })

        this.box.key([':'], () => {
            this.startCommandInput()
        })

        this.box.focus()

        this.screen.render()
    }

    public async perform (tasks: string[]): Promise<void> {
        this.cmd.console = this
        await this.cmd.perform(tasks)
    }

    public write (data: string, task?: Task, logger: 'out' | 'err' = 'out'): void {
        const { name, color } = task ?? { name: '', color: 'red' }
        const lines = data.split('\n')
        const lastLineIndex = lines.length - 1
        const withoutLastLine = lines[lastLineIndex] === '' ? lines.slice(0, lastLineIndex) : lines
        withoutLastLine.forEach((line: string) => {
            const coloredLine = logger === 'out' ? line : `{red-fg}${line}{/red-fg}`
            this.box.pushLine(name ? `{${color}-fg}${name}: {/${color}-fg}${coloredLine}` : coloredLine)
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

    private startCommandInput (): void {
        this.box.bottom = 1

        const colon = blessed.text({
            parent: this.screen,
            left: 0,
            bottom: 0,
            content: ':'
        })
        const input = blessed.textarea({
            parent: this.screen,
            name: 'command',
            bottom: 0,
            left: 1,
            height: 1,
            width: 'shrink',
            content: ':',
            inputOnFocus: true
        })

        const closeCommand = (): void => {
            this.screen.remove(colon)
            this.screen.remove(input)
            this.box.bottom = 0
            this.box.focus()
            this.screen.render()
        }

        input.key(['escape'], () => {
            closeCommand()
        })

        input.key(['enter'], () => {
            const command = input.getText().trim()
            if (command.startsWith('rs ')) {
                const search = command.substring(3)
                closeCommand()
                void this.cmd.restartTask(search).catch((err) => {
                    this.write(err.message, undefined, 'err')
                })
            } else {
                closeCommand()
                this.write(`Unknown command: "${String(command)}"`, undefined, 'err')
            }
        })

        input.focus()
        this.screen.render()
    }

    public verbose (data: string, task?: Task): void {
        if (this.config.verbose) {
            this.write(data, task, 'err')
        }
    }
}
