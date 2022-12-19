import { COLOR, Config, Task } from './Config'
import { exec } from 'child-process-promise'

interface Execution {
    exitPromise: Promise<unknown>
    waitForPromise: Promise<unknown>
}

export class RunCommand {

    private executions: Record<string, Execution> = {}

    constructor(private config: Config) {}

    public async execute(task: string): Promise<void> {
        const taskConfig = this.findTask(task)

        await Promise.all(taskConfig.dependsOn?.map(async dependency => {
            await this.execute(dependency)
        }) || [])

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
            return this.executeEmptyTask(taskConfig, name)
        }
        return this.executeStatement(statement, name, taskConfig)
    }

    private executeStatement(statement: string, name: string, taskConfig: Task) {
        console.log(`Executing ${statement}`)

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

    private executeEmptyTask(taskConfig: Task, name: string) {
        this.writeToConsole(`Successfully executed dependent tasks ${taskConfig.dependsOn?.join(',') || []}`, name, taskConfig.color)
        return {
            waitForPromise: Promise.resolve(),
            exitPromise: Promise.resolve()
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
