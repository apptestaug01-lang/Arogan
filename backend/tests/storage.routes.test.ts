jest.mock('@aws-sdk/client-s3', () => {
  const send = jest.fn().mockResolvedValue({});
  class S3Client {
    send = send;
    constructor() {}
  }
  return {
    S3Client,
    CreateBucketCommand: class {},
    HeadBucketCommand: class {},
    PutPublicAccessBlockCommand: class {},
    PutBucketCorsCommand: class {},
  };
});

import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import express from 'express';
import request from 'supertest';
import { storageRouter } from '../src/routes/storage.routes.js';

const app = express();
app.use('/api/storage', storageRouter);

describe('storage routes', () => {
  it('returns 503 when the storage backend is unreachable', async () => {
    const probe = new S3Client();
    probe.send.mockImplementation((cmd: unknown) => {
      if (cmd instanceof HeadBucketCommand) {
        return Promise.reject(new Error('down'));
      }
      return Promise.resolve({});
    });

    const res = await request(app).get('/api/storage/health');

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });
});
