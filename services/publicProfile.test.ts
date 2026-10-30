import test from 'node:test';
import assert from 'node:assert/strict';
import { publicTenantProfile, validateCommunityProfile, profileActivity } from './publicProfile';
import { UserRole, type User } from '../types';

test('public tenant profile exposes only the requested information, calculating birthday correctly', () => {
  const result = publicTenantProfile({ id: 'tenant', firstName: 'Alice', lastName: 'Privé', email: 'secret@example.test', phone: 'private', birthDate: '2000-10-27', activity: 'STUDENT', school: 'Université Exemple', interests: ['Lecture', 'Cuisine'], role: UserRole.TENANT, documents: { idCard: 'private-document' } } as User, new Date('2026-10-26T12:00:00Z'));
  assert.deepEqual(result, { id: 'tenant', firstName: 'Alice', role: UserRole.TENANT, age: 25, activityLabel: 'Étudiant · Université Exemple', interests: ['Lecture', 'Cuisine'] });
  for (const field of ['email', 'lastName', 'phone', 'birthDate', 'documents']) assert.equal(Object.hasOwn(result, field), false);
});
test('community edits validate the activity detail and interest choices without modifying identity', () => {
  assert.throws(() => validateCommunityProfile({ activity: 'STUDENT', school: '', interests: [] }));
  assert.throws(() => validateCommunityProfile({ activity: 'EMPLOYED', job: 'Santé', interests: ['invalid'] }));
  assert.throws(() => validateCommunityProfile({ activity: 'ADMIN', interests: [] }));
  assert.deepEqual(validateCommunityProfile({ activity: 'EMPLOYED', job: ' Santé ', school: 'Ancienne école', interests: ['Sport', 'Sport'], email: 'unwanted' }), { activity: 'EMPLOYED', job: 'Santé', school: '', interests: ['Sport'] });
  assert.equal(profileActivity({ activity: 'RETIRED', school: 'Old', job: 'Old' }), 'Retraité');
});
