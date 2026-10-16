import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,addClassifier,addDiagram,addRelationship,addAttribute,addOperation,addParameter,parseProject,clone,stereotypeLabels,applyStereotype,removeStereotype} from '../model.mjs';
import {autoLayoutClassDiagram} from '../layout.mjs';
import {routeRelationship} from '../routing.mjs';
import {validMultiplicity,validateProject} from '../validation.mjs';

test('project keeps shared classifier semantics while diagrams keep independent views',()=>{
 const p=createProject(),d=p.diagrams[0],c=addClassifier(p,d,'class',40,60),second=addDiagram(p,'Outra visão');
 second.elementIds.push(c.id);second.view.nodes[c.id]={x:300,y:200,w:220,h:112};
 assert.equal(p.classifiers.length,1);assert.equal(second.elementIds[0],c.id);assert.notDeepEqual(d.view.nodes[c.id],second.view.nodes[c.id]);
 assert.equal(parseProject(p).classifiers[0].id,c.id);
});

test('classifiers support typed attributes, operations and directed parameters',()=>{
 const p=createProject(),c=addClassifier(p,p.diagrams[0]),a=addAttribute(c),op=addOperation(c),param=addParameter(op);
 Object.assign(a,{name:'id',type:'Integer',isStatic:true});Object.assign(op,{name:'buscar',returnType:'Cliente'});Object.assign(param,{name:'codigo',type:'String',direction:'in'});
 assert.equal(c.attributes[0].type,'Integer');assert.equal(c.operations[0].parameters[0].direction,'in');assert.equal(c.operations[0].returnType,'Cliente');
});

test('applied profile stereotypes are returned as visible UML labels',()=>{
 const p=createProject(),c=addClassifier(p,p.diagrams[0]);c.stereotypes.push({id:'st-1',name:'entity',values:{}});
 assert.deepEqual(stereotypeLabels(c),['«entity»']);
 const i=addClassifier(p,p.diagrams[0],'interface');assert.deepEqual(stereotypeLabels(i),['«interface»']);
});

test('profile stereotypes can be applied once and removed cleanly',()=>{
 const p=createProject(),c=addClassifier(p,p.diagrams[0]),st={id:'st-1',name:'entity'};
 assert.equal(applyStereotype(c,st,'profile-1'),true);assert.equal(applyStereotype(c,st,'profile-1'),false);
 assert.equal(removeStereotype(c,'st-1'),true);assert.deepEqual(c.stereotypes,[]);
});

test('UML relationship kinds retain distinct semantics and endpoints',()=>{
 const p=createProject(),d=p.diagrams[0],a=addClassifier(p,d),b=addClassifier(p,d,'interface');
 for(const kind of ['association','aggregation','composition','generalization','realization','dependency']){const r=addRelationship(p,d,kind,a.id,b.id);assert.equal(r.kind,kind);assert.equal(r.sourceId,a.id);assert.equal(r.targetId,b.id)}
 assert.equal(p.relationships.find(r=>r.kind==='composition').sourceEnd.aggregation,'composite');
 assert.equal(p.relationships.find(r=>r.kind==='aggregation').sourceEnd.aggregation,'shared');
});

test('parse rejects unresolved relationships and non-finite graphical positions',()=>{
 const p=createProject(),d=p.diagrams[0],a=addClassifier(p,d);const relation=addClassifier(p,d);addRelationship(p,d,'association',a.id,relation.id);
 const bad=clone(p);bad.relationships[0].targetId='missing';assert.throws(()=>parseProject(bad),/Relação UML inválida/);
 const badPosition=clone(p);badPosition.diagrams[0].view.nodes[a.id].x=NaN;assert.throws(()=>parseProject(badPosition),/posição/i);
});

