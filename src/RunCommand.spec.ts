import { expect } from 'chai'
import { RunCommand } from './RunCommand'
import { blue, green, red, yellow } from 'colors/safe'
import path from 'path'
import sinon, { SinonStub, stub } from 'sinon'
import { Config } from './Config'

describe('RunCommand', () => {
    let config: Config
    let command: RunCommand

    let consoleLog: SinonStub
    let consoleError: SinonStub

    beforeEach(() => {
        consoleLog = stub(console, 'log')
        consoleError = stub(console, 'error')

        config = {
            tasks: {
                test: {
                    exec: 'echo Test',
                    color: red,
                    quiet: false
                },
                first: {
                    exec: 'echo First',
                    color: blue,
                    quiet: false
                },
                second: {
                    dependsOn: ['first'],
                    exec: 'echo Second',
                    color: green,
                    quiet: false
                },
                third: {
                    dependsOn: ['first'],
                    exec: 'echo Third',
                    color: green,
                    quiet: false
                },
                fourth: {
                    dependsOn: ['second', 'third'],
                    exec: 'echo Fourth',
                    color: yellow,
                    quiet: false
                }
            },
            colors: true,
            dryRun: false,
            focus: false,
            rootDir: path.resolve('.')
        }

        command = new RunCommand(config)
    })

    it('should execute the given command', async () => {
        await command.perform(['test'])

        expect(command.executions.test).to.be.ok
    })

    it('should not execute the given command in dry-run', async () => {
        config.dryRun = true
        command = new RunCommand(config)

        await command.perform(['test'])

        expect(consoleLog).to.not.have.been.called
    })

    describe('console output', () => {

        it('should write the output to stdout', async () => {
            await command.perform(['test'])

            expect(consoleLog).to.have.been.calledWith(red('test: ') + 'Test')
        })

        it('should write the error output in red color to stderr', async () => {
            config.tasks.test.exec = 'echo Test >&2'
            command = new RunCommand(config)

            await command.perform(['test'])

            expect(consoleLog).to.not.have.been.called
            expect(consoleError).to.have.been.calledWith(red('test: ') + red('Test'))
        })

        it('should write the output without colors', async () => {
            config.colors = false
            command = new RunCommand(config)
            await command.perform(['test'])

            expect(consoleLog).to.have.been.calledWith('test: Test')
        })

        it('should write the error output without colors', async () => {
            config.tasks.test.exec = 'echo Test >&2'
            config.colors = false
            command = new RunCommand(config)
            await command.perform(['test'])

            expect(consoleError).to.have.been.calledWith('test: Test')
        })

        describe('when quiet', () => {
            it('should not write to stdout', async () => {
                config.tasks.test.quiet = true
                command = new RunCommand(config)

                await command.perform(['test'])

                expect(consoleLog).to.not.have.been.called
            })

            it('should still write to stderr', async () => {
                config.tasks.test.quiet = true
                config.tasks.test.exec = 'echo Test >&2'
                config.colors = false
                command = new RunCommand(config)

                await command.perform(['test'])

                expect(consoleError).to.have.been.calledWith('test: Test')
            })
        })
    })

    describe('with dependency', () => {
        it('should execute first then second task', async () => {
            await command.perform(['second'])

            expect(consoleLog).to.have.been.calledWith(`${blue('first: ')}First`)
                .subsequently.calledWith(`${green('second: ')}Second`)
        })

        it('should not execute the second task if the first fails', async () => {
            config.tasks.first.exec = 'unknown-not-found-command'
            config.colors = false
            command = new RunCommand(config)

            await command.perform(['second']).should.be.rejected

            expect(consoleError).to.have.been.calledWith(sinon.match(/first: \/bin\/sh: .*unknown-not-found-command.*/))
            expect(consoleLog).to.not.have.been.called
        })

        it('should execute multiple refs to the same task one once', async () => {
            config.colors = false
            command = new RunCommand(config)

            await command.perform(['fourth'])

            expect(consoleLog).to.have.callCount(4)
            expect(consoleLog).to.have.been.calledWith('first: First')
                .subsequently.have.been.calledWith(sinon.match('second: Second').or(sinon.match('third: Third')))
                .subsequently.have.been.calledWith(sinon.match('second: Second').or(sinon.match('third: Third')))
                .subsequently.have.been.calledWith('fourth: Fourth')
        })
    })
})
