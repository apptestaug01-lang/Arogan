jest.mock('@aws-sdk/client-s3', () => {
  const send = jest.fn().mockResolvedValue({});
  class S3Client {
    cfg: unknown;
    send = send;
    constructor(cfg?: unknown) {
      this.cfg = cfg;
    }
  }
  return {
    S3Client,
    CreateBucketCommand: class {},
    HeadBucketCommand: class {},
    PutPublicAccessBlockCommand: class {},
    PutBucketCorsCommand: class {},
    PutBucketLifecycleConfigurationCommand: class {},
    UploadPartCommand: class {},
    DeleteObjectCommand: class {
      input: unknown
      constructor(input: unknown) {
        this.input = input
      }
    },
  };
});

import { S3Client, HeadBucketCommand, PutPublicAccessBlockCommand, CreateBucketCommand, PutBucketCorsCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getStorageConfig } from '../src/config/storage.config.js';
import { createS3Client, ensureBucket, checkStorageHealth, deleteObject } from '../src/services/storage.service.js';

const TEST_CONFIG = {
  endpoint: 'localhost',
  port: 9000,
  useSsl: false,
  accessKey: 'testkey',
  secretKey: 'testsecret',
  bucket: 'test-bucket',
  region: 'us-east-1',
};

function makeClient() {
  return new S3Client();
}

describe('storage.config', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('returns B2 config when B2 env is set', () => {
    process.env.B2_KEY_ID = 'test-key-id';
    process.env.B2_APPLICATION_KEY = 'test-app-key';
    process.env.B2_BUCKET = 'test-bucket';
    process.env.B2_REGION = 'us-east-005';

    const config = getStorageConfig();

    expect(config.endpoint).toContain('backblazeb2.com');
    expect(config.bucket).toBe('test-bucket');
    expect(config.region).toBe('us-east-005');
    expect(config.provider).toBe('b2');
  });

  it('honours explicit B2 env overrides', () => {
    process.env.B2_KEY_ID = '002xxxxxxxxxxxx';
    process.env.B2_APPLICATION_KEY = 'test-secret';
    process.env.B2_BUCKET = 'custom-bucket';
    process.env.B2_REGION = 'us-west-002';

    const config = getStorageConfig();

    expect(config.endpoint).toContain('backblazeb2.com');
    expect(config.bucket).toBe('custom-bucket');
    expect(config.region).toBe('us-west-002');
  });
});

describe('createS3Client', () => {
  it('builds a path-style client pointed at the configured endpoint', () => {
    const client = createS3Client(TEST_CONFIG) as unknown as { cfg: Record<string, unknown> };

    expect(client).toBeInstanceOf(S3Client);
    expect((client.cfg.endpoint as string)).toContain('localhost:9000');
    expect(client.cfg.forcePathStyle).toBe(true);
    expect((client.cfg.credentials as { accessKeyId: string }).accessKeyId).toBe('testkey');
  });
});

describe('ensureBucket', () => {
  it('creates the bucket and applies CORS when it does not exist', async () => {
    const client = makeClient();
    client.send.mockImplementation((cmd: unknown) => {
      if (cmd instanceof HeadBucketCommand) {
        return Promise.reject(new Error('NotFound'));
      }
      return Promise.resolve({});
    });

    await ensureBucket(client, TEST_CONFIG);

    const calledCommands = client.send.mock.calls.map((c) => c[0].constructor);
    expect(calledCommands).toContain(CreateBucketCommand);
    expect(calledCommands).toContain(PutPublicAccessBlockCommand);
    expect(calledCommands).toContain(PutBucketCorsCommand);
  });

  it('is idempotent and does nothing when the bucket already exists', async () => {
    const client = makeClient();
    client.send.mockResolvedValue({});

    await ensureBucket(client, TEST_CONFIG);

    const calledCommands = client.send.mock.calls.map((c) => c[0].constructor);
    expect(calledCommands).not.toContain(CreateBucketCommand);
    expect(calledCommands).not.toContain(PutBucketCorsCommand);
  });

  it('tolerates an unsupported BlockPublicAccess call and still applies CORS', async () => {
    const client = makeClient();
    client.send.mockImplementation((cmd: unknown) => {
      if (cmd instanceof HeadBucketCommand) {
        return Promise.reject(new Error('NotFound'));
      }
      if (cmd instanceof PutPublicAccessBlockCommand) {
        return Promise.reject(new Error('Unsupported'));
      }
      return Promise.resolve({});
    });

    await expect(ensureBucket(client, TEST_CONFIG)).resolves.toBeUndefined();

    const calledCommands = client.send.mock.calls.map((c) => c[0].constructor);
    expect(calledCommands).toContain(CreateBucketCommand);
    expect(calledCommands).toContain(PutBucketCorsCommand);
  });
});

describe('deleteObject', () => {
  it('sends a DeleteObject command with the bucket and key', async () => {
    const client = makeClient();
    await deleteObject('borrowers/u1/app-1/doc-1/file.pdf', client, TEST_CONFIG);

    expect(client.send).toHaveBeenCalledTimes(1);
    const cmd = client.send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(DeleteObjectCommand);
    expect(cmd.input.Bucket).toBe('test-bucket');
    expect(cmd.input.Key).toBe('borrowers/u1/app-1/doc-1/file.pdf');
  });
});

describe('checkStorageHealth', () => {
  it('returns true when the bucket is reachable', async () => {
    const client = makeClient();
    client.send.mockResolvedValue({});

    expect(await checkStorageHealth(client, TEST_CONFIG)).toBe(true);
  });

  it('returns false when the bucket is unreachable', async () => {
    const client = makeClient();
    client.send.mockRejectedValue(new Error('down'));

    expect(await checkStorageHealth(client, TEST_CONFIG)).toBe(false);
  });
});
