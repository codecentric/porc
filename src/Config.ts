import findConfig from 'find-config'
import fs from 'fs'
import { enable as enableColors, black, blue, cyan, gray, green, magenta, red, white, yellow } from 'colors/safe'
import path from 'path'

const COLORS = [red, green, yellow, blue, magenta, cyan, gray, black, white] as const
export type COLOR = typeof COLORS[number]

export interface FileConfig {
    /**
     * Use an alternative shell. For requirements and defaults, see the `shell` argument here:
     * https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback
     */
    shell?: string

    /**
     * Map of task configurations.
     */
    // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
    tasks: { [name: string]: FileTask }

    /**
     * Support colorized output. Default: true
     */
    colors?: boolean

    /**
     * Print out status messages
     */
    verbose?: boolean

    focus?: boolean
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
     * Do not write STDOUT to console?
     * Default: false
     */
    quiet?: boolean

    /**
     * Optional configuration how long to wait after the process has started.
     * Default: unit after exit
     */
    waitFor?: FileWaitFor
}

interface FileWaitFor {
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
    killSignal?: 'SIGTERM' | 'SIGKILL'
}

export interface CliOptions {
    colors?: boolean
    dryRun?: boolean
    verbose?: boolean
    focus?: boolean
}

export interface Config extends FileConfig {
    colors: boolean
    dryRun: boolean
    // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
    tasks: { [name: string]: Task }

    rootDir: string
}

export interface Task extends FileTask {
    color: COLOR
    quiet: boolean
    waitFor?: WaitFor
}

export interface WaitFor extends FileWaitFor {
    killSignal: 'SIGTERM' | 'SIGKILL'
}

export async function createConfiguration (options: CliOptions, tasks?: string[]): Promise<Config> {
    const configObj = findConfig.obj('.porcrc')
    if (configObj == null) {
        throw new Error('Didn\'t find any .porcrc in the current working directory or any parent directory.')
    }
    const rootDir = configObj.dir
    const configFile = configObj.path
    const fileConfig: FileConfig = JSON.parse(await fs.promises.readFile(configFile, 'utf-8'))

    const focus = options.focus !== undefined ? options.focus : (fileConfig.focus !== undefined ? fileConfig.focus : true)
    const config = {
        ...fileConfig,
        tasks: Object.keys(fileConfig.tasks).reduce((fullTasks: Record<string, Task>, key, index) => {
            const fileTask = fileConfig.tasks[key]
            const quiet = fileTask.quiet === true ? true : (focus && (tasks != null) && !tasks.includes(key)) || false
            fullTasks[key] = {
                ...fileTask,
                color: COLORS[index % COLORS.length],
                cwd: fileTask.cwd !== undefined ? path.join(rootDir, fileTask.cwd) : rootDir,
                quiet,
                waitFor: (fileTask.waitFor != null)
                    ? {
                        ...fileTask.waitFor,
                        killSignal: fileTask.waitFor?.killSignal ?? 'SIGTERM'
                    }
                    : undefined
            }
            return fullTasks
        }, {}),
        focus,
        verbose: options.verbose === true ? true : fileConfig.verbose === true,
        colors: options.colors !== undefined ? options.colors : (fileConfig.colors !== undefined ? fileConfig.colors : true),
        dryRun: options.dryRun === true,
        rootDir
    }
    checkConfig(config)
    if (config.colors) {
        enableColors()
    }
    return config
}

function checkConfig (config: Config): void {
    Object.entries(config.tasks).forEach(([name, task]) => {
        task.dependsOn?.forEach(dependency => {
            if (config.tasks[dependency] == null) {
                throw new Error(`Task "${name}" has unknown dependency "${dependency}"`)
            }
        })
    })
}
