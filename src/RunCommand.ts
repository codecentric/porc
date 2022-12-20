import { COLOR, Config, Task } from './Config'
import { exec } from 'child-process-promise'
import chalk from 'chalk'
import { ChildProcess } from 'child_process'

interface Execution {
    task: Task
    childProcess?: ChildProcess
    exitPromise: Promise<unknown>
    waitForPromise: Promise<unknown>
}

class InterruptedError extends Error {
    constructor (message: string, private readonly taskName: string) {
        super(message)
    }
}

export class RunCommand {
    public executions: Record<string, Execution> = {}

    private interrupted = false

    constructor (private readonly config: Config) {}

    public async perform (tasks: string[]): Promise<void> {
        this.checkThatTasksExist(tasks)

        this.propagateTerminateSignalsToChildProcesses()

        try {
            await this.runTasksInParallel(tasks)
            await this.waitForAllProcessesToExit()
        } catch (err) {
            if (!(err instanceof InterruptedError)) {
                throw err
            }
        }
    }

    private propagateTerminateSignalsToChildProcesses (): void {
        process.on('SIGINT', () => {
            this.handleSignal('SIGINT')
        })
        process.on('SIGQUIT', () => {
            this.handleSignal('SIGQUIT')
        })
        process.on('SIGTERM', () => {
            this.handleSignal('SIGTERM')
            process.exit(137)
        })
    }

    private async runTasksInParallel (tasks: string[]): Promise<void> {
        // run all tasks in parallel, recursively going through dependencies
        await Promise.all(tasks.map(async task => await this.runTask(task)))
    }

    private checkThatTasksExist (tasks: string[]): void {
        tasks.forEach(task => this.findTask(task))
    }

    private async waitForAllProcessesToExit (): Promise<void> {
        await Promise.all(Object.values(this.executions).map(async exec => await exec.exitPromise))
    }

    public handleSignal (signal: 'SIGTERM' | 'SIGINT' | 'SIGQUIT'): void {
        if (!this.interrupted) {
            this.interrupted = true
            this.sendSignalToChildProcesses(signal)
        } else {
            this.sendSignalToChildProcesses('SIGKILL')
        }
    }

    private sendSignalToChildProcesses (signal: 'SIGTERM' | 'SIGINT' | 'SIGQUIT' | 'SIGKILL'): void {
        Object.entries(this.executions).forEach(([name, exec]) => {
            this.verbose(`Sent ${signal} to task ${name}`, name, exec.task.color)
            exec.childProcess?.kill(signal)
        })
    }

    private async runTask (task: string): Promise<void> {
        const taskConfig = this.findTask(task)

        if (taskConfig.dependsOn?.length) {
            await this.runTasksInParallel(taskConfig.dependsOn)
            this.verbose(`== Successfully executed dependent tasks ${(taskConfig.dependsOn || []).join(',')}`, task, taskConfig.color)
        }

        let execution = this.executions[task]
        if (!execution) {
            execution = this.executeTask(task, taskConfig)
            this.executions[task] = execution
        }
        await execution.waitForPromise
    }

    private executeTask (name: string, taskConfig: Task): Execution {
        const statement = taskConfig.exec
        if (!statement) {
            return this.executeNothing(taskConfig)
        }
        return this.executeStatement(statement, name, taskConfig)
    }

