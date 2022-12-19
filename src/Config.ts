import findConfig from 'find-config'
import fs from 'fs'
import { enable as enableColors, black, blue, cyan, gray, green, magenta, red, white, yellow } from 'colors/safe'

const COLORS = [ red, green, yellow, blue, magenta, cyan, gray, black, white] as const
export type COLOR = typeof COLORS[number]

export interface FileConfig {
    tasks: Record<string, FileTask>
    colors?: boolean
}

export interface FileTask {
    dependsOn?: string[]
    exec?: string
    waitFor?: WaitFor
}

interface WaitFor {
    stdout?: string
    stderr?: string
    timeout?: number
}

export interface CliOptions {
    colors?: boolean
    dryRun?: boolean
}

export interface Config extends FileConfig {
    colors: boolean
    dryRun: boolean
    tasks: Record<string, Task>
}

export interface Task extends FileTask {
    color: COLOR
}

export async function createConfiguration(options: CliOptions): Promise<Config> {
    const configFile = findConfig('.porcrc')
    const fileConfig: FileConfig = configFile ? JSON.parse(await fs.promises.readFile(configFile, 'utf-8')) : {}

    let config = {
        ...fileConfig,
        tasks: Object.keys(fileConfig.tasks).reduce((fullTasks: Record<string, Task>, key, index) => {
            fullTasks[key] = {
                ...fileConfig.tasks[key],
                color: COLORS[index % COLORS.length]
            }
            return fullTasks
        }, {}),
        colors: options.colors !== undefined ? options.colors : (fileConfig.colors !== undefined ? fileConfig.colors : true),
        dryRun: options.dryRun || false
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

