import { COLOR, Config, Task } from './Config'
import { exec } from 'child-process-promise'
import { red } from 'colors/safe'

interface Execution {
    exitPromise: Promise<unknown>
    waitForPromise: Promise<unknown>
}

export class RunCommand {

    private executions: Record<string, Execution> = {}

    constructor(private config: Config) {}

    public async runTasks(tasks: string[]): Promise<void> {
        // check existence of all requested tasks before starting any of them
        tasks.forEach(task => this.findTask(task))

        // run all tasks in parallel, recursively going through dependencies
        await Promise.all(tasks.map(task => this.runTask(task)))
    }

    private async runTask(task: string) {
        const taskConfig = this.findTask(task)

        if (taskConfig.dependsOn?.length) {
            await this.runTasks(taskConfig.dependsOn)
            this.verbose(`== Successfully executed dependent tasks ${taskConfig.dependsOn?.join(',') || []}`, task, taskConfig.color)
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
        this.verbose(`== Executing "${statement}"`, name, taskConfig.color)
        if (this.config.dryRun) {
            return this.executeNothing()
        }
        let exitTimeout = (taskConfig.waitFor?.stderr || taskConfig.waitFor?.stdout) ? 0 : (taskConfig.waitFor?.timeout || 0)
        if (exitTimeout) {
            this.verbose(`== Adding timeout of ${taskConfig.waitFor!.timeout}ms waiting for exit"`, name, taskConfig.color)
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
                this.verbose(`== Adding timeout of ${taskConfig.waitFor.timeout}ms waiting for output"`, name, taskConfig.color)
                setTimeout(() => {
                    if (!resolvedOrRejected) {
                        resolvedOrRejected = true
                        this.verbose(`== Timed out after ${taskConfig.waitFor!.timeout}ms waiting for output"`, name, taskConfig.color)
                        // TODO maybe still wait for the process to terminate with outputs here.
                        // TODO in that case, we might need a second timeout for logging a stale process and/or SIGKILLing it
                        exitPromise.childProcess.kill(taskConfig.waitFor?.killSignal)
                        reject(`Timeout running task "${name}". Killed via ${taskConfig.waitFor?.killSignal}.`)
                    }
                }, taskConfig.waitFor.timeout)
            }
            exitPromise.childProcess.stdout?.on('data', (data: any) => {
                if (!taskConfig.quiet) {
                    this.writeToConsole(data, name, taskConfig.color)
                }
                if (!resolvedOrRejected && data?.includes(taskConfig.waitFor?.stdout)) {
                    resolvedOrRejected = true
                    resolve(undefined)
                }
            })
            exitPromise.childProcess.stderr?.on('data', (data: any) => {
                this.writeToConsole(data, name, taskConfig.color, 'err')
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

    private verbose(text: string, taskName: string, color: COLOR) {
        if (this.config.verbose) {
            this.writeToConsole(text, taskName, color)
        }
    }

    private writeToConsole(data: string, name: string, color: COLOR, logger: 'out' | 'err' = 'out') {
        const lines = data.split('\n')
        let lastLineIndex = lines.length - 1
        const withoutLastLine = lines[lastLineIndex] === '' ? lines.slice(0, lastLineIndex) : lines
        const log = logger == 'out' ? console.log : console.error
        withoutLastLine.forEach((line: string) => {
            if (this.config.colors) {
                const coloredLine = logger == 'out' ? line : red(line)
                log(`${color(name)}: ${coloredLine}`)
            } else {
                log(`${name}: ${line}`)
            }
        })
    }
}
