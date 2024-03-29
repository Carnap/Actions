#!/usr/bin/env node
import * as core from '@actions/core'
import axios, {AxiosInstance} from 'axios'
import rateLimit from 'axios-rate-limit'
import {stripIndent} from 'common-tags'
import glob from 'glob'
import yargs from 'yargs'
import {DocumentPrivacy} from './api'
import {
    CarnapUploadJob,
    documentPrivacies,
    isValidDocumentPrivacy,
    Logger,
} from './upload'

/**
 * async/Promise wrapper for the glob function that searches relative to the
 * given repoRoot.
 * @param pat glob pattern to evaluate
 */
async function doGlob(pat: string, repoRoot: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        glob(pat, {root: repoRoot, cwd: repoRoot}, (err, resp) => {
            if (err) {
                reject(err)
            } else {
                resolve(resp)
            }
        })
    })
}

function makeAxios(instanceUrl: string, apiKey: string): AxiosInstance {
    return rateLimit(
        axios.create({
            baseURL: `${instanceUrl}/api/v1`,
            headers: {
                'X-API-KEY': apiKey,
            },
        }),
        {
            maxRPS: 5,
        }
    )
}

async function actionsEntry(): Promise<void> {
    try {
        const apiKey = core.getInput('apiKey')
        if (!apiKey) {
            core.warning(stripIndent`
                No API key is configured. Files will not be uploaded.
                help: the API key is configured as the setting 'apiKey' in the actions yml file
                      Is the secret missing from the repository settings?`)
            return
        }
        core.setSecret(apiKey)
        const instanceUrl = core.getInput('instanceUrl')
        core.info(`Uploading to ${instanceUrl}`)

        const myAxios = makeAxios(instanceUrl, apiKey)

        myAxios.interceptors.request.use(config => {
            core.debug(`request: ${config.method} ${config.url}`)
            return config
        })

        const paths = JSON.parse(core.getInput('includeFiles'))
        if (!(paths instanceof Array)) {
            throw new Error('includeFiles is not an array of strings')
        }

        const defaultVisibility = core.getInput('defaultVisibility')
        if (!isValidDocumentPrivacy(defaultVisibility)) {
            throw new Error(stripIndent`
                default visibility ${defaultVisibility} is not valid
                help: possible values are ${documentPrivacies.join(',')}`)
        }

        // for now we assume the workdir is the repo. TODO: it might not be
        const repoRoot = process.cwd()
        core.info(`Starting Carnap action in ${repoRoot}`)

        const filePaths = (
            await Promise.all(paths.map(async p => await doGlob(p, repoRoot)))
        ).flat()

        await new CarnapUploadJob(
            myAxios,
            filePaths,
            defaultVisibility,
            core
        ).run()
    } catch (error) {
        core.setFailed(error.message)
    }
}

interface Args {
    _: string[]
    basePath: string
    includeFiles: string
    url: string
    defaultVisibility: DocumentPrivacy
}

function parseArgs(): Args {
    return yargs
        .command('upload', 'uploads files to a Carnap instance', yarg =>
            yarg
                .option('basePath', {
                    alias: 'b',
                    description: 'base path to the files to upload',
                    type: 'string',
                    demandOption: true,
                })
                .option('includeFiles', {
                    alias: 'i',
                    description: 'JSON list of globs matching files to include',
                    type: 'string',
                    demandOption: true,
                })
                .option('url', {
                    description: 'URL to the Carnap instance to upload to',
                    type: 'string',
                    default: 'https://carnap.io',
                })
                .option('defaultVisibility', {
                    description:
                        'Default visibility of newly created documents.',
                    choices: [
                        'Public',
                        'InstructorsOnly',
                        'LinkOnly',
                        'Private',
                    ],
                    default: 'Private',
                })
                .usage(
                    `CARNAP_API_KEY=... $0 upload -b <basepath> -i '<includeFilesJsonList>' [options]`
                )
                .strict()
        )
        .demandCommand()
        .strict().argv as Args
    // mild sin here, the reason we have to cast this is because tsc does
    // not recognize the limited values of defaultVisibility
}

const cliLog: Logger = {
    debug(msg) {
        console.debug(msg)
    },

    info(msg) {
        console.info(msg)
    },

    warning(msg) {
        console.warn(msg)
    },
}

async function cliEntry(): Promise<void> {
    const argv = parseArgs()
    const command = argv._[0]

    console.assert(command === 'upload')
    const paths = JSON.parse(argv.includeFiles)

    if (!(paths instanceof Array)) {
        throw new Error('paths is not a json array!')
    }

    const apiKey = process.env['CARNAP_API_KEY']
    if (!apiKey) {
        throw new Error('CARNAP_API_KEY environment variable missing')
    }

    const myAxios = makeAxios(argv.url, apiKey)

    myAxios.interceptors.request.use(config => {
        cliLog.debug(`request: ${config.method} ${config.url}`)
        return config
    })

    const filePaths = (
        await Promise.all(paths.map(async p => await doGlob(p, argv.basePath)))
    ).flat()

    await new CarnapUploadJob(
        myAxios,
        filePaths,
        argv.defaultVisibility,
        cliLog
    ).run()
}

// run as a GitHub action if we are running in that environment, otherwise run
// as a cli tool
if (process.env['GITHUB_WORKFLOW']) {
    actionsEntry()
} else {
    cliEntry()
}
