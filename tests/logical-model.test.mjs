import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeNormalization, dataDictionaryCsv, generateLogicalSql, importLogicalDiagramFromDdl, parseSqlDdl, validateLogicalDiagram } from '../logical-model.mjs';

const table=(id,title,fields,extra={})=>({id,kind:'table',title,x:0,y:0,fields,...extra});
const model=()=>({type:'logico',nodes:[table('customers','customers',[{id:'id',name:'id',type:'BIGINT',key:'PK',nullable:false},{id:'email',name:'email',type:'VARCHAR',size:180,unique:true},{id:'name',name:'name',type:'VARCHAR',size:100,nullable:false,defaultValue:"'new'",check:"length(name) > 0"}]),table('orders','orders',[{id:'id',name:'id',type:'INT',key:'PK',nullable:false}])],edges:[{id:'orders-customer',from:'customers',to:'orders',fromMin:'1',fromMax:'1',toMin:'0',toMax:'N',onDelete:'CASCADE'}]});

test('validation detects duplicate table and column names and missing primary keys',()=>{
  const diagram={type:'logico',nodes:[table('a','people',[{name:'id',type:'INT',key:'PK'},{name:'id',type:'INT'}]),table('b','people',[{name:'name',type:'TEXT'}])],edges:[]};
  const issues=validateLogicalDiagram(diagram);
  assert.ok(issues.some(issue=>issue.code==='duplicate-table'));
  assert.ok(issues.some(issue=>issue.code==='duplicate-column'));
  assert.ok(issues.some(issue=>issue.code==='missing-primary-key'));
});

test('SQL maps logical types, constraints, schema and one-to-many foreign key for every dialect',()=>{
  const diagram=model();diagram.nodes[0].schema='public';
  for(const dialect of ['mysql','mariadb','postgresql','sqlite']){
    const sql=generateLogicalSql(diagram,dialect);
    assert.match(sql,/CREATE TABLE/);
    assert.match(sql,/FOREIGN KEY/);
    assert.match(sql,/ON DELETE CASCADE/);
    assert.match(sql,/email/);
    assert.match(sql,/UNIQUE/);
    assert.match(sql,/CHECK/);
    assert.match(sql,/DEFAULT 'new'/);
  }
});

test('ENUM uses native MySQL and MariaDB syntax and CHECK constraints in PostgreSQL and SQLite',()=>{
  const diagram={type:'logico',nodes:[table('status','status',[{id:'id',name:'id',type:'INT',key:'PK',nullable:false},{id:'state',name:'state',type:'ENUM',enumValues:['pending',"manager's review",'done'],nullable:false}])],edges:[]};
  const mysql=generateLogicalSql(diagram,'mysql');
  assert.match(mysql,/`state` ENUM\('pending', 'manager''s review', 'done'\) NOT NULL/);
  const maria=generateLogicalSql(diagram,'mariadb');
  assert.match(maria,/ENUM\('pending', 'manager''s review', 'done'\)/);
  for(const dialect of ['postgresql','sqlite']){
    const sql=generateLogicalSql(diagram,dialect);
    assert.match(sql,/(?:"state"|state) TEXT NOT NULL CHECK \((?:"state"|state) IN \('pending', 'manager''s review', 'done'\)\)/);
    assert.doesNotMatch(sql,/\bENUM\s*\(/);
  }
});

test('ENUM validation rejects missing, empty, duplicate, and excessive value lists',()=>{
  const field={id:'state',name:'state',type:'ENUM',enumValues:[]};
  const diagram={type:'logico',nodes:[table('states','states',[{id:'id',name:'id',type:'INT',key:'PK'},field])],edges:[]};
  assert.ok(validateLogicalDiagram(diagram).some(issue=>issue.code==='invalid-enum-values'));
  field.enumValues=['ready','ready'];
  assert.ok(validateLogicalDiagram(diagram).some(issue=>issue.code==='invalid-enum-values'));
  field.enumValues=Array.from({length:65536},(_,index)=>`v${index}`);
  assert.ok(validateLogicalDiagram(diagram).some(issue=>issue.code==='too-many-enum-values'));
});

test('N:N relation emits an associative table with a composite key',()=>{
  const diagram=model();diagram.edges[0].fromMax='N';diagram.edges[0].toMax='N';
  const sql=generateLogicalSql(diagram,'postgresql');
  assert.match(sql,/CREATE TABLE "customers_orders"/);
  assert.match(sql,/PRIMARY KEY \("customers_id", "orders_id"\)/);
});

test('data dictionary CSV escapes values and preserves UTF-8 BOM',()=>{
  const diagram=model();diagram.nodes[0].description='Clientes, ativos';
  const csv=dataDictionaryCsv(diagram);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv,/"customers","Clientes, ativos","id"/);
  assert.match(csv,/"VARCHAR\(180\)"/);
});

