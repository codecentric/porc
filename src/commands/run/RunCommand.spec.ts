import { expect } from 'chai'
import { RunCommand } from './RunCommand'
import path from 'path'
import sinon, { stub } from 'sinon'
import { Config } from '../../config/Config'
import { Console } from '../../Console'

describe('RunCommand', () => {
    let config: Config
    let command: RunCommand

    let console: Console

    beforeEach(() => {
        console = {
            write: stub(),
            verbose: stub()
        }

        config = {
            tasks: {
                test: {
                    name: 'test',
                    exec: 'echo Test',
                    color: 'red',
                    quiet: false,
                    waitFor: {
                        type: 'exit',
                        killSignal: 'SIGTERM'
                    }
                },
                first: {
                    name: 'first',
                    exec: 'echo First',
                    color: 'blue',
                    quiet: false,
                    waitFor: {
                        type: 'exit',
                        killSignal: 'SIGTERM'
                    }

                },
                second: {
                    name: 'second',
                    dependsOn: ['first'],
                    exec: 'echo Second',
                    color: 'green',
                    quiet: false,
                    waitFor: {
                        type: 'exit',
                        killSignal: 'SIGTERM'
                    }

                },
                third: {
                    name: 'third',
                    dependsOn: ['first'],
                    exec: 'echo Third',
                    color: 'green',
                    quiet: false,
                    waitFor: {
                        type: 'exit',
                        killSignal: 'SIGTERM'
                    }
                },
                fourth: {
                    name: 'fourth',
                    dependsOn: ['second', 'third'],
                    exec: 'echo Fourth',
                    color: 'yellow',
                    quiet: false,
                    waitFor: {
                        type: 'exit',
                        killSignal: 'SIGTERM'
                    }
                }
            },
            colors: true,
            theme: 'dark',
            colorPalette: ['red', 'green', 'blue', 'yellow'],
            dryRun: false,
            focus: false,
            verbose: true,
            rootDir: path.resolve('.')
        }

        command = new RunCommand(config, console)
        command.console = console
    })

    it('should execute the given command', async () => {
        await command.perform(['test'])

        expect(command.executions.get('test')).to.be.ok
    })

    it('should not execute the given command in dry-run', async () => {
        config.dryRun = true
        command = new RunCommand(config, console)

        await command.perform(['test'])

        expect(console.write).to.not.have.been.called
    })

    describe('console output', () => {
        it('should write the output to stdout', async () => {
            await command.perform(['test'])

            expect(console.write).to.have.been.calledWith('Test\n', config.tasks.test)
        })

        it('should write the error output in red color to stderr', async () => {
            config.tasks.test.exec = 'echo Test >&2'
            command = new RunCommand(config, console)

            await command.perform(['test'])

            expect(console.write).to.have.been.calledWith('Test\n', config.tasks.test, 'err')
        })

        describe('when quiet', () => {
            it('should not write to stdout', async () => {
                config.tasks.test.quiet = true
                command = new RunCommand(config, console)

                await command.perform(['test'])

                expect(console.write).to.not.have.been.called
            })

            it('should still write to stderr', async () => {
                config.tasks.test.quiet = true
                config.tasks.test.exec = 'echo Test >&2'
                config.colors = false
                command = new RunCommand(config, console)

                await command.perform(['test'])

                expect(console.write).to.have.been.calledWith('Test\n', config.tasks.test, 'err')
            })
        })
    })

    describe('with dependency', () => {
        it('should execute first then second task', async () => {
            await command.perform(['second'])

            expect(console.write).to.have.been.calledWith('First\n', config.tasks.first)
                .subsequently.calledWith('Second\n', config.tasks.second)
        })

        it('should not execute the second task if the first fails', async () => {
            config.tasks.first.exec = 'unknown-not-found-command'
            config.colors = false
            command = new RunCommand(config, console)

            await command.perform(['second'])

            expect(console.write).to.have.been.calledWith(sinon.match(/\/bin\/sh: .*unknown-not-found-command.*/), config.tasks.first, 'err')
        })

        it('should execute multiple refs to the same task one once', async () => {
            config.colors = false
            command = new RunCommand(config, console)

            await command.perform(['fourth'])

            expect(console.write).to.have.callCount(4)
            expect(console.write).to.have.been.calledWith('First\n', config.tasks.first)
                .subsequently.have.been.calledWith(sinon.match('Second\n').or(sinon.match('Third\n')), sinon.match(config.tasks.second).or(sinon.match(config.tasks.third)))
                .subsequently.have.been.calledWith(sinon.match('Second\n').or(sinon.match('Third\n')), sinon.match(config.tasks.second).or(sinon.match(config.tasks.third)))
                .subsequently.have.been.calledWith('Fourth\n', config.tasks.fourth)
        })
    })
})
