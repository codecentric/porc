import { expect } from 'chai'
import { RunCommand } from './RunCommand'
import path from 'path'
import sinon, { stub } from 'sinon'
import { Config } from './Config'
import { Console } from './Console'

describe('RunCommand', () => {
    let config: Config
    let command: RunCommand

    let console: Console

    beforeEach(() => {
        console = {
            write: stub()
        }

        config = {
            tasks: {
                test: {
                    exec: 'echo Test',
                    color: 'red',
                    quiet: false
                },
                first: {
                    exec: 'echo First',
                    color: 'blue',
                    quiet: false
                },
                second: {
                    dependsOn: ['first'],
                    exec: 'echo Second',
                    color: 'green',
                    quiet: false
                },
                third: {
                    dependsOn: ['first'],
                    exec: 'echo Third',
                    color: 'green',
                    quiet: false
                },
                fourth: {
                    dependsOn: ['second', 'third'],
                    exec: 'echo Fourth',
                    color: 'yellow',
                    quiet: false
                }
            },
            colors: true,
            theme: 'dark',
            colorPalette: ['red', 'green', 'blue', 'yellow'],
            dryRun: false,
            focus: false,
            rootDir: path.resolve('.')
        }

        command = new RunCommand(config, console)
        command.console = console
    })

    it('should execute the given command', async () => {
        await command.perform(['test'])

        expect(command.executions.test).to.be.ok
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

            expect(console.write).to.have.been.calledWith('Test\n', 'test', 'red')
        })

        it('should write the error output in red color to stderr', async () => {
            config.tasks.test.exec = 'echo Test >&2'
            command = new RunCommand(config, console)

            await command.perform(['test'])

            expect(console.write).to.have.been.calledWith('Test\n', 'test', 'red', 'err')
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

                expect(console.write).to.have.been.calledWith('Test\n', 'test', 'red', 'err')
            })
        })
    })

    describe('with dependency', () => {
        it('should execute first then second task', async () => {
            await command.perform(['second'])

            expect(console.write).to.have.been.calledWith('First\n', 'first', 'blue')
                .subsequently.calledWith('Second\n', 'second', 'green')
        })

        it('should not execute the second task if the first fails', async () => {
            config.tasks.first.exec = 'unknown-not-found-command'
            config.colors = false
            command = new RunCommand(config, console)

            await command.perform(['second']).should.be.rejected

            expect(console.write).to.have.been.calledWith(sinon.match(/\/bin\/sh: .*unknown-not-found-command.*/), 'first', 'blue', 'err')
        })

        it('should execute multiple refs to the same task one once', async () => {
            config.colors = false
            command = new RunCommand(config, console)

            await command.perform(['fourth'])

            expect(console.write).to.have.callCount(4)
            expect(console.write).to.have.been.calledWith('First\n', 'first')
                .subsequently.have.been.calledWith(sinon.match('Second\n').or(sinon.match('Third\n')), sinon.match('second').or(sinon.match('third')))
                .subsequently.have.been.calledWith(sinon.match('Second\n').or(sinon.match('Third\n')), sinon.match('second').or(sinon.match('third')))
                .subsequently.have.been.calledWith('Fourth\n', 'fourth')
        })
    })
})
