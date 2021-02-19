import {basename} from 'path'
import {readFile} from 'fs/promises'
import {AxiosInstance} from 'axios'
import * as CarnapApi from './api'

export interface Logger {
    debug(_msg: string): void
    info(_msg: string): void
    warning(_msg: string): void
}

export class CarnapUploadJob {
    myAxios: AxiosInstance
    filePaths: string[]
    defaultVisibility: CarnapApi.DocumentPrivacy
    logger: Logger

    constructor(
        myAxios: AxiosInstance,
        filePaths: string[],
        defaultVisibility: CarnapApi.DocumentPrivacy,
        logger: Logger
    ) {
        this.myAxios = myAxios
        this.filePaths = filePaths
        this.defaultVisibility = defaultVisibility
        this.logger = logger
    }

    async getServerIds(ident: string): Promise<{[basename: string]: number}> {
        const files = await this.myAxios.get<CarnapApi.Document[]>(
            `/instructors/${ident}/documents`
        )

        // maps from server filename (basename) to id
        const basenameToId: {[key: string]: number} = {}
        for (const serverFile of files.data) {
            basenameToId[serverFile.filename] = serverFile.id
        }
        return basenameToId
    }

    async run(): Promise<void> {
        const apiInfo = await this.myAxios.get<CarnapApi.Info>('/')
        const {ident} = apiInfo.data

        // first get a list of files that are on the server. this determines
        // which ones we have to create
        const basenameToId = await this.getServerIds(ident)

        // maps from basename to full path
        const basenameToFullPath: {[basename: string]: string} = {}
        for (const fp of this.filePaths) {
            const fileBasename = basename(fp)

            if (basenameToFullPath[fileBasename]) {
                this.logger.warning(`filename ${fp} duplicates filename \
                    ${basenameToFullPath[fileBasename]}`)
            }
            basenameToFullPath[basename(fp)] = fp
        }

        // ignore files that are only on the server
        for (const basename in basenameToId) {
            if (!basenameToFullPath[basename]) {
                delete basenameToId[basename]
            }
        }

        const toCreate = []
        for (const fp of Object.keys(basenameToFullPath)) {
            if (!basenameToId[basename(fp)]) {
                toCreate.push(fp)
            }
        }

        // create the files that don't yet have metadata on the server
        const newIds = await Promise.all(
            toCreate.map(
                async path => await this.createFile(ident, basename(path))
            )
        )

        // fill the map such that each basename has at least one entry
        Object.assign(basenameToId, Object.fromEntries(newIds))

        // double check that we have the same number of ids as we have file names
        if (
            Object.keys(basenameToId).length !==
            Object.keys(basenameToFullPath).length
        ) {
            throw new Error(
                `Missing/have some extra files. This should not happen. \
                Expected to have all of ${JSON.stringify(basenameToFullPath)}, \
                for ${JSON.stringify(basenameToId)}`
            )
        }

        await this.uploadFiles(ident, basenameToId, basenameToFullPath)
    }

    async uploadFiles(
        ident: string,
        filenameIds: {[name: string]: number},
        basenameToFullPath: {[name: string]: string}
    ): Promise<void> {
        // next upload all the files
        Promise.all(
            Object.entries(filenameIds).map(async ([name, id]) => {
                const fileContents = await readFile(basenameToFullPath[name])
                await this.myAxios.put(
                    `/instructors/${ident}/documents/${id}`,
                    fileContents
                )
            })
        )
    }

    async createFile(
        ident: string,
        filename: string
    ): Promise<[string, number]> {
        const newId = await this.myAxios.post<number>(
            `/instructors/${ident}/documents`,
            {
                scope: this.defaultVisibility,
                filename,
            }
        )

        return [filename, newId.data]
    }
}

export function isValidDocumentPrivacy(
    priv: string
): priv is CarnapApi.DocumentPrivacy {
    return ['Public', 'InstructorsOnly', 'LinkOnly', 'Private'].includes(priv)
}
