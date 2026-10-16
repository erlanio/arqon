import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocumentRecord} from '../document-store.mjs';

test('validates and isolates a versioned document record', () => {
  const input = {id:'studio-diagram:p:d',kind:'studio-diagram',version:1,content:{diagram:{id:'d',nodes:[]}}};
  const record = validateDocumentRecord(input);
  assert.equal(record.id,input.id);
  assert.equal(record.kind,input.kind);
  assert.ok(Number.isFinite(Date.parse(record.updatedAt)));
  record.content.diagram.nodes.push({id:'n'});
  assert.deepEqual(input.content.diagram.nodes,[]);
});

test('rejects incomplete or unsupported document records', () => {
  for (const value of [null,{}, {id:'d',kind:'x',version:0,content:{}}, {id:'d',kind:'x',version:1,content:null}]) {
    assert.throws(() => validateDocumentRecord(value), TypeError);
  }
});
