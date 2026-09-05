import {
  LOANFLOW_DERIVED_PREFIX,
  ARCHIVE_EMBED_MAX_BYTES,
  ARCHIVE_GZ_OBJECT_MAX_BYTES,
  ARCHIVE_CONVERT_TIMEOUT_MS,
  ARCHIVE_SCHEMA_VERSION,
} from '../../src/utils/constants.js';

describe('Archive constants', () => {
  it('has the expected derived namespace prefix', () => {
    expect(LOANFLOW_DERIVED_PREFIX).toBe('.loanflow');
  });

  it('embed tier threshold is 25 MB', () => {
    expect(ARCHIVE_EMBED_MAX_BYTES).toBe(25 * 1024 * 1024);
  });

  it('gz-object tier threshold is 100 MB', () => {
    expect(ARCHIVE_GZ_OBJECT_MAX_BYTES).toBe(100 * 1024 * 1024);
  });

  it('convert timeout is configurable and has a sane default', () => {
    expect(typeof ARCHIVE_CONVERT_TIMEOUT_MS).toBe('number');
    expect(ARCHIVE_CONVERT_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it('schema version is set', () => {
    expect(ARCHIVE_SCHEMA_VERSION).toBe('1.0');
  });
});
