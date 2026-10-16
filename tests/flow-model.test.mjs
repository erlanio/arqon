import test from 'node:test';
import assert from 'node:assert/strict';
import {flowNextOptions,initialFlowNode,validateFlowDiagram} from '../flow-model.mjs';

const diagram=(nodes,edges=[])=>({type:'fluxo',nodes,edges});
const node=(id,kind,title=id,extra={})=>({id,kind,title,...extra});

test('flow validator detects missing boundaries, dangling references, and unreachable elements',()=>{
  const d=diagram([node('p','process'),node('x','end'),node('u','process')],[{id:'e',from:'p',to:'missing'}]);
  const issues=validateFlowDiagram(d);
  assert.ok(issues.some(issue=>issue.code==='missing-start'&&issue.severity==='error'));
  assert.ok(issues.some(issue=>issue.code==='missing-end'&&issue.severity==='warning')===false);
  assert.ok(issues.some(issue=>issue.code==='invalid-endpoint'));
  assert.ok(issues.some(issue=>issue.code==='unreachable-element'&&issue.elementId==='u'));
});

test('flow validator checks decision branch labels and disallows incoming start and outgoing end',()=>{
  const d=diagram([node('s','start'),node('d','decision','Validar',{condition:'Está correto?'}),node('a','process'),node('b','end')],[{id:'1',from:'s',to:'d'},{id:'2',from:'d',to:'a'},{id:'3',from:'d',to:'b'},{id:'4',from:'b',to:'a'},{id:'5',from:'a',to:'s'}]);
  const issues=validateFlowDiagram(d);
  assert.ok(issues.some(issue=>issue.code==='unlabeled-decision-branch'));
  assert.ok(issues.some(issue=>issue.code==='flow-from-end'));
  assert.ok(issues.some(issue=>issue.code==='flow-into-start'));
});

test('flow validator reports paired connector inconsistencies without treating cycles as errors',()=>{
  const d=diagram([node('s','start'),node('c','connector','A',{connectorId:'A'}),node('p','process'),node('e','end')],[{id:'1',from:'s',to:'c'},{id:'2',from:'c',to:'p'},{id:'3',from:'p',to:'c'},{id:'4',from:'p',to:'e'}]);
  const issues=validateFlowDiagram(d);
  assert.ok(issues.some(issue=>issue.code==='unmatched-connector'));
  assert.ok(!issues.some(issue=>issue.severity==='error'));
});

test('flow validator identifies cycles as informational and warns when a cycle has no path to an end',()=>{
  const d=diagram([node('s','start'),node('a','process'),node('b','process'),node('e','end')],[{id:'1',from:'s',to:'a'},{id:'2',from:'a',to:'b'},{id:'3',from:'b',to:'a'},{id:'4',from:'b',to:'e'}]);
  const issues=validateFlowDiagram(d);
  assert.ok(issues.some(issue=>issue.code==='potential-cycle'&&issue.severity==='info'));
  assert.ok(!issues.some(issue=>issue.severity==='error'));
  d.edges=d.edges.filter(edge=>edge.to!=='e');
  assert.ok(validateFlowDiagram(d).some(issue=>issue.code==='no-end-path'));
});

test('subprocess validation resolves linked flowchart IDs across the project',()=>{
  const d=diagram([node('sub','subprocess','Relatório',{subprocessRef:'child'})]);
  assert.ok(validateFlowDiagram(d).some(issue=>issue.code==='invalid-subprocess-reference'));
  assert.ok(!validateFlowDiagram(d,{diagrams:[{id:'child',type:'fluxo'}]}).some(issue=>issue.code==='invalid-subprocess-reference'));
});

test('simulation identifies the start, decision choices, next step, completion, and dead ends',()=>{
  const d=diagram([node('s','start'),node('d','decision'),node('yes','process'),node('end','end'),node('dead','process')],[{id:'1',from:'s',to:'d'},{id:'2',from:'d',to:'yes',label:'Sim'},{id:'3',from:'d',to:'end',label:'Não'},{id:'4',from:'yes',to:'end'}]);
  assert.equal(initialFlowNode(d).id,'s');
  assert.equal(flowNextOptions(d,'s').options[0].node.id,'d');
  assert.equal(flowNextOptions(d,'d').status,'choice');
  assert.equal(flowNextOptions(d,'yes').options[0].node.id,'end');
  assert.equal(flowNextOptions(d,'end').status,'complete');
  assert.equal(flowNextOptions(d,'dead').status,'dead-end');
});
