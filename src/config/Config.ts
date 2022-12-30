import findConfig from 'find-config'
import fs from 'fs'
import path from 'path'

const COLORS = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'gray', 'black', 'white']

const EXCLUDE_COLORS = {
    dark: ['black', 'blue'],
    light: ['white', 'yellow']
}

export type COLOR = typeof COLORS[number]

export interface FileConfig {
    /**
     * Use an alternative shell. For requirements and defaults, see the `shell` argument here:
     * https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback
     */
    shell?: string

    /**
     * Use colors fitting for dark or light backgrounds..
     * Default: 'dark'
     */
    theme?: 'dark' | 'light'

    /**
     * Start the UI.
     * Default: false
     */
    ui?: boolean

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
     * If it's a number, it's a delay in ms.
     * Default: 'exit' => unit after exit
     */
    waitFor?: FileWaitFor
}

export type FileWaitFor = FileWaitForConsole | FileWaitForMs | FileWaitForExit | undefined

interface FileWaitForConsole {
    type: 'console'
    /**
     * Text to search for in stdout
     */
    text: string
    /**
     * Timeout after which the process is considered failing, while waiting for exit or missing stdout/stderr output.
     */
    timeout?: number

    /**
     * Signal to use to terminate a process after a timeout
     */
    killSignal?: 'SIGTERM' | 'SIGKILL'
}

interface FileWaitForMs {
    type: 'ms'
    /**
     * Delay to wait after startup before starting followup services
     */
    delay: number

    /**
     * Signal to use to terminate a process after a timeout
     */
    killSignal?: 'SIGTERM' | 'SIGKILL'
}

interface FileWaitForExit {
    type: 'exit'

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

    theme: 'dark' | 'light'

    colorPalette: string[]

    dryRun: boolean
    // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
    tasks: { [name: string]: Task }

    rootDir: string

    verbose: boolean

    focus: boolean
}

export interface Task extends FileTask {
    name: string
    color: COLOR
    quiet: boolean
    waitFor: WaitForConsole | WaitForMs | WaitForExit
}

export type WaitFor = WaitForConsole | WaitForMs | WaitForExit

export interface WaitForConsole extends FileWaitForConsole {
    killSignal: 'SIGTERM' | 'SIGKILL'
}

export interface WaitForMs extends FileWaitForMs {
    killSignal: 'SIGTERM' | 'SIGKILL'
}

export interface WaitForExit extends FileWaitForExit {
    killSignal: 'SIGTERM' | 'SIGKILL'
}

function createWaitFor (waitFor: FileWaitFor): WaitFor {
    if (waitFor === undefined || waitFor === null) {
        return {
            type: 'exit',
            timeout: 0,
            killSignal: 'SIGTERM'
        } satisfies WaitForExit
    }
    return {
        ...waitFor,
        killSignal: waitFor.killSignal ?? 'SIGTERM'
    }
}

export function isWaitForConsole (waitFor: WaitFor): waitFor is WaitForConsole {
    return waitFor?.type === 'console'
}

export function isWaitForMs (waitFor: WaitFor): waitFor is WaitForMs {
    return waitFor?.type === 'ms'
}

export function isWaitForExit (waitFor: WaitFor): waitFor is WaitForExit {
    return waitFor?.type === 'exit'
}

export async function createConfiguration (options: CliOptions, tasks?: string[]): Promise<Config> {
    const configObj = findConfig.obj('.porcrc')
    if (configObj == null) {
        throw new Error('Didn\'t find any .porcrc in the current working directory or any parent directory.')
    }
    const rootDir = configObj.dir
    const configFile = configObj.path
    const fileConfig: FileConfig = JSON.parse(await fs.promises.readFile(configFile, 'utf-8'))

    const verbose = options.verbose === true ? true : fileConfig.verbose === true
    const focus = options.focus !== undefined ? options.focus : (fileConfig.focus !== undefined ? fileConfig.focus : true)

    const colors = options.colors !== undefined ? options.colors : (fileConfig.colors !== undefined ? fileConfig.colors : true)
    const theme = fileConfig.theme ?? 'dark'
    const colorPalette = COLORS.filter(col => !EXCLUDE_COLORS[theme].includes(col))

    const config = {
        ...fileConfig,
        tasks: Object.keys(fileConfig.tasks).reduce((fullTasks: Record<string, Task>, key, index) => {
            const fileTask = fileConfig.tasks[key]
            const quiet = fileTask.quiet === true ? true : (focus && (tasks != null) && !tasks.includes(key)) || false
            fullTasks[key] = {
                ...fileTask,
                name: key,
                color: colorPalette[index % colorPalette.length],
                cwd: fileTask.cwd !== undefined ? path.join(rootDir, fileTask.cwd) : rootDir,
                quiet,
                waitFor: createWaitFor(fileTask.waitFor)
            }
            return fullTasks
        }, {}),
        focus,
        verbose,
        colors,
        theme,
        colorPalette,
        dryRun: options.dryRun === true,
        rootDir
    }
    checkConfig(config)
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
