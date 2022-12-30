import { ChildProcess } from 'child_process'
import { Console } from '../../Console'
import { Config, isWaitForConsole, isWaitForExit, isWaitForMs, Task } from '../../config/Config'
import { exec } from 'child-process-promise'

type ExecutionStatus = 'starting' | 'failed' | 'ready' | 'done'

export class InterruptedError extends Error {
}

export class Execution {
    public status: ExecutionStatus
    public waitForPromise: Promise<unknown>
    public exitPromise?: Promise<unknown>
    public childProcess?: ChildProcess
    public interrupted = false

    constructor (
        private readonly console: Console,
        private readonly config: Config,
        public readonly task: Task
    ) {
        if (!task.exec || config.dryRun) {
            this.waitForPromise = Promise.resolve()
            this.exitPromise = Promise.resolve()
            this.status = 'done'
            return
        }

        this.console.verbose(`== Executing "${task.exec}"`, task)

        this.status = 'starting'
        const waitFor = task.waitFor

        const exitTimeout = isWaitForExit(waitFor) ? waitFor.timeout : undefined
        if (exitTimeout) {
            this.console.verbose(`== Adding timeout of ${exitTimeout}ms waiting for exit"`, task)
        }

        const childProcessPromise = exec(task.exec, {
            shell: this.config.shell,
            cwd: task.cwd,
            // wait for exit here
            timeout: exitTimeout,
            killSignal: waitFor.killSignal,
            windowsHide: true
        })
        const childProcess = childProcessPromise.childProcess

        let resolvedOrRejected = false
        this.waitForPromise = new Promise((resolve, reject) => {
            if ((isWaitForConsole(waitFor) && waitFor.text) && waitFor.timeout !== undefined) {
                this.console.verbose(`== Adding timeout of ${waitFor.timeout}ms waiting for output`, task)
                setTimeout(() => {
                    if (!resolvedOrRejected) {
                        resolvedOrRejected = true
                        this.console.verbose(`== Timed out after ${waitFor.timeout!}ms waiting for output`, task)
                        // TODO maybe still wait for the process to terminate with outputs here.
                        // TODO in that case, we might need a second timeout for logging a stale process and/or SIGKILLing it
                        childProcess.kill(waitFor.killSignal)
                        reject(new Error(`Timeout running task "${task.name}". Killed via ${waitFor.killSignal}.`))
                    }
                }, waitFor.timeout)
            } else if (isWaitForMs(waitFor)) {
                this.console.verbose(`== Adding delay of ${waitFor.delay}ms`, task)
                setTimeout(() => {
                    if (!resolvedOrRejected) {
                        resolvedOrRejected = true
                        this.console.verbose(`== Continuing after ${waitFor.delay}ms waiting for output`, task)
                        // TODO maybe still wait for the process to terminate with outputs here.
                        // TODO in that case, we might need a second timeout for logging a stale process and/or SIGKILLing it
                        resolve(undefined)
                    }
                }, waitFor.delay)
            }
            childProcess.stdout!.on('data', (data: any) => {
                if (typeof data === 'string') {
                    if (!task.quiet) {
                        this.console.write(data, task)
                    }
                    if (!resolvedOrRejected && isWaitForConsole(waitFor) && data?.includes(waitFor.text)) {
                        resolvedOrRejected = true
                        resolve(undefined)
                    }
                } else {
                    this.console.write(`== Unreadable data of type ${typeof data}`, task)
                }
            })
            childProcess.stderr!.on('data', (data: any) => {
                if (typeof data === 'string') {
                    this.console.write(data, task, 'err')
                    if (!resolvedOrRejected && isWaitForConsole(waitFor) && data?.includes(waitFor.text)) {
                        resolvedOrRejected = true
                        resolve(undefined)
                    }
                } else {
                    this.console.write(`== Unreadable data of type ${typeof data}`, task)
                }
            })

            this.exitPromise = childProcessPromise.then(() => {
                delete this.childProcess
                if (this.status !== 'failed') {
                    this.updateStatus('done')
                }
                if (!resolvedOrRejected) {
                    resolvedOrRejected = true
                    resolve(undefined)
                }
            }, (err) => {
                delete this.childProcess
                this.console.write(`== Task exited with error: ${String(err.message)}`, task, 'err')
                this.updateStatus(this.status === 'starting' ? 'failed' : 'done')
                if (!resolvedOrRejected) {
                    resolvedOrRejected = true
                    if (this.interrupted) {
                        this.console.write('== Task has been interrupted', task, 'err')
                        reject(new InterruptedError('Process has been interrupted'))
                    } else {
                        reject(err)
                    }
                }
            })
        }).then(() => {
            if (this.status === 'starting') {
                this.updateStatus('ready')
            }
        }).catch(() => {
            this.updateStatus('failed')
        })
    }

    public sendSignal (signal: 'SIGTERM' | 'SIGINT' | 'SIGQUIT' | 'SIGKILL'): void {
        this.console.verbose(`== Sent ${signal} to task ${this.task.name}`, this.task)
        this.interrupted = true
        this.childProcess?.kill(signal)
    }

    private updateStatus (newStatus: ExecutionStatus): void {
        this.console.verbose(`== Status changed from ${this.status} to ${newStatus}`, this.task)
        this.status = newStatus
    }
}
