import test from 'node:test';
import assert from 'node:assert/strict';
import {conceptualDictionaryCsv, convertConceptualToLogical, materializeConceptualAttributeNodes, normalizeConceptualDiagram, validateConceptualDiagram} from '../conceptual-model.mjs';
import {generateLogicalSql, validateLogicalDiagram} from '../logical-model.mjs';

const entity=(id,title,fields=[],extra={})=>({id,kind:'entity',title,x:20,y:20,fields,...extra});
const relation=(id,title='relaciona',extra={})=>({id,kind:'relationship',title,x:150,y:20,fields:[],...extra});
const edge=(id,from,to,fromMax='1',toMax='N',extra={})=>({id,from,to,fromMin:'1',fromMax,toMin:'1',toMax,...extra});

test('normalizes legacy conceptual attributes while preserving current entity diagrams',()=>{
  const diagram={type:'conceitual',nodes:[entity('customer','Cliente',['id','nome'])],edges:[]};
  normalizeConceptualDiagram(diagram);
  assert.equal(diagram.conceptual.notation,'chen');
  assert.deepEqual(diagram.nodes[0].fields.map(field=>field.name),['id','nome']);
  assert.ok(diagram.nodes[0].fields.every(field=>field.kind==='simple'&&field.id));
});

test('migrates entity fields into connected attribute nodes idempotently',()=>{
  const model={id:'separate-attrs',type:'conceitual',title:'Modelo',nodes:[entity('course','Turma',[{id:'course-id',name:'id_Turma',identifier:true,required:true},{id:'capacity',name:'capacidade',domain:'inteiro'}])],edges:[]};
  materializeConceptualAttributeNodes(model);
  const owner=model.nodes.find(node=>node.id==='course'),idAttribute=model.nodes.find(node=>node.id==='course-id');
  assert.deepEqual(owner.fields,[]);
  assert.equal(idAttribute.kind,'attribute');
  assert.equal(idAttribute.conceptual.identifier,true);
  assert.ok(model.edges.some(edge=>edge.from==='course'&&edge.to==='course-id'));
  assert.equal(validateConceptualDiagram(model).some(issue=>issue.code==='missing-identifier'),false);
  const nodeCount=model.nodes.length,edgeCount=model.edges.length;
  materializeConceptualAttributeNodes(model);
  assert.equal(model.nodes.length,nodeCount);
  assert.equal(model.edges.length,edgeCount);
});

test('uses standalone Chen attribute nodes when attached to an entity or relationship',()=>{
  const customer=entity('customer','Cliente',[{id:'id',name:'id',identifier:true}]);
  const phone={id:'phone',kind:'attribute',title:'telefones',x:0,y:0,conceptual:{attributeKind:'multivalued',domain:'telefone'}};
  const model={id:'attached',type:'conceitual',title:'Cliente',nodes:[customer,phone],edges:[edge('phone-owner','customer','phone')]};
  assert.ok(!validateConceptualDiagram(model).some(issue=>issue.code==='unattached-attribute'));
  const converted=convertConceptualToLogical(model);
  assert.ok(converted.nodes.some(table=>table.conceptualSourceId==='phone'));
});

test('validates identifiers, weak entities and identifying participation',()=>{
  const weak=entity('item','Item',[{id:'no',name:'numero',kind:'simple',identifier:true}],{conceptual:{entityKind:'weak',partialKey:'numero'}});
  const issues=validateConceptualDiagram({type:'conceitual',nodes:[entity('order','Pedido',[{name:'id',identifier:true}]),weak,relation('owns')],edges:[edge('owner','order','owns'),edge('owned','owns','item')]});
  assert.ok(issues.some(issue=>issue.code==='weak-without-identifying-relationship'));
  const model={type:'conceitual',nodes:[entity('order','Pedido',[{name:'id',identifier:true}]),weak,relation('owns','identifica',{conceptual:{identifying:true}})],edges:[edge('owner','order','owns'),edge('owned','owns','item')]};
  assert.ok(!validateConceptualDiagram(model).some(issue=>issue.code==='weak-without-identifying-relationship'));
});

