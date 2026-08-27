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
  };
});

import { S3Client, HeadBucketCommand, PutPublicAccessBlockCommand, CreateBucketCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { getStorageConfig } from '../src/config/storage.config.js';
import { createS3Client, ensureBucket, checkStorageHealth } from '../src/services/storage.service.js';

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

  it('returns sensible defaults when MinIO env is unset', () => {
    delete process.env.MINIO_ENDPOINT;
    delete process.env.MINIO_PORT;
    delete process.env.MINIO_USE_SSL;
    delete process.env.MINIO_ACCESS_KEY;
    delete process.env.MINIO_SECRET_KEY;
    delete process.env.MINIO_BUCKET;
    delete process.env.MINIO_REGION;

    const config = getStorageConfig();

    expect(config.endpoint).toBe('localhost');
    expect(config.port).toBe(9000);
    expect(config.useSsl).toBe(false);
    expect(config.accessKey).toBe('minioadmin');
    expect(config.bucket).toBe('loanflow-documents');
    expect(config.region).toBe('us-east-1');
  });

  it('honours explicit MinIO env overrides', () => {
    process.env.MINIO_ENDPOINT = 'storage.example.com';
    process.env.MINIO_PORT = '443';
    process.env.MINIO_USE_SSL = 'true';
    process.env.MINIO_BUCKET = 'custom-bucket';

    const config = getStorageConfig();

    expect(config.endpoint).toBe('storage.example.com');
    expect(config.port).toBe(443);
    expect(config.useSsl).toBe(true);
    expect(config.bucket).toBe('custom-bucket');
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
