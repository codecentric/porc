import findConfig from 'find-config'
import fs from 'fs'
import { enable as enableColors, black, blue, cyan, gray, green, magenta, red, white, yellow } from 'colors/safe'
import path from 'path'

const COLORS = [ red, green, yellow, blue, magenta, cyan, gray, black, white] as const
export type COLOR = typeof COLORS[number]

export interface FileConfig {
    tasks: Record<string, FileTask>
    colors?: boolean
}

export interface FileTask {
    /**
     * Dependent task names.
     */
    dependsOn?: string[]

    /**
     * Execution command, passed to the shell executable via the '-c' argument.
     */
    exec?: string

    /**
     * Working directory relative to the .porcrc
     */
    cwd?: string

    /**
     * Optional configuration how long to wait after the process has started.
     * Default: unit after exit
     */
    waitFor?: WaitFor
}

interface WaitFor {
    /**
     * Text to search for in stdout
     */
    stdout?: string
    /**
     * Text to search for in stderr
     */
    stderr?: string
    /**
     * Timeout after which the process is considered failing, while waiting for exit or missing stdout/stderr output.
     */
    timeout?: number

    /**
     * Signal to use to terminate a process after a timeout
     */
    killSignal: 'SIGTERM' | 'SIGKILL'
}

export interface CliOptions {
    colors?: boolean
    dryRun?: boolean
}

export interface Config extends FileConfig {
    shell?: string
    colors: boolean
    dryRun: boolean
    tasks: Record<string, Task>

    rootDir: string
}

export interface Task extends FileTask {
    color: COLOR
}

export async function createConfiguration(options: CliOptions): Promise<Config> {
    const configObj = findConfig.obj('.porcrc')
    if (!configObj) {
        throw new Error(`Didn't find any .porcrc in the current working directory or any parent directory.`)
    }
    const rootDir = configObj.dir
    const configFile = configObj.path
    const fileConfig: FileConfig = JSON.parse(await fs.promises.readFile(configFile, 'utf-8'))

    let config = {
        ...fileConfig,
        tasks: Object.keys(fileConfig.tasks).reduce((fullTasks: Record<string, Task>, key, index) => {
            const fileTask = fileConfig.tasks[key]
            fullTasks[key] = {
                ...fileTask,
                color: COLORS[index % COLORS.length],
                cwd: fileTask.cwd ? path.join(rootDir, fileTask.cwd) : rootDir,
                waitFor: fileTask.waitFor ? {
                    ...fileTask.waitFor,
                    killSignal: fileTask.waitFor.killSignal || 'SIGTERM'
                } : undefined
            }
            return fullTasks
        }, {}),
        colors: options.colors !== undefined ? options.colors : (fileConfig.colors !== undefined ? fileConfig.colors : true),
        dryRun: options.dryRun || false,
        rootDir
    }
    checkConfig(config)
    if (config.colors) {
        enableColors()
    }
    return config
}

function checkConfig(config: Config) {
    Object.entries(config.tasks).forEach(([name, task]) => {
        task.dependsOn?.forEach(dependency => {
            if (!config.tasks[dependency]) {
                throw new Error(`Task "${name}" has unknown dependency "${dependency}"` )
            }
        })
    })
}