test('validates n-ary relations and total participation cardinality',()=>{
  const nodes=[entity('a','A',[{name:'id',identifier:true}]),entity('b','B',[{name:'id',identifier:true}]),entity('c','C',[{name:'id',identifier:true}]),relation('r','Fornece')];
  const model={type:'conceitual',nodes,edges:[edge('ra','r','a','1','N',{totalParticipation:true}),edge('rb','r','b','1','N'),edge('rc','r','c','1','N')]};
  const issues=validateConceptualDiagram(model);
  assert.ok(!issues.some(issue=>issue.code==='relationship-degree'));
  assert.ok(!issues.some(issue=>issue.code==='participation-cardinality-mismatch'));
  model.edges[0].toMin='0';
  assert.ok(validateConceptualDiagram(model).some(issue=>issue.code==='participation-cardinality-mismatch'));
});

test('requires one ISA supertype and at least two subtype roles',()=>{
  const isa={id:'isa',kind:'specialization',title:'ISA',x:0,y:0};
  const model={type:'conceitual',nodes:[entity('person','Pessoa',[{name:'cpf',identifier:true}]),entity('student','Aluno'),entity('teacher','Professor'),isa],edges:[edge('p','person','isa','1','1'),edge('s','isa','student','1','1',{role:'subtype'}),edge('t','isa','teacher','1','1',{role:'subtype'})]};
  assert.ok(validateConceptualDiagram(model).some(issue=>issue.code==='specialization-roles'));
  model.edges[0].role='supertype';
  assert.ok(!validateConceptualDiagram(model).some(issue=>issue.code==='specialization-roles'));
});

test('converts binary N:N and ternary relationships into associative logical tables',()=>{
  const nodes=[entity('a','Aluno',[{id:'aid',name:'id',identifier:true}]),entity('b','Curso',[{id:'bid',name:'id',identifier:true}]),entity('c','Turma',[{id:'cid',name:'id',identifier:true}]),relation('r','Matricula',{fields:[{id:'date',name:'data',kind:'simple',required:true}]})];
  const manyMany=convertConceptualToLogical({id:'cc',type:'conceitual',title:'Conceitual',nodes:nodes.slice(0,2).concat(nodes[3]),edges:[edge('ra','r','a','1','N'),edge('rb','r','b','1','N')]});
  const associative=manyMany.nodes.find(table=>table.conceptualSourceId==='r');
  assert.ok(associative);
  assert.ok(associative.fields.some(field=>field.name==='data'));
  assert.equal(associative.primaryKey.length,2);
  assert.ok(!validateLogicalDiagram(manyMany).some(issue=>issue.severity==='error'));
  assert.match(generateLogicalSql(manyMany,'postgresql'),/CREATE TABLE "matricula"/);
  const ternary=convertConceptualToLogical({id:'ct',type:'conceitual',title:'Ternario',nodes,edges:[edge('ra','r','a'),edge('rb','r','b'),edge('rc','r','c')]});
  assert.ok(ternary.nodes.some(table=>table.conceptualSourceId==='r'&&table.fields.length===4));
});

test('converts 1:N by placing a foreign key on the many side and keeps relation attributes',()=>{
  const nodes=[entity('company','Empresa',[{id:'company-id',name:'id',identifier:true}]),entity('employee','Funcionário',[{id:'employee-id',name:'id',identifier:true}]),relation('works','Trabalha em',{fields:[{id:'since',name:'desde',kind:'simple',required:true}]})];
  const model=convertConceptualToLogical({id:'one-many',type:'conceitual',title:'Empregados',nodes,edges:[edge('company-works','company','works','1','1'),edge('works-employee','works','employee','1','N')]});
  const employees=model.nodes.find(table=>table.conceptualSourceId==='employee');
  assert.ok(employees.fields.some(field=>field.references?.tableId==='logical:company'));
  assert.ok(employees.fields.some(field=>field.name==='desde'));
  assert.ok(!validateLogicalDiagram(model).some(issue=>issue.severity==='error'));
  assert.match(generateLogicalSql(model,'postgresql'),/FOREIGN KEY/);
});