    private executeStatement (statement: string, name: string, taskConfig: Task): Execution {
        this.verbose(`== Executing "${statement}"`, name, taskConfig.color)
        if (this.config.dryRun) {
            return this.executeNothing(taskConfig)
        }
        const exitTimeout = (taskConfig.waitFor?.stderr ?? taskConfig.waitFor?.stdout) ? 0 : (taskConfig.waitFor?.timeout ?? 0)
        if (exitTimeout) {
            this.verbose(`== Adding timeout of ${taskConfig.waitFor!.timeout!}ms waiting for exit"`, name, taskConfig.color)
        }

        const exitPromise = exec(statement, {
            shell: this.config.shell,
            cwd: taskConfig.cwd,
            // wait for exit here
            timeout: exitTimeout,
            killSignal: (taskConfig.waitFor != null) ? taskConfig.waitFor.killSignal : 'SIGTERM'
        })
        const childProcess = exitPromise.childProcess

        let resolvedOrRejected = false
        const waitForPromise = new Promise((resolve, reject) => {
            if ((taskConfig.waitFor?.stdout ?? taskConfig.waitFor?.stderr) && taskConfig.waitFor?.timeout) {
                this.verbose(`== Adding timeout of ${taskConfig.waitFor.timeout}ms waiting for output"`, name, taskConfig.color)
                setTimeout(() => {
                    if (!resolvedOrRejected) {
                        resolvedOrRejected = true
                        this.verbose(`== Timed out after ${taskConfig.waitFor!.timeout!}ms waiting for output"`, name, taskConfig.color)
                        // TODO maybe still wait for the process to terminate with outputs here.
                        // TODO in that case, we might need a second timeout for logging a stale process and/or SIGKILLing it
                        exitPromise.childProcess.kill(taskConfig.waitFor!.killSignal)
                        reject(new Error(`Timeout running task "${name}". Killed via ${taskConfig.waitFor!.killSignal}.`))
                    }
                }, taskConfig.waitFor.timeout)
            }
            exitPromise.childProcess.stdout?.on('data', (data: any) => {
                if (typeof data === 'string') {
                    if (!taskConfig.quiet) {
                        this.writeToConsole(data, name, taskConfig.color)
                    }
                    if (!resolvedOrRejected && taskConfig.waitFor?.stdout && data?.includes(taskConfig.waitFor.stdout)) {
                        resolvedOrRejected = true
                        resolve(undefined)
                    }
                }
            })
            exitPromise.childProcess.stderr?.on('data', (data: any) => {
                this.writeToConsole(data, name, taskConfig.color, 'err')
                if (!resolvedOrRejected && taskConfig.waitFor?.stderr && data?.includes(taskConfig.waitFor.stderr)) {
                    resolvedOrRejected = true
                    resolve(undefined)
                }
            })
            exitPromise.then(() => {
                delete this.executions[name]?.childProcess
                if (!resolvedOrRejected) {
                    resolve(undefined)
                }
            }).catch((err) => {
                if (!resolvedOrRejected) {
                    if (this.interrupted) {
                        this.writeToConsole('Task has been interrupted', name, taskConfig.color, 'err')
                        reject(new InterruptedError('Process has beeen interrupted', name))
                    } else {
                        reject(err)
                    }
                }
            })
        })
        return {
            task: taskConfig,
            childProcess,
            exitPromise,
            waitForPromise
        }
    }

    private executeNothing (task: Task): Execution {
        return {
            task,
            childProcess: undefined,
            exitPromise: Promise.resolve(),
            waitForPromise: Promise.resolve()
        }
    }

    private findTask (task: string): Task {
        const taskConfig = this.config.tasks[task]
        if (!taskConfig) {
            throw new Error(`Missing task ${task}`)
        }
        return taskConfig
    }

    private verbose (text: string, taskName: string, color: COLOR): void {
        if (this.config.verbose) {
            this.writeToConsole(text, taskName, color)
        }
    }

    private writeToConsole (data: string, name: string, color: COLOR, logger: 'out' | 'err' = 'out'): void {
        const lines = data.split('\n')
        const lastLineIndex = lines.length - 1
        const withoutLastLine = lines[lastLineIndex] === '' ? lines.slice(0, lastLineIndex) : lines
        const log = logger === 'out' ? console.log : console.error
        withoutLastLine.forEach((line: string) => {
            if (this.config.colors) {
                const coloredLine = logger === 'out' ? line : chalk.red(line)
                log(color(name + ': ') + coloredLine)
            } else {
                log(`${name}: ${line}`)
            }
        })
    }
}
