import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeIStarDiagram, sanitizeIStarSvg, validateIStarDiagram} from '../istar-model.mjs';

test('normalizes a native iStar diagram while preserving SVG stereotype definitions',()=>{
 const diagram={type:'istar',nodes:[{id:'g',kind:'istarGoal'}],edges:[],istar:{stereotypes:[{id:'s1',name:'Critical',svg:'<svg/>'}]}};
 normalizeIStarDiagram(diagram);
 assert.equal(diagram.istar.version,'2.0');assert.equal(diagram.istar.view,'SR');assert.equal(diagram.nodes[0].istar.ownerId,null);assert.equal(diagram.nodes[0].istar.stereotypeId,null);assert.equal(diagram.istar.stereotypes[0].name,'Critical');
});

test('checks dependency actor endpoints and asks for a dependum without treating it as an error',()=>{
 const diagram={type:'istar',nodes:[{id:'a',kind:'istarBoundary'},{id:'b',kind:'istarAgent'},{id:'g',kind:'istarGoal'}],edges:[{id:'d1',from:'a',to:'b',type:'dependencyGoal',dependum:''},{id:'d2',from:'g',to:'b',type:'dependencyTask'}]};
 const issues=validateIStarDiagram(diagram);
 assert.ok(issues.some(issue=>issue.severity==='warning'&&issue.elementId==='d1'&&issue.message.includes('dependum')));
 assert.ok(issues.some(issue=>issue.severity==='error'&&issue.elementId==='d2'&&issue.message.includes('atores')));
});

test('checks intentional refinements and references to removed stereotypes',()=>{
 const diagram={type:'istar',istar:{stereotypes:[]},nodes:[{id:'g',kind:'istarGoal',istar:{ownerId:'a',stereotypeId:'gone'}},{id:'t',kind:'istarTask',istar:{ownerId:'a'}}],edges:[{id:'r',from:'g',to:'t',type:'refinementAnd'}]};
 const issues=validateIStarDiagram(diagram);
 assert.ok(issues.some(issue=>issue.severity==='error'&&issue.elementId==='g'&&issue.message.includes('estereótipo')));
 assert.equal(issues.some(issue=>issue.elementId==='r'&&issue.severity==='error'),false);
});

test('rejects SVG DTDs and oversized drawings before parsing',()=>{
 assert.throws(()=>sanitizeIStarSvg('<!DOCTYPE svg><svg/>'),/DTD/);
 assert.throws(()=>sanitizeIStarSvg('x'.repeat(200_001)),/200 KB/);
});


test('applies the core iStar 2.0 endpoint rules',()=>{
 const nodes=[
  {id:'actor',kind:'istarBoundary',istar:{actorType:'actor'}},
  {id:'role1',kind:'istarRole'},{id:'role2',kind:'istarRole'},
  {id:'agent',kind:'istarAgent'},
  {id:'goal',kind:'istarGoal',istar:{ownerId:'role1'}},
  {id:'task',kind:'istarTask',istar:{ownerId:'role1'}},
  {id:'quality',kind:'istarQuality',istar:{ownerId:'role1'}},
  {id:'resource',kind:'istarResource',istar:{ownerId:'role1'}}
 ];
 const edges=[
  {id:'isa-ok',from:'role1',to:'role2',type:'isA'},
  {id:'isa-agent',from:'agent',to:'role1',type:'isA'},
  {id:'contribution-ok',from:'task',to:'quality',type:'contributionHelp'},
  {id:'contribution-wrong',from:'task',to:'goal',type:'contributionHelp'},
  {id:'qualification-ok',from:'quality',to:'goal',type:'qualification'},
  {id:'needed-ok',from:'resource',to:'task',type:'neededBy'},
  {id:'needed-wrong',from:'task',to:'resource',type:'neededBy'}
 ];
 const errors=validateIStarDiagram({type:'istar',nodes,edges}).filter(issue=>issue.severity==='error');
 assert.deepEqual(errors.map(issue=>issue.elementId),['isa-agent','contribution-wrong','needed-wrong']);
});
