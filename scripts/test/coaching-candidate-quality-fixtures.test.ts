import assert from 'node:assert/strict';
import test from 'node:test';
import { heldOutCases, screeningCases, type CoachingCandidateQualityCase } from '../../tests/interview/fixtures/coaching-candidate-quality-cases';

const cells = (cases: CoachingCandidateQualityCase[]) => new Set(cases.map((c) => `${c.roleFamily}:${c.experience}`));
const validate = (cases: CoachingCandidateQualityCase[], split: CoachingCandidateQualityCase['split']) => {
  assert.equal(cases.length, split === 'screening' ? 8 : 16);
  assert.ok(cases.every((c) => c.split === split && c.question.length <= 2000 && c.answer.length <= 12000));
  assert.equal(new Set(cases.map((c) => c.id)).size, cases.length);
  assert.ok(cases.every((c) => c.reviewObjectives.length > 0 && c.severeFailureChecks.length > 0 && c.clarification.length > 0));
};

test('screening and held-out fixtures have required independent coverage', () => {
  validate(screeningCases, 'screening'); validate(heldOutCases, 'heldout');
  const expected = new Set(['aviation:junior', 'aviation:senior', 'healthcare:junior', 'healthcare:senior', 'software:junior', 'software:senior', 'operations:junior', 'operations:senior']);
  assert.deepEqual(cells(screeningCases), expected); assert.deepEqual(cells(heldOutCases), expected);
  for (const cell of expected) {
    assert.equal(screeningCases.filter((c) => `${c.roleFamily}:${c.experience}` === cell).length, 1);
    assert.equal(heldOutCases.filter((c) => `${c.roleFamily}:${c.experience}` === cell).length, 2);
  }
  assert.equal(new Set([...screeningCases, ...heldOutCases].map((c) => c.id)).size, 24);
  assert.equal(new Set(screeningCases.map((c) => c.question)).size, 8);
  assert.equal(new Set(heldOutCases.map((c) => c.question)).size, 16);
  assert.equal(new Set([...screeningCases, ...heldOutCases].map((c) => c.question)).size, 24);
  assert.equal(new Set(screeningCases.map((c) => c.answer).filter((a) => heldOutCases.some((h) => h.answer === a))).size, 0);
  for (const type of ['behavioral', 'motivational', 'hypothetical', 'technical']) assert.ok([...screeningCases, ...heldOutCases].some((c) => c.questionType === type));
  assert.ok([...screeningCases, ...heldOutCases].filter((c) => c.category === 'long').every((c) => c.answer.trim().split(/\s+/).length >= 200));
  for (const category of ['weak', 'strong', 'unusual', 'long', 'short', 'ambiguous', 'adversarial']) assert.ok([...screeningCases, ...heldOutCases].some((c) => c.category === category));
});