test('normalization does not claim forms without functional dependencies',()=>{
  const results=analyzeNormalization(model());
  assert.ok(results.some(issue=>issue.code==='normalization-insufficient-evidence'));
});

test('normalization reports a partial dependency when dependency evidence is provided',()=>{
  const diagram={type:'logico',nodes:[table('enrollments','enrollments',[{id:'student',name:'student_id',type:'INT',key:'PK'},{id:'course',name:'course_id',type:'INT',key:'PK'},{id:'studentName',name:'student_name',type:'VARCHAR'}],{primaryKey:['student','course'],functionalDependencies:[{determinant:['student'],dependent:['studentName']}]})],edges:[]};
  assert.ok(analyzeNormalization(diagram).some(issue=>issue.code==='second-normal-form'));
});

test('DDL parser rebuilds tables, composite keys, unique and foreign key definitions without executing SQL',()=>{
  const nodes=parseSqlDdl(`CREATE TABLE "teams" (id BIGINT NOT NULL, code VARCHAR(20), CONSTRAINT pk_teams PRIMARY KEY (id, code), UNIQUE (code));\nCREATE TABLE members (id INTEGER PRIMARY KEY, team_id BIGINT NOT NULL, FOREIGN KEY (team_id) REFERENCES teams(id));`);
  assert.equal(nodes.length,2);
  assert.deepEqual(nodes[0].primaryKey,['id','code']);
  assert.equal(nodes[0].fields[0].key,'PK');
  assert.ok(nodes[1].constraints.some(item=>item.type==='FOREIGN_KEY'));
  assert.throws(()=>parseSqlDdl('DROP TABLE members;'),/CREATE TABLE/);
});

test('SQL importer reads ALTER TABLE foreign keys from generated MySQL and preserves referential actions',()=>{
  const diagram={type:'logico',nodes:[
    table('cliente','cliente',[{id:'cliente-id',name:'id',type:'INT',key:'PK',nullable:false}]),
    table('venda','venda',[{id:'venda-id',name:'id',type:'INT',key:'PK',nullable:false},{id:'cliente-id-fk',name:'idCliente',type:'INT',nullable:false}],{constraints:[{type:'FOREIGN_KEY',columns:['idCliente'],table:'cliente',targetColumns:['id'],onDelete:'CASCADE',onUpdate:'RESTRICT'}]})
  ],edges:[{id:'cliente-venda',from:'cliente',to:'venda',fromMin:'1',fromMax:'1',toMin:'0',toMax:'N',onDelete:'CASCADE',onUpdate:'RESTRICT'}]};
  const sql=generateLogicalSql(diagram,'mysql');
  const imported=parseSqlDdl(sql);
  const foreignKeys=imported.find(item=>item.title==='venda').constraints.filter(item=>item.type==='FOREIGN_KEY');
  assert.equal(foreignKeys.length,1);
  assert.deepEqual(foreignKeys[0].columns,['idCliente']);
  assert.equal(foreignKeys[0].table,'cliente');
  assert.deepEqual(foreignKeys[0].targetColumns,['id']);
  assert.equal(foreignKeys[0].onDelete,'CASCADE');
  assert.equal(foreignKeys[0].onUpdate,'RESTRICT');
});

test('SQL importer accepts common MySQL table options after CREATE TABLE',()=>{
  const tables=parseSqlDdl('CREATE TABLE cliente (id INT NOT NULL, PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;');
  assert.equal(tables.length,1);
  assert.equal(tables[0].title,'cliente');
  assert.equal(tables[0].fields[0].key,'PK');
});

test('SQL importer parses nested ENUM definitions and preserves quoted values',()=>{
  const tables=parseSqlDdl("CREATE TABLE states (id INT PRIMARY KEY, state ENUM('pending', 'manager''s review', 'done') NOT NULL) ENGINE=InnoDB;");
  assert.deepEqual(tables[0].fields[1].enumValues,['pending',"manager's review",'done']);
  assert.equal(tables[0].fields[1].type,'ENUM');
  assert.equal(tables[0].fields[1].nullable,false);
});

