import axios from 'axios'
jest.mock('axios')
import fs from 'fs/promises'
jest.mock('fs/promises')
import {Logger, CarnapUploadJob} from '../src/upload'
import * as CarnapApi from '../src/api'

const mockedAxios = axios as jest.Mocked<typeof axios>
const mockedFs = fs as jest.Mocked<typeof fs>

const DROPPING_LOGGER: Logger = {
    debug(_) {},
    warning(_) {},
    info(_) {},
}

afterEach(() => {
    jest.clearAllMocks()
})

const job = new CarnapUploadJob(mockedAxios, [], 'Private', DROPPING_LOGGER)

test('upload', async () => {
    const newJob = new CarnapUploadJob(
        mockedAxios,
        ['/a', 'c'],
        'Public',
        DROPPING_LOGGER
    )

    mockedFs.readFile.mockImplementation(fname => {
        const fc: {[filename: string]: string} = {
            '/a': 'blah',
        }
        if (!fc[fname as string]) {
            fail('file does not exist')
        }

        return Promise.resolve(fc[fname as string])
    })

    mockedAxios.get.mockImplementation(async path => {
        if (path === '/') {
            return {
                data: {
                    version: 'v1',
                    ident: 'a@aa',
                },
            }
        } else {
            fail('unexpected get')
        }
    })

    newJob.getServerIds = jest.fn(async () => {
        return {a: 1, b: 2}
    })

    newJob.createFile = jest.fn().mockResolvedValueOnce(['c', 3])

    newJob.uploadFiles = jest.fn().mockResolvedValueOnce(undefined)

    await newJob.run()
    expect(newJob.getServerIds).toHaveBeenCalled()
    expect(newJob.uploadFiles).toHaveBeenCalledWith(
        'a@aa',
        {a: 1, c: 3},
        {a: '/a', c: 'c'}
    )
    expect(newJob.createFile).toHaveBeenCalledWith('a@aa', 'c')
})

test('file upload works', async () => {
    mockedFs.readFile.mockImplementation(fname => {
        const fc: {[filename: string]: string} = {
            '/a/b/c': 'blah',
            c: 'c++',
        }
        if (!fc[fname as string]) {
            fail('file does not exist')
        }

        return Promise.resolve(fc[fname as string])
    })

    await job.uploadFiles('a@aa', {a: 1, c: 2}, {a: '/a/b/c', c: 'c'})

    expect(mockedAxios.put).toBeCalledWith(
        '/instructors/a@aa/documents/1',
        'blah'
    )
    expect(mockedAxios.put).toBeCalledWith(
        '/instructors/a@aa/documents/2',
        'c++'
    )
})

test('file creation works', async () => {
    mockedAxios.post.mockResolvedValueOnce({data: 1})

    const getMock = jest.fn()
    getMock.mockReturnValue(
        Promise.resolve({
            data: {
                creator: 1234,
                date: '2020-01-01T00:00:00.0000Z',
                scope: 'Private',
                id: 1,
                description: null,
                filename: 'filename.md',
            },
        })
    )

    const res = await job.createFile('a@aa', 'filename.md')
    expect(mockedAxios.post).toBeCalledWith('/instructors/a@aa/documents', {
        scope: 'Private',
        filename: 'filename.md',
    })
    expect(res).toEqual(['filename.md', 1])
})
