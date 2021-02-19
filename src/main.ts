import * as core from '@actions/core'
import axios from 'axios'
import rateLimit from 'axios-rate-limit'
import glob from 'glob'
import {CarnapUploadJob, isValidDocumentPrivacy} from './upload'

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

async function entry(): Promise<void> {
    try {
        const apiKey = core.getInput('apiKey')
        core.setSecret(apiKey)
        const myAxios = rateLimit(
            axios.create({
                baseURL: `${core.getInput('instanceUrl')}/api/v1`,
                headers: {
                    'X-API-KEY': apiKey,
                },
            }),
            {
                maxRPS: 1.5,
            }
        )

        const paths = JSON.parse(core.getInput('includeFiles'))
        if (!(paths instanceof Array)) {
            throw new Error('includeFiles is not an array of strings')
        }

        const defaultVisibility = core.getInput('defaultVisibility')
        if (!isValidDocumentPrivacy(defaultVisibility)) {
            throw new Error('default visibility is not valid')
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

entry()