test('converts multi-valued attributes to separate tables and omits derived values',()=>{
  const model={id:'c',type:'conceitual',title:'Pessoa',nodes:[entity('p','Pessoa',[{id:'id',name:'id',kind:'simple',identifier:true},{id:'phones',name:'telefones',kind:'multivalued'},{id:'age',name:'idade',kind:'derived',derivation:'data atual - nascimento'}])],edges:[]};
  const converted=convertConceptualToLogical(model);
  assert.ok(converted.nodes.some(table=>table.conceptualSourceId==='phones'));
  const people=converted.nodes.find(table=>table.conceptualSourceId==='p');
  assert.ok(!people.fields.some(field=>field.name==='idade'));
});

test('decomposes compound attributes and detects composition cycles',()=>{
  const person=entity('person','Pessoa',[{id:'address',name:'endereco',kind:'composite'},{id:'street',name:'rua',kind:'simple',parentId:'address'},{id:'city',name:'cidade',kind:'simple',parentId:'address'},{id:'id',name:'cpf',kind:'simple',identifier:true}]);
  const model={id:'compound',type:'conceitual',title:'Pessoa',nodes:[person],edges:[]};
  const converted=convertConceptualToLogical(model),table=converted.nodes[0];
  assert.ok(table.fields.some(field=>field.name==='rua'));
  assert.ok(table.fields.some(field=>field.name==='cidade'));
  assert.ok(!table.fields.some(field=>field.name==='endereco'));
  person.fields[0].parentId='street';
  assert.ok(validateConceptualDiagram(model).some(issue=>issue.code==='attribute-composition-cycle'));
});

test('converts weak entities with their owner key and joined ISA subtypes with inherited keys',()=>{
  const customer=entity('customer','Cliente',[{id:'customer-id',name:'codigo',kind:'simple',identifier:true}]);
  const weak=entity('line','Item',[{id:'line-no',name:'numero',kind:'simple',identifier:true}],{conceptual:{entityKind:'weak',partialKey:'numero'}});
  const identifying=relation('identifies','identifica',{conceptual:{identifying:true}});
  const order=entity('person','Pessoa',[{id:'person-id',name:'cpf',kind:'simple',identifier:true}]);
  const student=entity('student','Aluno',[{id:'student-code',name:'matricula',kind:'simple',identifier:true}]);
  const isa={id:'isa',kind:'specialization',title:'ISA',x:0,y:0,conceptual:{completeness:'total',disjointness:'disjoint'}};
  const model={id:'full',type:'conceitual',title:'Conceitual',nodes:[customer,weak,identifying,order,student,isa],edges:[edge('owner','customer','identifies'),edge('owned','identifies','line','1','N'),edge('super','person','isa','1','1',{role:'supertype'}),edge('sub','isa','student','1','1',{role:'subtype'})]};
  const converted=convertConceptualToLogical(model);
  const itemTable=converted.nodes.find(table=>table.conceptualSourceId==='line');
  assert.equal(itemTable.fields.filter(field=>field.key==='PK').length,2);
  const studentTable=converted.nodes.find(table=>table.conceptualSourceId==='student');
  assert.ok(studentTable.fields.some(field=>field.references?.tableId==='logical:person'&&field.key==='PK'));
  assert.equal(studentTable.fields.filter(field=>field.key==='PK').length,1);
});

test('exports a UTF-8 conceptual data dictionary with relationships and roles',()=>{
  const model={type:'conceitual',nodes:[entity('a','Aluno',[{name:'id',identifier:true}]),entity('b','Curso',[{name:'id',identifier:true}]),relation('r','Matricula')],edges:[edge('ra','r','a','1','N',{role:'estudante'})]};
  const csv=conceptualDictionaryCsv(model);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv,/Matricula/);
  assert.match(csv,/estudante/);
});
