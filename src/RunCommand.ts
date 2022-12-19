import { COLOR, Config, Task } from './Config'
import { exec } from 'child-process-promise'

interface Execution {
    exitPromise: Promise<unknown>
    waitForPromise: Promise<unknown>
}

export class RunCommand {

    private executions: Record<string, Execution> = {}

    constructor(private config: Config) {}

    public async runTasks(tasks: string[]): Promise<void> {
        await Promise.all(tasks.map(task => this.runTask(task)))
    }

    private async runTask(task: string) {
        const taskConfig = this.findTask(task)

        if (taskConfig.dependsOn?.length) {
            await this.runTasks(taskConfig.dependsOn)
            this.writeToConsole(`== Successfully executed dependent tasks ${taskConfig.dependsOn?.join(',') || []}`, task, taskConfig.color)
        }

        let execution = this.executions[task]
        if (!execution) {
            execution = this.executeTask(task, taskConfig)
            this.executions[task] = execution
        }
        await execution.waitForPromise
    }

    private executeTask(name: string, taskConfig: Task) {
        const statement = taskConfig.exec
        if (!statement) {
            return this.executeNothing()
        }
        return this.executeStatement(statement, name, taskConfig)
    }

    private executeStatement(statement: string, name: string, taskConfig: Task) {
        this.writeToConsole(`== Executing "${statement}"`, name, taskConfig.color)
        if (this.config.dryRun) {
            return this.executeNothing()
        }
        let exitTimeout = (taskConfig.waitFor?.stderr || taskConfig.waitFor?.stdout) ? 0 : (taskConfig.waitFor?.timeout || 0)
        if (exitTimeout) {
            this.writeToConsole(`== Adding timeout of ${taskConfig.waitFor!.timeout}ms waiting for exit"`, name, taskConfig.color)
        }
        const exitPromise = exec(statement, {
            shell: this.config.shell,
            cwd: taskConfig.cwd,
            // wait for exit here
            timeout: exitTimeout,
            killSignal: taskConfig.waitFor ? taskConfig.waitFor.killSignal : 'SIGTERM'
        })

        let resolvedOrRejected = false
        const waitForPromise = new Promise(async (resolve, reject) => {
            if ((taskConfig.waitFor?.stdout || taskConfig.waitFor?.stderr) && taskConfig.waitFor?.timeout) {
                this.writeToConsole(`== Adding timeout of ${taskConfig.waitFor.timeout}ms waiting for output"`, name, taskConfig.color)
                setTimeout(() => {
                    if (!resolvedOrRejected) {
                        resolvedOrRejected = true
                        this.writeToConsole(`== Timed out after ${taskConfig.waitFor!.timeout}ms waiting for output"`, name, taskConfig.color)
                        // TODO maybe still wait for the process to terminate with outputs here.
                        // TODO in that case, we might need a second timeout for logging a stale process and/or SIGKILLing it
                        exitPromise.childProcess.kill(taskConfig.waitFor?.killSignal)
                        reject(`Timeout running task "${name}". Killed via ${taskConfig.waitFor?.killSignal}.`)
                    }
                }, taskConfig.waitFor.timeout)
            }
            exitPromise.childProcess.stdout?.on('data', (data: any) => {
                this.writeToConsole(data, name, taskConfig.color)
                if (!resolvedOrRejected && data?.includes(taskConfig.waitFor?.stdout)) {
                    resolvedOrRejected = true
                    resolve(undefined)
                }
            })
            exitPromise.childProcess.stderr?.on('data', (data: any) => {
                this.writeToConsole(data, name, taskConfig.color, console.error)
                if (!resolvedOrRejected && data?.includes(taskConfig.waitFor?.stderr)) {
                    resolvedOrRejected = true
                    resolve(undefined)
                }
            })
            return await exitPromise.then(() => {
                if (!resolvedOrRejected) {
                    resolve(undefined)
                }
            }).catch((err) => {
                if (!resolvedOrRejected) {
                    reject(err)
                }
            })
        })
        return {
            exitPromise,
            waitForPromise
        }
    }

    private executeNothing() {
        return {
            exitPromise: Promise.resolve(),
            waitForPromise: Promise.resolve()
        }
    }

    private findTask(task: string): Task {
        let taskConfig = this.config.tasks[task]
        if (!taskConfig) {
            throw new Error(`Missing task ${task}`)
        }
        return taskConfig
    }

    private writeToConsole(data: string, name: string, color: COLOR, logger: (line: string) => void = console.log) {
        const lines = data.split('\n')
        let lastLineIndex = lines.length - 1
        const withoutLastLine = lines[lastLineIndex] === '' ? lines.slice(0, lastLineIndex) : lines
        withoutLastLine.forEach((line: string) => {
            if (this.config.colors) {
                logger(`${color(name)}: ${line}`)
            } else {
                logger(line)
            }
        })
    }
}