test('older v1 class documents without profiles or optional view details still open',()=>{
 const p=createProject(),d=p.diagrams[0],c=addClassifier(p,d,'class',40,60);
 const legacy=clone(p);delete legacy.profiles;delete legacy.createdAt;delete legacy.updatedAt;delete legacy.classifiers[0].attributes;delete legacy.classifiers[0].operations;
 delete legacy.diagrams[0].view.zoom;delete legacy.diagrams[0].view.pan;delete legacy.diagrams[0].view.edges;delete legacy.diagrams[0].view.nodes[c.id].w;delete legacy.diagrams[0].view.nodes[c.id].h;
 const restored=parseProject(legacy);
 assert.deepEqual(restored.profiles,[]);assert.deepEqual(restored.classifiers[0].attributes,[]);assert.equal(restored.diagrams[0].view.zoom,1);assert.deepEqual(restored.diagrams[0].view.pan,{x:50,y:40});assert.equal(restored.diagrams[0].view.nodes[c.id].w,220);
});

test('multiplicities parse bounded and unbounded ranges',()=>{
 for(const value of ['0..1','1','0..*','1..*','2..5'])assert.equal(validMultiplicity(value),true,value);
 for(const value of ['*..2','5..2','1..x',''])assert.equal(validMultiplicity(value),false,value);
});

test('validation detects inheritance cycles, interface realization targets, composition owners and multiplicity errors',()=>{
 const p=createProject(),d=p.diagrams[0],a=addClassifier(p,d,'class'),b=addClassifier(p,d,'class'),i=addClassifier(p,d,'interface'),x=addClassifier(p,d,'class');
 addRelationship(p,d,'generalization',a.id,b.id);addRelationship(p,d,'generalization',b.id,a.id);const invalidRealization=addRelationship(p,d,'realization',x.id,i.id);invalidRealization.targetId=b.id;
 const c1=addRelationship(p,d,'composition',a.id,x.id),c2=addRelationship(p,d,'composition',b.id,x.id);c1.targetEnd.multiplicity='5..2';
 const codes=validateProject(p).map(issue=>issue.code);
 assert.ok(codes.includes('generalization.cycle'));assert.ok(codes.includes('realization.target'));assert.ok(codes.includes('composition.multiple_owners'));assert.ok(codes.includes('multiplicity.invalid'));
});

test('relationship creation rejects a realization whose supplier is not an interface',()=>{
 const p=createProject(),d=p.diagrams[0],a=addClassifier(p,d,'class'),b=addClassifier(p,d,'class');
 assert.throws(()=>addRelationship(p,d,'realization',a.id,b.id),/interface/);
});

test('automatic routes avoid classifier rectangles and reflexive associations loop outside the class',()=>{
 const source={x:0,y:100,w:180,h:100},target={x:500,y:100,w:180,h:100},obstacle={x:240,y:80,w:180,h:150};
 const route=routeRelationship({source,target,obstacles:[obstacle]});
 assert.ok(route.points.length>=4);
 for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i];assert.ok(!(Math.abs(a.y-b.y)<.5&&a.y>obstacle.y&&a.y<obstacle.y+obstacle.h&&Math.max(Math.min(a.x,b.x),obstacle.x)<Math.min(Math.max(a.x,b.x),obstacle.x+obstacle.w)));}
 const self=routeRelationship({source,self:true});assert.notDeepEqual(self.points[0],self.points.at(-1));assert.ok(Math.min(...self.points.map(point=>point.y))<source.y);
});

test('graph organization preserves relationships and classifier identity',()=>{
 const p=createProject(),d=p.diagrams[0],parent=addClassifier(p,d,'class',200,220),child=addClassifier(p,d,'class',200,220),implementer=addClassifier(p,d,'class',200,220),api=addClassifier(p,d,'interface',200,220);const generalization=addRelationship(p,d,'generalization',child.id,parent.id),realization=addRelationship(p,d,'realization',implementer.id,api.id),before=p.relationships.map(item=>[item.id,item.sourceId,item.targetId]);
 const result=autoLayoutClassDiagram(d,p.classifiers,p.relationships);assert.ok(result.moved>0);assert.deepEqual(p.relationships.map(item=>[item.id,item.sourceId,item.targetId]),before);assert.ok(d.view.nodes[parent.id].y<d.view.nodes[child.id].y);assert.ok(d.view.nodes[api.id].y<d.view.nodes[implementer.id].y);assert.ok(generalization.id&&realization.id);
});
