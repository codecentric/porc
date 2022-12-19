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
        const exitPromise = exec(statement)

        let resolved = false
        const waitForPromise = new Promise(async (resolve, reject) => {
            exitPromise.childProcess.stdout?.on('data', (data: any) => {
                this.writeToConsole(data, name, taskConfig.color)
                if (!resolved && data?.includes(taskConfig.waitFor?.stdout)) {
                    resolved = true
                    resolve(undefined)
                }
            })
            exitPromise.childProcess.stderr?.on('data', (data: any) => {
                this.writeToConsole(data, name, taskConfig.color, console.error)
                if (!resolved && data?.includes(taskConfig.waitFor?.stderr)) {
                    resolved = true
                    resolve(undefined)
                }
            })
            return await exitPromise.then(() => {
                if (!resolved) {
                    resolve(undefined)
                }
            }).catch((err) => {
                if (!resolved) {
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
