import { Config, Task } from './Config'
import { TextConsole } from './TextConsole'
import { Console } from './Console'
import { Execution, InterruptedError } from './Execution'

export class RunCommand {
    public executions = new Map<string, Execution>()

    private interrupted = false

    constructor (private readonly config: Config, public console: Console = new TextConsole(config.colors, config)) {}

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
        let running = this.allRunningProcesses()
        let max = 10
        while (running.length && max--) {
            await Promise.all(running.map(async exec => await exec.exitPromise))
            running = this.allRunningProcesses()
        }
    }

    private allRunningProcesses (): Execution[] {
        return Array.from(this.executions.values()).filter(exec => exec.status !== 'done' && exec.status !== 'failed')
    }

    public handleSignal (signal: 'SIGTERM' | 'SIGINT' | 'SIGQUIT'): void {
        if (!this.interrupted) {
            this.interrupted = true
            this.sendSignalToChildProcesses(signal)
        } else {
            this.sendSignalToChildProcesses('SIGKILL')
        }
    }

    public async restartTask (search: string): Promise<void> {
        const tasks = Array.from(this.executions.keys()).filter(exec => exec.startsWith(search))
        if (tasks.length === 1) {
            const taskName = tasks[0]
            const execution = this.executions.get(taskName)
            if (execution) {
                this.console.verbose('== Restarting task', execution.task)
                if (execution?.childProcess && execution.exitPromise) {
                    execution.childProcess?.kill('SIGTERM')
                    await execution.exitPromise.catch(() => undefined) // TODO do something in case of failures?
                }
                this.executions.delete(taskName)
                return await this.runTask(taskName)
            }
            throw new Error('Task was not running')
        }
        throw new Error(`Which task did you mean? ${tasks.join(',')}...`)
    }

    private sendSignalToChildProcesses (signal: 'SIGTERM' | 'SIGINT' | 'SIGQUIT' | 'SIGKILL'): void {
        Array.from(this.executions.values()).forEach(exec => exec.sendSignal(signal))
    }

    private async runTask (taskName: string): Promise<void> {
        const task = this.findTask(taskName)

        if (task.dependsOn?.length) {
            await this.runTasksInParallel(task.dependsOn)
        }

        let execution = this.executions.get(taskName)
        if (!execution) {
            execution = new Execution(this.console, this.config, task)
            this.executions.set(taskName, execution)
        }
        await execution.waitForPromise
    }

    private findTask (task: string): Task {
        const taskConfig = this.config.tasks[task]
        if (!taskConfig) {
            throw new Error(`Missing task ${task}`)
        }
        return taskConfig
    }
}
