import { createConfiguration } from './Config'
import { expect } from 'chai'

describe('Config', () => {
    describe('createConfiguration', () => {
        it('should compute a runtime config from the .porcrc', async () => {
            expect(await createConfiguration({})).to.be.like({
                $schema: './porc-schema.json',
                colorPalette: [
                    'red',
                    'green',
                    'yellow',
                    'magenta',
                    'cyan',
                    'gray',
                    'white'
                ],
                colors: true,
                dryRun: false,
                focus: true,
                rootDir: /\/.*/,
                tasks: {
                    failingWithTimeout: {
                        name: 'failingWithTimeout',
                        cwd: /\/.*/,
                        exec: 'echo Test; sleep 2; echo Done',
                        quiet: false,
                        waitFor: {
                            type: 'console',
                            text: 'Done',
                            timeout: 500,
                            killSignal: 'SIGTERM'
                        }
                    },
                    first: {
                        name: 'first',
                        cwd: /\/.*/,
                        dependsOn: [
                            'shared'
                        ],
                        exec: 'echo Test; sleep 2; echo Done >&2; echo Done 2',
                        quiet: true,
                        waitFor: {
                            type: 'console',
                            text: 'Test',
                            timeout: 500,
                            killSignal: 'SIGTERM'
                        }
                    },
                    next: {
                        name: 'next',
                        cwd: /\/.*/,
                        dependsOn: [
                            'first',
                            'second'
                        ],
                        quiet: false,
                        waitFor: {
                            type: 'exit',
                            timeout: 0,
                            killSignal: 'SIGTERM'
                        }
                    },
                    second: {
                        name: 'second',
                        cwd: /\/.*\/lib/,
                        dependsOn: [
                            'shared'
                        ],
                        exec: 'ls',
                        quiet: false,
                        waitFor: {
                            type: 'exit',
                            timeout: 0,
                            killSignal: 'SIGTERM'
                        }
                    },
                    shared: {
                        name: 'shared',
                        cwd: /\/.*/,
                        exec: 'echo Shared',
                        quiet: false,
                        waitFor: {
                            type: 'exit',
                            timeout: 0,
                            killSignal: 'SIGTERM'
                        }
                    }
                },
                verbose: false
            })
        })
    })
})