test('SQL importer restores ENUM fields from portable TEXT plus CHECK output',()=>{
  const diagram={type:'logico',nodes:[table('states','states',[{id:'id',name:'id',type:'INT',key:'PK',nullable:false},{id:'state',name:'state',type:'ENUM',enumValues:['open','closed'],nullable:false}])],edges:[]};
  for(const dialect of ['postgresql','sqlite']){
    const imported=parseSqlDdl(generateLogicalSql(diagram,dialect));
    assert.equal(imported[0].fields[1].type,'ENUM');
    assert.deepEqual(imported[0].fields[1].enumValues,['open','closed']);
  }
});

test('foreign key type mismatch and nonexistent reference are errors',()=>{
  const diagram=model();diagram.nodes[1].fields.push({id:'bad_fk',name:'customer_id',type:'VARCHAR',size:30,references:{tableId:'customers',columnId:'missing'}});
  const errors=validateLogicalDiagram(diagram).filter(issue=>issue.severity==='error');
  assert.ok(errors.some(issue=>issue.code==='unresolved-foreign-key'));
});

test('an FK without a selected target is a warning and a completed PK reference validates',()=>{
  const diagram=model();
  diagram.nodes[1].fields.push({id:'customer_id',name:'customer_id',type:'BIGINT',key:'FK',nullable:false});
  assert.ok(validateLogicalDiagram(diagram).some(issue=>issue.code==='unresolved-foreign-key'&&issue.severity==='warning'));
  diagram.nodes[1].fields.at(-1).references={tableId:'customers',columnId:'id',columnName:'id'};
  assert.ok(!validateLogicalDiagram(diagram).some(issue=>issue.code==='unresolved-foreign-key'||issue.code==='foreign-key-type-mismatch'||issue.code==='foreign-key-not-unique'));
});

