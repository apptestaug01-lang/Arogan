jest.mock('@aws-sdk/client-s3', () => {
  const send = jest.fn().mockResolvedValue({})
  class S3Client {
    send = send
    constructor() {}
  }
  const makeCmd = () =>
    class {
      input: unknown
      constructor(input: unknown) {
        this.input = input
      }
    }
  return {
    S3Client,
    ListObjectsV2Command: makeCmd(),
  }
})

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { listExplorer, ExplorerError } from '../src/services/explorer.service.js'

// resetMocks wipes the beforeEach implementation, so re-establish send() per test.
function setupSend(result: any) {
  ;(new S3Client() as any).send.mockImplementation((cmd: any) => {
    if (cmd instanceof ListObjectsV2Command) return Promise.resolve(result)
    return Promise.resolve({})
  })
}

describe('listExplorer', () => {
  it('returns folders (CommonPrefixes) and files (Contents) at the borrower root', async () => {
    setupSend({
      CommonPrefixes: [{ Prefix: 'borrowers/user-1/applications/' }],
      Contents: [
        { Key: 'borrowers/user-1/applications/app-1/documents/doc-1/report.pdf', Size: 2048, LastModified: new Date('2026-08-20T10:00:00Z') },
      ],
    })

    const res = await listExplorer({ userId: 'user-1' })

    expect(res.prefix).toBe('borrowers/user-1/')
    expect(res.folders).toEqual([
      { name: 'applications', type: 'folder', key: 'borrowers/user-1/applications/' },
    ])
    expect(res.files).toHaveLength(1)
    expect(res.files[0].name).toBe('report.pdf')
    expect(res.files[0].key).toBe('borrowers/user-1/applications/app-1/documents/doc-1/report.pdf')
    expect(res.files[0].size).toBe(2048)
    expect(res.files[0].lastModified).toBe('2026-08-20T10:00:00.000Z')
    expect(res.nextToken).toBeNull()
  })

  it('drops the directory marker so the current folder is not listed as a file', async () => {
    setupSend({
      CommonPrefixes: [],
      Contents: [{ Key: 'borrowers/user-1/', Size: 0 }],
    })

    const res = await listExplorer({ userId: 'user-1' })
    expect(res.files).toHaveLength(0)
  })

  it('paginates via NextContinuationToken', async () => {
    setupSend({
      CommonPrefixes: [],
      Contents: [],
      NextContinuationToken: 'token-2',
      IsTruncated: true,
    })

    const res = await listExplorer({ userId: 'user-1' })
    expect(res.nextToken).toBe('token-2')
  })

  it('lists a subfolder when given a descendant prefix', async () => {
    setupSend({
      CommonPrefixes: [{ Prefix: 'borrowers/user-1/applications/app-1/documents/' }],
      Contents: [],
    })

    const res = await listExplorer({
      userId: 'user-1',
      prefix: 'borrowers/user-1/applications/app-1/',
    })
    expect(res.prefix).toBe('borrowers/user-1/applications/app-1/')
    expect(res.folders[0].name).toBe('documents')
  })

  it('rejects a prefix that escapes the borrower root', async () => {
    await expect(
      listExplorer({ userId: 'user-1', prefix: 'borrowers/user-2/' }),
    ).rejects.toBeInstanceOf(ExplorerError)
    await expect(
      listExplorer({ userId: 'user-1', prefix: 'borrowers/user-2/' }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})
