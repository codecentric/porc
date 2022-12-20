import { createConfiguration } from './Config'
import { expect } from 'chai'

describe('Config', () => {
    describe('createConfiguration', () => {
        it('should compute a runtime config from the .porcrc', async () => {
            expect(await createConfiguration({})).to.be.like({
                $schema: './porc-schema.json',
                colors: true,
                dryRun: false,
                focus: true,
                rootDir: /\/.*/,
                tasks: {
                    failingWithTimeout: {
                        cwd: /\/.*/,
                        exec: 'echo Test; sleep 2; echo Done',
                        quiet: false,
                        waitFor: {
                            killSignal: 'SIGTERM',
                            stdout: 'Done',
                            timeout: 500
                        }
                    },
                    first: {
                        cwd: /\/.*/,
                        dependsOn: [
                            'shared'
                        ],
                        exec: 'echo Test >&2; sleep 2; echo Done',
                        quiet: true,
                        waitFor: {
                            killSignal: 'SIGTERM',
                            stderr: 'Test',
                            timeout: 500
                        }
                    },
                    next: {
                        cwd: /\/.*/,
                        dependsOn: [
                            'first',
                            'second'
                        ],
                        quiet: false,
                        waitFor: undefined
                    },
                    second: {
                        cwd: /\/.*\/lib/,
                        dependsOn: [
                            'shared'
                        ],
                        exec: 'ls',
                        quiet: false,
                        waitFor: undefined
                    },
                    shared: {
                        cwd: /\/.*/,
                        exec: 'echo Shared',
                        quiet: false,
                        waitFor: undefined
                    }
                },
                verbose: false
            })
        })
    })
})