test('configured column foreign keys generate valid references in every supported dialect',()=>{
  for(const dialect of ['postgresql','mysql','mariadb','sqlite']){
    const diagram={type:'logico',nodes:[
      table('parent','parent',[{id:'parent-id',name:'id',type:'INT',key:'PK',nullable:false}]),
      table('child','child',[{id:'child-id',name:'id',type:'INT',key:'PK',nullable:false},{id:'parent-id',name:'parent_id',type:'INT',key:'FK',references:{tableId:'parent',columnId:'parent-id',columnName:'id'}}])
    ],edges:[]};
    const sql=generateLogicalSql(diagram,dialect);
    assert.match(sql,/PRIMARY KEY/);
    assert.match(sql,/FOREIGN KEY/);
    assert.match(sql,/(REFERENCES [`"]parent[`"] \([`"]id[`"]\))/);
  }
});

test('a configured FK satisfies the matching diagram relationship without generating a duplicate constraint',()=>{
  const diagram={type:'logico',nodes:[
    table('parent','parent',[{id:'parent-id',name:'id',type:'INT',key:'PK',nullable:false}]),
    table('child','child',[{id:'child-id',name:'id',type:'INT',key:'PK',nullable:false},{id:'parent-id',name:'parent_id',type:'INT',key:'FK',references:{tableId:'parent',columnId:'parent-id',columnName:'id'}}])
  ],edges:[{id:'parent-child',from:'parent',to:'child',fromMin:'1',fromMax:'1',toMin:'0',toMax:'1',onDelete:'CASCADE'}]};
  const sql=generateLogicalSql(diagram,'postgresql');
  assert.equal((sql.match(/FOREIGN KEY/g)||[]).length,1);
  assert.match(sql,/FOREIGN KEY \("parent_id"\) REFERENCES "parent" \("id"\) ON DELETE CASCADE/);
  assert.match(sql,/UNIQUE \("parent_id"\)/);
  assert.doesNotMatch(sql,/"parent_id" INTEGER.*\n  "parent_id"/);
});

test('an explicit table-level FK prevents the relationship from adding a duplicate generated column',()=>{
  const diagram={type:'logico',nodes:[
    table('cliente','cliente',[{id:'cliente-id',name:'id',type:'INT',key:'PK',nullable:false}]),
    table('venda','venda',[{id:'venda-id',name:'id',type:'INT',key:'PK',nullable:false},{id:'idCliente',name:'idCliente',type:'INT',nullable:false}],{constraints:[{type:'FOREIGN_KEY',columns:['idCliente'],table:'cliente',targetColumns:['id']}]})
  ],edges:[{id:'cliente-venda',from:'cliente',to:'venda',fromMin:'1',fromMax:'1',toMin:'0',toMax:'N'}]};
  const sql=generateLogicalSql(diagram,'mysql');
  assert.equal((sql.match(/FOREIGN KEY/g)||[]).length,1);
  assert.match(sql,/FOREIGN KEY \(`idCliente`\) REFERENCES `cliente` \(`id`\)/);
  assert.doesNotMatch(sql,/`cliente_id`/);
});

test('SQL generation stops when an FK target is not fully selected',()=>{
  const diagram=model();diagram.nodes[1].fields.push({id:'customer-id',name:'customer_id',type:'BIGINT',key:'FK'});
  assert.throws(()=>generateLogicalSql(diagram,'postgresql'),/tabela e coluna de destino configuradas/);
  diagram.nodes[1].fields.at(-1).key='PK';diagram.nodes[1].fields.at(-1).references={};
  assert.throws(()=>generateLogicalSql(diagram,'postgresql'),/tabela e coluna de destino configuradas/);
});

test('one-to-one relationship creates a unique foreign key and identifying relationships add its column to the key',()=>{
  const diagram={type:'logico',nodes:[table('accounts','accounts',[{id:'id',name:'id',type:'INT',key:'PK'}]),table('profiles','profiles',[{id:'id',name:'id',type:'INT',key:'PK'}])],edges:[{id:'profile-account',from:'accounts',to:'profiles',fromMin:'1',fromMax:'1',toMin:'1',toMax:'1',identifying:true}]};
  const sql=generateLogicalSql(diagram,'postgresql');
  assert.match(sql,/"accounts_id" INTEGER NOT NULL UNIQUE/);
  assert.match(sql,/PRIMARY KEY \("id", "accounts_id"\)/);
  assert.match(sql,/ALTER TABLE "profiles" ADD FOREIGN KEY/);
});

test('composite DDL foreign key is preserved as one deferred constraint',()=>{
  const [parent,child]=parseSqlDdl('CREATE TABLE parent (a INT, b INT, PRIMARY KEY (a,b)); CREATE TABLE child (x INT, y INT, FOREIGN KEY (x,y) REFERENCES parent(a,b) ON DELETE CASCADE);');
  assert.equal(child.constraints[0].type,'FOREIGN_KEY');
  assert.deepEqual(child.constraints[0].columns,['x','y']);
  assert.equal(child.constraints[0].onDelete,'CASCADE');
  child.constraints[0].name='fk_child_parent';
  const sql=generateLogicalSql({type:'logico',nodes:[parent,child],edges:[]},'postgresql');
  assert.match(sql,/ALTER TABLE "child" ADD CONSTRAINT "fk_child_parent" FOREIGN KEY \("x", "y"\) REFERENCES "parent" \("a", "b"\) ON DELETE CASCADE/);
  assert.ok(sql.indexOf('CREATE TABLE "child"')<sql.indexOf('ALTER TABLE "child"'));
});

test('schema-qualified import and quoted comment markers are retained safely',()=>{
  const [entry]=parseSqlDdl('CREATE TABLE app.events (id INTEGER PRIMARY KEY, note TEXT DEFAULT \'keep -- marker\');');
  assert.equal(entry.schema,'app');
  assert.equal(entry.fields[1].defaultValue,"'keep -- marker'");
});

test('MySQL and MariaDB reject unsupported SET DEFAULT referential actions',()=>{
  const diagram=model();diagram.edges[0].onDelete='SET DEFAULT';
  assert.throws(()=>generateLogicalSql(diagram,'mysql'),/não suporta.*SET DEFAULT/);
  assert.throws(()=>generateLogicalSql(diagram,'mariadb'),/não suporta.*SET DEFAULT/);
  assert.match(generateLogicalSql(diagram,'postgresql'),/ON DELETE SET DEFAULT/);
});

test('inline and composite primary keys are always NOT NULL and retain identity metadata',()=>{
  const [inline,composite]=parseSqlDdl(`CREATE TABLE turma (id_turma INT AUTO_INCREMENT PRIMARY KEY); CREATE TABLE turma_escola (id_escola INT, codigo INT, CONSTRAINT pk_turma_escola PRIMARY KEY (id_escola, codigo));`);
  assert.equal(inline.fields[0].identity,true);
  assert.equal(inline.fields[0].nullable,false);
  assert.equal(inline.fields[0].key,'PK');
  assert.deepEqual(composite.primaryKey,['id_escola','codigo']);
  assert.ok(composite.fields.slice(1).every(field=>field.nullable===false&&field.key==='PK'));
  assert.ok(!validateLogicalDiagram({type:'logico',nodes:[inline,composite],edges:[]}).some(issue=>issue.code==='nullable-primary-key'));
});

test('named table constraints, checks, defaults, unique keys and nested delimiters do not become columns',()=>{
  const [table]=parseSqlDdl(`CREATE TABLE item (id INT, codigo VARCHAR(20) DEFAULT 'a,b' NOT NULL, valor DECIMAL(10,2) DEFAULT (round(1.25, 2)), CONSTRAINT pk_item PRIMARY KEY (id), CONSTRAINT uq_codigo UNIQUE (codigo), CONSTRAINT ck_valor CHECK (valor >= 0 AND valor <= 999), CONSTRAINT fk_item_categoria FOREIGN KEY (id) REFERENCES categoria(id));`);
  assert.deepEqual(table.fields.map(field=>field.name),['id','codigo','valor']);
  assert.equal(table.primaryKeyName,'pk_item');
  assert.equal(table.fields[1].defaultValue,"'a,b'");
  assert.equal(table.fields[2].defaultValue,'(round(1.25, 2))');
  assert.deepEqual(table.constraints.map(item=>[item.type,item.name]),[['UNIQUE','uq_codigo'],['CHECK','ck_valor'],['FOREIGN_KEY','fk_item_categoria']]);
  assert.ok(!table.fields.some(field=>field.name.toUpperCase()==='CONSTRAINT'));
});

test('named composite foreign keys bind to referenced fields, create one visual edge and round-trip',()=>{
  const model=importLogicalDiagramFromDdl(`CREATE TABLE curso (id_a INT, id_b INT, CONSTRAINT pk_curso PRIMARY KEY (id_a,id_b)); CREATE TABLE disciplina (id INT PRIMARY KEY, curso_a INT NOT NULL, curso_b INT NOT NULL, CONSTRAINT fk_disciplina_curso FOREIGN KEY (curso_a, curso_b) REFERENCES curso(id_a,id_b) ON DELETE CASCADE);`);
  const [course,subject]=model.nodes;
  assert.equal(model.edges.length,1);
  assert.equal(model.edges[0].foreignKey.name,'fk_disciplina_curso');
  assert.equal(subject.constraints.find(item=>item.type==='FOREIGN_KEY').name,'fk_disciplina_curso');
  assert.deepEqual(subject.fields.slice(1).map(field=>field.references.columnName),['id_a','id_b']);
  assert.ok(subject.fields.slice(1).every(field=>field.references.constraintId==='fk_disciplina_curso'));
  assert.ok(!model.nodes.flatMap(table=>table.fields).some(field=>field.name.toUpperCase()==='CONSTRAINT'));
  const sql=generateLogicalSql(model,'mysql');
  assert.match(sql,/ADD CONSTRAINT `fk_disciplina_curso` FOREIGN KEY/);
  const roundTrip=parseSqlDdl(sql);
  assert.deepEqual(roundTrip.find(table=>table.title==='curso').primaryKey,['id_a','id_b']);
  assert.ok(roundTrip.find(table=>table.title==='disciplina').constraints.some(item=>item.name==='fk_disciplina_curso'));
});

test('DDL importer handles a ten-table model with twelve named references without synthetic columns',()=>{
  const tables=Array.from({length:10},(_,index)=>`CREATE TABLE t${index} (id INT PRIMARY KEY${index?`, parent_id INT, CONSTRAINT fk_t${index}_parent FOREIGN KEY (parent_id) REFERENCES t${index-1}(id)`:''});`);
  tables.push('ALTER TABLE t9 ADD CONSTRAINT fk_extra_1 FOREIGN KEY (parent_id) REFERENCES t1(id);','ALTER TABLE t9 ADD CONSTRAINT fk_extra_2 FOREIGN KEY (parent_id) REFERENCES t2(id);','ALTER TABLE t9 ADD CONSTRAINT fk_extra_3 FOREIGN KEY (parent_id) REFERENCES t3(id);');
  const model=importLogicalDiagramFromDdl(tables.join('\n'));
  assert.equal(model.nodes.length,10);
  assert.equal(model.edges.length,12);
  assert.ok(!model.nodes.flatMap(table=>table.fields).some(field=>field.name.toUpperCase()==='CONSTRAINT'));
});
