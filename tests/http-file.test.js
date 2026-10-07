const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('test.http uses unique httpYac names and explicit references for every follow-up', () => {
  const text = fs.readFileSync('test.http', 'utf8');
  const names = [...text.matchAll(/^# @name (\w+)\s*$/gm)].map(match => match[1]);
  assert.equal(names.length, new Set(names).size, 'Duplicate request names');
  assert.ok(!text.includes('.response.body.$.'), 'Syntax belongs to another REST client');
  const followUps = text.split(/(?=^###)/m).filter(block => block.includes('# @ref '));
  assert.equal(followUps.length, 8);
  for (const block of followUps) {
    const name = block.match(/^# @ref (\w+)\s*$/m)[1];
    assert.ok(names.includes(name), 'Missing first turn');
    assert.ok(block.includes(`{{${name}.conversationId}}`));
  }
});