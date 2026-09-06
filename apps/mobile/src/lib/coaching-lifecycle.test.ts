import { CoachingLifecycle } from './coaching-lifecycle';
import { test, expect } from '@jest/globals';

test('end aborts work and rejects late success even if fetch ignores abort', () => {
  const life = new CoachingLifecycle();
  const operation = life.begin()!;
  expect(operation.current()).toBe(true);
  expect(life.finish()).toBe(true);
  expect(operation.signal.aborted).toBe(true);
  expect(operation.current()).toBe(false);
  expect(life.finish()).toBe(false);
  expect(life.begin()).toBeUndefined();
});

test('connection retry invalidates older permission and SDP completions', () => {
  const life = new CoachingLifecycle();
  const old = life.begin()!;
  life.cancelPending();
  const retry = life.begin()!;
  expect(old.current()).toBe(false);
  expect(retry.current()).toBe(true);
});

test('completed transcript IDs are accepted only once, not deduped by wording', () => {
  const life = new CoachingLifecycle();
  expect(life.acceptTranscript('one')).toBe(true);
  expect(life.acceptTranscript('one')).toBe(false);
  expect(life.acceptTranscript('two')).toBe(true);
  life.finish();
  expect(life.acceptTranscript('three')).toBe(false);
});
