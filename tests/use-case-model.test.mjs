import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutUseCaseDiagram,validateUseCaseDiagram} from '../use-case-model.mjs';

test('permits actor associations and directed use case relationships',()=>{
 const diagram={nodes:[{id:'a',kind:'actor',title:'Cliente'},{id:'u',kind:'useCase',title:'Comprar',description:'Compra'},{id:'v',kind:'useCase',title:'Pagar',description:'Pagamento'}],edges:[{id:'r1',from:'a',to:'u',type:'association'},{id:'r2',from:'u',to:'v',type:'include'},{id:'r3',from:'a',to:'v',type:'association'}]};
 assert.deepEqual(validateUseCaseDiagram(diagram),[]);
});

test('reports incompatible endpoints, self relations, missing extension points and cycles',()=>{
 const diagram={nodes:[{id:'a',kind:'actor',title:'A'},{id:'b',kind:'actor',title:'B'},{id:'u',kind:'useCase',title:'U',extensionPoints:[]},{id:'v',kind:'useCase',title:'V'}],edges:[{id:'r1',from:'a',to:'b',type:'include'},{id:'r2',from:'u',to:'u',type:'extend',extensionPoint:'confirmar'},{id:'r3',from:'a',to:'b',type:'generalization'},{id:'r4',from:'b',to:'a',type:'generalization'},{id:'r5',from:'u',to:'v',type:'include'},{id:'r6',from:'v',to:'u',type:'include'}]};
 const codes=validateUseCaseDiagram(diagram).map(issue=>issue.code);assert.ok(codes.includes('useCaseRelationship.endpoints'));assert.ok(codes.includes('relationship.self'));assert.ok(codes.includes('extend.point.missing'));assert.ok(codes.includes('generalization.cycle'));assert.ok(codes.includes('include.cycle'));
});

test('rejects duplicate identities and diagnoses placement without making it a UML error',()=>{
 const diagram={nodes:[{id:'b',kind:'systemBoundary',title:'Sistema',x:0,y:0,width:400,height:300},{id:'a',kind:'actor',title:'Cliente',x:20,y:30},{id:'u',kind:'useCase',title:'Comprar',objective:'Compra',x:600,y:30,systemBoundaryId:'missing'},{id:'u',kind:'useCase',title:'Duplicado'}],edges:[]};
 const issues=validateUseCaseDiagram(diagram);assert.ok(issues.some(item=>item.code==='element.id.duplicate'&&item.severity==='error'));assert.ok(issues.some(item=>item.code==='actor.insideBoundary'&&item.severity==='warning'));assert.ok(issues.some(item=>item.code==='useCase.boundary.reference'&&item.severity==='warning'));
});

test('topology-aware layout keeps relationship direction and places actors outside boundaries',()=>{
 const diagram={nodes:[{id:'b',kind:'systemBoundary',title:'Sistema',x:120,y:60,width:480,height:360},{id:'a',kind:'actor',title:'Cliente'},{id:'u',kind:'useCase',title:'Comprar',systemBoundaryId:'b'},{id:'v',kind:'useCase',title:'Pagar',systemBoundaryId:'b'}],edges:[{id:'assoc',from:'a',to:'u',type:'association'},{id:'inc',from:'u',to:'v',type:'include'}]};
 assert.equal(layoutUseCaseDiagram(diagram),true);assert.equal(diagram.edges[1].from,'u');assert.equal(diagram.edges[1].to,'v');assert.ok(diagram.nodes.find(node=>node.id==='a').x>=diagram.nodes.find(node=>node.id==='b').x+diagram.nodes.find(node=>node.id==='b').width);for(const node of diagram.nodes.filter(item=>item.kind==='useCase'))assert.ok(node.x>=diagram.nodes.find(item=>item.id==='b').x&&node.y>=diagram.nodes.find(item=>item.id==='b').y);
});

test('layout separates multiple system boundaries and actors with shared cases',()=>{
 const diagram={nodes:[
  {id:'one',kind:'systemBoundary',title:'Vendas',x:200,y:30,width:480,height:300},
  {id:'two',kind:'systemBoundary',title:'Entrega',x:210,y:40,width:480,height:300},
  {id:'a',kind:'actor',title:'Cliente',x:20,y:200},{id:'b',kind:'actor',title:'Atendente',x:25,y:210},
  ...Array.from({length:7},(_,i)=>({id:`u${i}`,kind:'useCase',title:`Caso ${i}`,systemBoundaryId:i<4?'one':'two',width:240,height:100}))
 ],edges:[{id:'aa',type:'association',from:'a',to:'u0'},{id:'ab',type:'association',from:'a',to:'u1'},{id:'ba',type:'association',from:'b',to:'u0'}]};
 assert.equal(layoutUseCaseDiagram(diagram),true);
 const byId=new Map(diagram.nodes.map(node=>[node.id,node]));assert.ok(byId.get('two').x>=byId.get('one').x+byId.get('one').width);
 for(const node of diagram.nodes.filter(node=>node.kind==='useCase')){const owner=byId.get(node.systemBoundaryId);assert.ok(node.x>=owner.x&&node.y>=owner.y&&node.x+node.width<=owner.x+owner.width&&node.y+node.height<=owner.y+owner.height)}
 assert.ok(byId.get('b').y>=byId.get('a').y+132||byId.get('a').y>=byId.get('b').y+132);
 assert.deepEqual(validateUseCaseDiagram(diagram).filter(issue=>['actor.insideBoundary','useCase.outsideBoundary','element.overlap'].includes(issue.code)),[]);
});
