import { MetricsCollector, archiveMetrics } from '../../src/modules/documentArchive/metrics.js';

describe('MetricsCollector (C10 — observability)', () => {
  it('starts at zero', () => {
    const m = new MetricsCollector();
    expect(m.get().enqueued).toBe(0);
    expect(m.get().completed).toBe(0);
    expect(m.get().failed).toBe(0);
    expect(m.get().deadLettered).toBe(0);
    expect(m.get().retried).toBe(0);
  });

  it('increments counters correctly', () => {
    const m = new MetricsCollector();
    m.increment('enqueued');
    m.increment('enqueued');
    m.increment('completed');
    m.increment('failed');
    m.increment('deadLettered');
    m.increment('retried');

    const metrics = m.get();
    expect(metrics.enqueued).toBe(2);
    expect(metrics.completed).toBe(1);
    expect(metrics.failed).toBe(1);
    expect(metrics.deadLettered).toBe(1);
    expect(metrics.retried).toBe(1);
  });

  it('tracks per-status counters', () => {
    const m = new MetricsCollector();
    m.incrementStatus('COMPLETED');
    m.incrementStatus('FAILED');
    m.incrementStatus('FAILED');

    expect(m.get().perStatus.COMPLETED).toBe(1);
    expect(m.get().perStatus.FAILED).toBe(2);
  });

  it('tracks per-format counters', () => {
    const m = new MetricsCollector();
    m.incrementFormat('application/pdf');
    m.incrementFormat('application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    expect(m.get().perFormat['application/pdf']).toBe(1);
  });

  it('reset clears all counters', () => {
    const m = new MetricsCollector();
    m.increment('enqueued');
    m.incrementStatus('COMPLETED');
    m.incrementFormat('pdf');

    m.reset();

    const metrics = m.get();
    expect(metrics.enqueued).toBe(0);
    expect(Object.keys(metrics.perStatus)).toHaveLength(0);
    expect(Object.keys(metrics.perFormat)).toHaveLength(0);
  });

  it('archiveMetrics singleton is exported', () => {
    expect(archiveMetrics).toBeInstanceOf(MetricsCollector);
    expect(typeof archiveMetrics.get).toBe('function');
  });

  it('logLifecycle emits structured log with metrics snapshot', () => {
    const m = new MetricsCollector();
    m.increment('completed');
    const spy = jest.spyOn(m, 'get');
    m.logLifecycle('complete', { pending: 0 });
    expect(spy).toHaveBeenCalled();
  });
});
