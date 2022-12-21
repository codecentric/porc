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
            this.write(`Command: "${String(command)}"`, '', 'red', 'err')
            if (command.startsWith('r ')) {
                const search = command.substring(2)
                this.write(`Search: "${String(search)}"`, '', 'red', 'err')
                void this.cmd.restartTask(search).then(() => {
                    closeCommand()
                }).catch((err) => {
                    input.setContent(err.message)
                    setTimeout(() => {
                        closeCommand()
                    }, 2000)
                })
            } else {
                input.setContent(`Unknown command: "${String(command)}"`)
                setTimeout(() => {
                    closeCommand()
                }, 2000)
            }
        })

        input.focus()
        this.screen.render()
    }
}
