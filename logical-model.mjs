const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_$]*$/;
const TYPE_MAP = {
  INTEGER: { mysql: 'INT', mariadb: 'INT', postgresql: 'INTEGER', sqlite: 'INTEGER' },
  INT: { mysql: 'INT', mariadb: 'INT', postgresql: 'INTEGER', sqlite: 'INTEGER' },
  BIGINT: { mysql: 'BIGINT', mariadb: 'BIGINT', postgresql: 'BIGINT', sqlite: 'INTEGER' },
  SMALLINT: { mysql: 'SMALLINT', mariadb: 'SMALLINT', postgresql: 'SMALLINT', sqlite: 'INTEGER' },
  TINYINT: { mysql: 'TINYINT', mariadb: 'TINYINT', postgresql: 'SMALLINT', sqlite: 'INTEGER' },
  DECIMAL: { mysql: 'DECIMAL', mariadb: 'DECIMAL', postgresql: 'DECIMAL', sqlite: 'NUMERIC' },
  NUMERIC: { mysql: 'NUMERIC', mariadb: 'NUMERIC', postgresql: 'NUMERIC', sqlite: 'NUMERIC' },
  FLOAT: { mysql: 'FLOAT', mariadb: 'FLOAT', postgresql: 'REAL', sqlite: 'REAL' },
  DOUBLE: { mysql: 'DOUBLE', mariadb: 'DOUBLE', postgresql: 'DOUBLE PRECISION', sqlite: 'REAL' },
  BOOLEAN: { mysql: 'BOOLEAN', mariadb: 'BOOLEAN', postgresql: 'BOOLEAN', sqlite: 'INTEGER' },
  VARCHAR: { mysql: 'VARCHAR', mariadb: 'VARCHAR', postgresql: 'VARCHAR', sqlite: 'TEXT' },
  CHAR: { mysql: 'CHAR', mariadb: 'CHAR', postgresql: 'CHAR', sqlite: 'TEXT' },
  TEXT: { mysql: 'TEXT', mariadb: 'TEXT', postgresql: 'TEXT', sqlite: 'TEXT' },
  DATE: { mysql: 'DATE', mariadb: 'DATE', postgresql: 'DATE', sqlite: 'TEXT' },
  TIME: { mysql: 'TIME', mariadb: 'TIME', postgresql: 'TIME', sqlite: 'TEXT' },
  DATETIME: { mysql: 'DATETIME', mariadb: 'DATETIME', postgresql: 'TIMESTAMP', sqlite: 'TEXT' },
  TIMESTAMP: { mysql: 'TIMESTAMP', mariadb: 'TIMESTAMP', postgresql: 'TIMESTAMP', sqlite: 'TEXT' },
  BLOB: { mysql: 'BLOB', mariadb: 'BLOB', postgresql: 'BYTEA', sqlite: 'BLOB' },
  VARBINARY: { mysql: 'VARBINARY', mariadb: 'VARBINARY', postgresql: 'BYTEA', sqlite: 'BLOB' },
  UUID: { mysql: 'CHAR(36)', mariadb: 'CHAR(36)', postgresql: 'UUID', sqlite: 'TEXT' },
  JSON: { mysql: 'JSON', mariadb: 'JSON', postgresql: 'JSONB', sqlite: 'TEXT' },
  ENUM: { mysql: 'ENUM', mariadb: 'ENUM', postgresql: 'TEXT', sqlite: 'TEXT' }
};
const ACTIONS = new Set(['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT']);
const norm = value => String(value ?? '').trim().toLowerCase();
const tableNodes = diagram => (diagram?.nodes || []).filter(node => node.kind === 'table');
const logicalType = field => String(field.type || 'VARCHAR').toUpperCase();
const columnId = field => field.id || field.name;
const columnIsUnique = (table,field) => {
  if(!table||!field)return false;
  const primary=table.primaryKey?.length?table.primaryKey:table.fields.filter(item=>item.key==='PK').map(columnId);
  const singlePrimary=primary.length===1&&(primary[0]===columnId(field)||primary[0]===field.name);
  return Boolean(field.unique||singlePrimary||(table.constraints||[]).some(constraint=>constraint.type==='UNIQUE'&&constraint.columns?.length===1&&(constraint.columns[0]===columnId(field)||constraint.columns[0]===field.name)));
};

export function validateLogicalDiagram(diagram, { warnWithoutPrimaryKey = true } = {}) {
  const issues = [];
  const tables = tableNodes(diagram);
  const add = (severity, code, message, elementId) => issues.push({ severity, code, message, elementId });
  const tableNames = new Map();
  for (const table of tables) {
    const schemaName = norm(table.schema || 'public');
    const tableKey = `${schemaName}.${norm(table.title)}`;
    if (!IDENTIFIER.test(table.title || '')) add('error', 'invalid-table-name', `Nome de tabela inválido: ${table.title || '(vazio)'}. Use letras, números e _; comece com letra ou _.`, table.id);
    if (table.schema && !IDENTIFIER.test(table.schema)) add('error', 'invalid-schema-name', `Nome de schema inválido: ${table.schema}.`, table.id);
    if (tableNames.has(tableKey)) add('error', 'duplicate-table', `Tabela duplicada no schema ${table.schema || 'public'}: ${table.title}.`, table.id);
    tableNames.set(tableKey, table.id);
    const fields = table.fields || [];
    const names = new Map();
    for (const field of fields) {
      const fieldName = String(field.name || '');
      if (!IDENTIFIER.test(fieldName)) add('error', 'invalid-column-name', `Nome de coluna inválido em ${table.title}: ${fieldName || '(vazio)'}.`, table.id);
      if (names.has(norm(fieldName))) add('error', 'duplicate-column', `Coluna duplicada em ${table.title}: ${fieldName}.`, table.id);
      names.set(norm(fieldName), field);
      const type = logicalType(field);
      if (!TYPE_MAP[type] && !/^[A-Z][A-Z0-9_ ]*$/.test(type)) add('error', 'invalid-column-type', `Tipo inválido em ${table.title}.${fieldName}: ${type}.`, table.id);
      if (type === 'ENUM') {
        const values = field.enumValues;
        if (!Array.isArray(values) || values.length === 0 || values.some(value => typeof value !== 'string' || value.length === 0) || new Set(values).size !== values.length) add('error', 'invalid-enum-values', `${table.title}.${fieldName} precisa de valores ENUM não vazios e sem duplicatas.`, table.id);
        else if (values.length > 65535) add('error', 'too-many-enum-values', `${table.title}.${fieldName} excede o limite de 65.535 valores ENUM.`, table.id);
      }
      if (['VARCHAR', 'CHAR', 'VARBINARY'].includes(type) && (!Number.isInteger(Number(field.size)) || Number(field.size) < 1)) add('error', 'invalid-column-size', `${table.title}.${fieldName} precisa de um tamanho maior que zero.`, table.id);
      if (['DECIMAL', 'NUMERIC'].includes(type) && field.precision != null && (!Number.isInteger(Number(field.precision)) || Number(field.precision) < 1 || Number(field.scale || 0) > Number(field.precision))) add('error', 'invalid-precision', `Precisão/escala inválida em ${table.title}.${fieldName}.`, table.id);
      if ((field.key === 'PK' || table.primaryKey?.includes(columnId(field))) && field.nullable === true) add('error', 'nullable-primary-key', `A coluna da chave primária ${table.title}.${fieldName} não pode aceitar NULL.`, table.id);
      if (field.check && /;|--|\/\*/.test(field.check)) add('error', 'unsafe-check', `CHECK de ${table.title}.${fieldName} contém separadores ou comentários não aceitos.`, table.id);
      const hasForeignKeyTarget=Boolean(field.references?.tableId&&(field.references.columnId||field.references.columnName));
      if ((field.key === 'FK' || field.references) && !hasForeignKeyTarget) add('warning', 'unresolved-foreign-key', `Coluna marcada como FK em ${table.title}.${fieldName} sem tabela e coluna de destino configuradas.`, table.id);
      if (hasForeignKeyTarget) {
        const target = tables.find(row => row.id === field.references.tableId);
        const targetField = target?.fields?.find(row => columnId(row) === field.references.columnId || row.name === field.references.columnName);
        if (!target || !targetField) add('error', 'unresolved-foreign-key', `A referência de ${table.title}.${fieldName} aponta para uma tabela ou coluna inexistente.`, table.id);
        else if (logicalType(targetField) !== type || (field.size!=null&&targetField.size!=null&&Number(field.size)!==Number(targetField.size)) || (field.precision!=null&&targetField.precision!=null&&(Number(field.precision)!==Number(targetField.precision)||Number(field.scale||0)!==Number(targetField.scale||0)))) add('error', 'foreign-key-type-mismatch', `Tipos ou dimensões incompatíveis em ${table.title}.${fieldName} e ${target.title}.${targetField.name}.`, table.id);
        else if (!field.references.constraintId && !columnIsUnique(target,targetField)) add('error', 'foreign-key-not-unique', `${target.title}.${targetField.name} não é PK nem UNIQUE.`, table.id);
        if ((field.references.onDelete === 'SET NULL' || field.references.onUpdate === 'SET NULL') && field.nullable === false) add('error', 'referential-action-nullability', `A FK ${table.title}.${field.name} usa SET NULL, mas não aceita NULL.`, table.id);
        if ((field.references.onDelete === 'SET DEFAULT' || field.references.onUpdate === 'SET DEFAULT') && (field.defaultValue == null || field.defaultValue === '')) add('error', 'referential-action-default', `A FK ${table.title}.${field.name} usa SET DEFAULT sem valor padrão.`, table.id);
      }
    }
    const primary = table.primaryKey?.length ? table.primaryKey : fields.filter(field => field.key === 'PK').map(columnId);
    if (!primary.length && warnWithoutPrimaryKey) add('warning', 'missing-primary-key', `${table.title} não possui chave primária.`, table.id);
    for (const id of primary) if (!fields.some(field => columnId(field) === id || field.name === id)) add('error', 'missing-primary-key-column', `A chave primária de ${table.title} referencia uma coluna inexistente (${id}).`, table.id);
    for (const constraint of table.constraints || []) {
      if (constraint.type === 'CHECK' && /;|--|\/\*/.test(constraint.expression || '')) add('error', 'unsafe-check', `CHECK inválido em ${table.title}.`, table.id);
      if (constraint.type === 'UNIQUE' && !(constraint.columns || []).every(name => fields.some(field => columnId(field) === name || field.name === name))) add('error', 'invalid-unique', `UNIQUE de ${table.title} referencia coluna inexistente.`, table.id);
      if (constraint.type === 'FOREIGN_KEY' && (!(constraint.columns || []).length || constraint.columns.length !== (constraint.targetColumns || []).length || !(constraint.columns || []).every(name => fields.some(field => columnId(field) === name || field.name === name)))) add('error', 'invalid-composite-foreign-key', `Chave estrangeira composta inválida em ${table.title}.`, table.id);
      if(constraint.type==='FOREIGN_KEY'){
        const target=tables.find(item=>item.title.toLowerCase()===String(constraint.table).toLowerCase()&&(!constraint.schema||norm(item.schema)===norm(constraint.schema)));
        const sourceFields=(constraint.columns||[]).map(name=>fields.find(field=>field.name===name));
        const targetFields=(constraint.targetColumns||[]).map(name=>target?.fields.find(field=>field.name===name));
        if(!target||targetFields.some(field=>!field))add('error','unresolved-composite-foreign-key',`Chave estrangeira de ${table.title} aponta para tabela ou coluna inexistente.`,table.id);
        else {
          if(sourceFields.some((field,index)=>logicalType(field)!==logicalType(targetFields[index])||(field.size!=null&&targetFields[index].size!=null&&Number(field.size)!==Number(targetFields[index].size))))add('error','foreign-key-type-mismatch',`Tipos ou dimensões incompatíveis na chave estrangeira composta de ${table.title}.`,table.id);
          const primaryIds=target.primaryKey?.length?target.primaryKey:target.fields.filter(field=>field.key==='PK').map(columnId);
          const targetKeys=[primaryIds.map(id=>target.fields.find(field=>columnId(field)===id||field.name===id)?.name).filter(Boolean),...(target.constraints||[]).filter(item=>item.type==='UNIQUE').map(item=>item.columns.map(id=>target.fields.find(field=>columnId(field)===id||field.name===id)?.name).filter(Boolean)),...target.fields.filter(field=>field.unique).map(field=>[field.name])];
          const referenced=[...(constraint.targetColumns||[])].sort().join('|');
          if(!targetKeys.some(key=>key.length===constraint.targetColumns.length&&[...key].sort().join('|')===referenced))add('error','foreign-key-not-unique',`As colunas referenciadas por ${table.title} não formam uma chave única em ${target.title}.`,table.id);
        }
      }
    }
  }
  for (const edge of diagram?.edges || []) {
    const from = tables.find(table => table.id === edge.from), to = tables.find(table => table.id === edge.to);
    if (!from || !to) {
      if (diagram?.type === 'logico') add('error', 'invalid-relationship-endpoint', 'Relação lógica precisa conectar duas tabelas existentes.', edge.id);
      continue;
    }
    const validEnd = (min, max) => ['0', '1'].includes(String(min)) && ['1', 'N'].includes(String(max)) && !(String(min) === '1' && String(max) === 'N' && false);
    if (!validEnd(edge.fromMin, edge.fromMax) || !validEnd(edge.toMin, edge.toMax)) add('error', 'invalid-cardinality', `Cardinalidade inválida entre ${from.title} e ${to.title}.`, edge.id);
    if (edge.onDelete && !ACTIONS.has(edge.onDelete) || edge.onUpdate && !ACTIONS.has(edge.onUpdate)) add('error', 'invalid-referential-action', 'Ação de integridade referencial inválida.', edge.id);
    const child=edge.fromMax==='N'?from:to,childMin=child===from?edge.fromMin:edge.toMin;
    if ((edge.onDelete === 'SET NULL' || edge.onUpdate === 'SET NULL') && childMin === '1') add('error', 'referential-action-nullability', `A relação entre ${from.title} e ${to.title} exige participação, incompatível com SET NULL.`, edge.id);
    if (edge.fromMax === 'N' && edge.toMax === 'N') add('warning', 'many-to-many', `A relação N:N entre ${from.title} e ${to.title} precisa de tabela associativa para o modelo relacional.`, edge.id);
  }
  return issues;
}

function quoteIdentifier(value, dialect) {
  const quote = ['mysql', 'mariadb'].includes(dialect) ? '`' : '"';
  return `${quote}${String(value).replaceAll(quote, quote + quote)}${quote}`;
}
function quoteSqlString(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function sqlType(field, dialect) {
  const type = logicalType(field);
  const mapped = TYPE_MAP[type]?.[dialect];
  if (!mapped) throw new Error(`Tipo lógico sem mapeamento para ${dialect}: ${type}`);
  if (type === 'ENUM' && ['mysql', 'mariadb'].includes(dialect)) return `ENUM(${field.enumValues.map(quoteSqlString).join(', ')})`;
  if (mapped.includes('(') || ['TEXT', 'JSON', 'JSONB', 'BYTEA', 'BLOB', 'REAL', 'INTEGER'].includes(mapped)) return mapped;
  if (['CHAR', 'VARCHAR', 'VARBINARY'].includes(type) && field.size) return `${mapped}(${Number(field.size)})`;
  if (['DECIMAL', 'NUMERIC'].includes(type) && field.precision) return `${mapped}(${Number(field.precision)}${field.scale != null ? `, ${Number(field.scale)}` : ''})`;
  return mapped;
}
function isPk(table, field) { return field.key === 'PK' || table.primaryKey?.includes(columnId(field)) || table.primaryKey?.includes(field.name); }
function tableSqlName(table, dialect) { return table.schema && dialect !== 'sqlite' ? `${quoteIdentifier(table.schema, dialect)}.${quoteIdentifier(table.title, dialect)}` : quoteIdentifier(table.title, dialect); }
function safeExpression(expression) {
  const value = String(expression || '').trim();
  if (!value || /;|--|\/\*|\*\//.test(value)) throw new Error('Expressão SQL vazia ou com comentário/separador não permitido.');
  return value;
}
function associationFor(edge, tables) {
  if (edge.associativeTable?.name) return edge.associativeTable;
  const a = tables.find(table => table.id === edge.from), b = tables.find(table => table.id === edge.to);
  return { name: `${a.title}_${b.title}`, leftTable: a, rightTable: b };
}
function relationshipForForeignKey(diagram, sourceTable, targetTable, field) {
  return (diagram?.edges || []).find(edge => {
    const explicitMatch = edge.id === field.references?.relationshipId;
    const sameEndpoints = (edge.from === sourceTable.id && edge.to === targetTable.id) || (edge.to === sourceTable.id && edge.from === targetTable.id);
    return explicitMatch || (sameEndpoints && !(edge.fromMax === 'N' && edge.toMax === 'N'));
  });
}
function hasForeignKeyTo(child, parent, parentField, edge, generatedName) {
  const sameTable = value => {
    const unqualified=String(value||'').split('.').at(-1).replaceAll('"','').replaceAll('`','').toLowerCase();
    return unqualified===parent.title.toLowerCase();
  };
  const representedByColumn=(child.fields||[]).some(field=>{
    if(field.name===generatedName||field.references?.relationshipId===edge.id)return true;
    if(field.references?.tableId!==parent.id)return false;
    return field.references.columnId===columnId(parentField)||field.references.columnId===parentField.name||field.references.columnName===parentField.name;
  });
  const representedByConstraint=(child.constraints||[]).some(constraint=>constraint.type==='FOREIGN_KEY'&&sameTable(constraint.table)&&(!constraint.schema||norm(constraint.schema)===norm(parent.schema))&&(constraint.targetColumns||[]).some(name=>name===parentField.name||name===columnId(parentField)));
  return representedByColumn||representedByConstraint;
}

export function generateLogicalSql(diagram, dialect = 'postgresql') {
  if (!TYPE_MAP.INTEGER[dialect]) throw new Error(`Dialeto não suportado: ${dialect}`);
  if(['mysql','mariadb'].includes(dialect)){
    const usesSetDefault=(diagram?.edges||[]).some(edge=>edge.onDelete==='SET DEFAULT'||edge.onUpdate==='SET DEFAULT')||tableNodes(diagram).some(table=>(table.fields||[]).some(field=>field.references?.onDelete==='SET DEFAULT'||field.references?.onUpdate==='SET DEFAULT')||(table.constraints||[]).some(constraint=>constraint.type==='FOREIGN_KEY'&&(constraint.onDelete==='SET DEFAULT'||constraint.onUpdate==='SET DEFAULT')));
    if(usesSetDefault)throw new Error(`${dialect} com InnoDB não suporta ON DELETE/UPDATE SET DEFAULT; escolha outra ação referencial.`);
  }
  const issues = validateLogicalDiagram(diagram).filter(issue => issue.severity === 'error' || issue.code === 'unresolved-foreign-key');
  if (issues.length) throw new Error(`Corrija as inconsistências do modelo antes de gerar SQL: ${issues.map(item => item.message).join(' ')}`);
  const tables = tableNodes(diagram);
  if (dialect === 'sqlite' && tables.some(table => (table.fields || []).some(field => field.identity && (logicalType(field) !== 'INTEGER' || !isPk(table, field))))) throw new Error('No SQLite, identidade precisa ser INTEGER e fazer parte da chave primária.');
  if (dialect === 'sqlite' && tables.some(table => (table.fields || []).filter(field => field.identity).length > 1)) throw new Error('SQLite permite apenas uma coluna de identidade por tabela.');
  const statements = [];
  const deferredForeignKeys = [];
  for (const table of tables) {
    const lines = [];
    const fields = table.fields || [];
    for (const field of fields) {
      const name = quoteIdentifier(field.name, dialect);
      let definition = `  ${name} ${sqlType(field, dialect)}`;
      if (isPk(table, field) || field.nullable === false) definition += ' NOT NULL';
      if (field.identity) definition += dialect === 'postgresql' ? ' GENERATED BY DEFAULT AS IDENTITY' : ['mysql', 'mariadb'].includes(dialect) ? ' AUTO_INCREMENT' : ' PRIMARY KEY AUTOINCREMENT';
      if (field.defaultValue != null && String(field.defaultValue) !== '') definition += ` DEFAULT ${safeExpression(field.defaultValue)}`;
      const namedUnique=(table.constraints||[]).some(constraint=>constraint.type==='UNIQUE'&&constraint.columns?.length===1&&constraint.columns[0]===field.name);
      if (field.unique&&!namedUnique) definition += ' UNIQUE';
      if (field.check) definition += ` CHECK (${safeExpression(field.check)})`;
      if (logicalType(field) === 'ENUM' && !['mysql', 'mariadb'].includes(dialect)) definition += ` CHECK (${name} IN (${field.enumValues.map(quoteSqlString).join(', ')}))`;
      lines.push(definition);
    }
    const primary = table.primaryKey?.length ? table.primaryKey : fields.filter(field => field.key === 'PK').map(columnId);
    if (primary.length && !(dialect === 'sqlite' && fields.some(field => isPk(table, field) && field.identity))) lines.push(`  ${table.primaryKeyName?`CONSTRAINT ${quoteIdentifier(table.primaryKeyName,dialect)} `:''}PRIMARY KEY (${primary.map(name => quoteIdentifier(fields.find(field => columnId(field) === name || field.name === name)?.name || name, dialect)).join(', ')})`);
    for (const constraint of table.constraints || []) {
      const constraintName = constraint.name ? `CONSTRAINT ${quoteIdentifier(constraint.name, dialect)} ` : '';
      if (constraint.type === 'UNIQUE') lines.push(`  ${constraintName}UNIQUE (${(constraint.columns || []).map(name => quoteIdentifier(fields.find(field => columnId(field) === name)?.name || name, dialect)).join(', ')})`);
      if (constraint.type === 'CHECK') lines.push(`  ${constraintName}CHECK (${safeExpression(constraint.expression)})`);
      if (constraint.type === 'FOREIGN_KEY' && dialect === 'sqlite') {
        const target=tables.find(item=>item.title.toLowerCase()===String(constraint.table).toLowerCase()&&(!constraint.schema||norm(item.schema)===norm(constraint.schema)));
        if(target)lines.push(`  ${constraintName}FOREIGN KEY (${constraint.columns.map(name=>quoteIdentifier(fields.find(field=>field.name===name)?.name||name,dialect)).join(', ')}) REFERENCES ${tableSqlName(target,dialect)} (${constraint.targetColumns.map(name=>quoteIdentifier(target.fields.find(field=>field.name===name)?.name||name,dialect)).join(', ')})${constraint.onDelete?` ON DELETE ${constraint.onDelete}`:''}${constraint.onUpdate?` ON UPDATE ${constraint.onUpdate}`:''}`);
      } else if(constraint.type==='FOREIGN_KEY') {
        const target=tables.find(item=>item.title.toLowerCase()===String(constraint.table).toLowerCase()&&(!constraint.schema||norm(item.schema)===norm(constraint.schema)));
        if(target)deferredForeignKeys.push(`ALTER TABLE ${tableSqlName(table,dialect)} ADD ${constraintName}FOREIGN KEY (${constraint.columns.map(name=>quoteIdentifier(fields.find(field=>field.name===name)?.name||name,dialect)).join(', ')}) REFERENCES ${tableSqlName(target,dialect)} (${constraint.targetColumns.map(name=>quoteIdentifier(target.fields.find(field=>field.name===name)?.name||name,dialect)).join(', ')})${constraint.onDelete?` ON DELETE ${constraint.onDelete}`:''}${constraint.onUpdate?` ON UPDATE ${constraint.onUpdate}`:''};`);
      }
    }
    for (const field of fields.filter(item => item.references?.tableId && (item.references.columnId || item.references.columnName))) {
      if(field.references.constraintId)continue;
      const target = tables.find(item => item.id === field.references.tableId);
      const targetField = target.fields.find(item => columnId(item) === field.references.columnId || item.name === field.references.columnName);
      const fk = field.references;
      const relationship=relationshipForForeignKey(diagram,table,target,field);
      const onDelete=fk.onDelete||relationship?.onDelete,onUpdate=fk.onUpdate||relationship?.onUpdate;
      const constraint=`FOREIGN KEY (${quoteIdentifier(field.name, dialect)}) REFERENCES ${tableSqlName(target, dialect)} (${quoteIdentifier(targetField.name, dialect)})${onDelete ? ` ON DELETE ${onDelete}` : ''}${onUpdate ? ` ON UPDATE ${onUpdate}` : ''}`;
      if(relationship?.fromMax==='1'&&relationship?.toMax==='1'&&!field.unique)lines.push(`  UNIQUE (${quoteIdentifier(field.name,dialect)})`);
      if(dialect==='sqlite')lines.push(`  ${constraint}`);
      else deferredForeignKeys.push(`ALTER TABLE ${tableSqlName(table,dialect)} ADD ${constraint};`);
    }
    statements.push(`CREATE TABLE ${tableSqlName(table, dialect)} (\n${lines.join(',\n')}\n);`);
    for (const index of table.indexes || []) {
      if (!index.columns?.length) continue;
      const name = quoteIdentifier(index.name || `idx_${table.title}_${index.columns.join('_')}`, dialect);
      statements.push(`CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${name} ON ${tableSqlName(table, dialect)} (${index.columns.map(name => quoteIdentifier(fields.find(field => columnId(field) === name)?.name || name, dialect)).join(', ')});`);
    }
  }
  statements.push(...deferredForeignKeys);
  for (const edge of diagram?.edges || []) {
    const from = tables.find(table => table.id === edge.from), to = tables.find(table => table.id === edge.to);
    if (!from || !to) continue;
    if (edge.fromMax === 'N' && edge.toMax === 'N') {
      const assoc = associationFor(edge, tables), leftPk = (assoc.leftTable.primaryKey?.length ? assoc.leftTable.primaryKey : assoc.leftTable.fields.filter(field => field.key === 'PK').map(columnId))[0], rightPk = (assoc.rightTable.primaryKey?.length ? assoc.rightTable.primaryKey : assoc.rightTable.fields.filter(field => field.key === 'PK').map(columnId))[0];
      const lf = assoc.leftTable.fields.find(field => columnId(field) === leftPk || field.name === leftPk), rf = assoc.rightTable.fields.find(field => columnId(field) === rightPk || field.name === rightPk);
      if (!lf || !rf) throw new Error(`Defina uma PK em ${assoc.leftTable.title} e ${assoc.rightTable.title} antes de gerar tabela associativa.`);
      const leftCol = edge.associativeTable?.leftColumn || `${assoc.leftTable.title}_${lf.name}`;
      const rightCol = edge.associativeTable?.rightColumn || `${assoc.rightTable.title}_${rf.name}`;
      const deleteAction=edge.onDelete&&ACTIONS.has(edge.onDelete)?` ON DELETE ${edge.onDelete}`:'';
      const updateAction=edge.onUpdate&&ACTIONS.has(edge.onUpdate)?` ON UPDATE ${edge.onUpdate}`:'';
      statements.push(`CREATE TABLE ${quoteIdentifier(assoc.name, dialect)} (\n  ${quoteIdentifier(leftCol, dialect)} ${sqlType(lf, dialect)} NOT NULL,\n  ${quoteIdentifier(rightCol, dialect)} ${sqlType(rf, dialect)} NOT NULL,\n  PRIMARY KEY (${quoteIdentifier(leftCol, dialect)}, ${quoteIdentifier(rightCol, dialect)}),\n  FOREIGN KEY (${quoteIdentifier(leftCol, dialect)}) REFERENCES ${tableSqlName(assoc.leftTable, dialect)} (${quoteIdentifier(lf.name, dialect)})${deleteAction}${updateAction},\n  FOREIGN KEY (${quoteIdentifier(rightCol, dialect)}) REFERENCES ${tableSqlName(assoc.rightTable, dialect)} (${quoteIdentifier(rf.name, dialect)})${deleteAction}${updateAction}\n);`);
    } else {
      const child = edge.fromMax === 'N' ? from : to, parent = child === from ? to : from;
      const parentPk = parent.primaryKey?.length ? parent.primaryKey : parent.fields.filter(field => field.key === 'PK').map(columnId);
      if (!parentPk.length) continue;
      const parentField = parent.fields.find(field => columnId(field) === parentPk[0] || field.name === parentPk[0]);
      if (!parentField) continue;
      const fkName = edge.foreignKey?.columnName || `${parent.title}_${parentField.name}`;
      if (hasForeignKeyTo(child,parent,parentField,edge,fkName)) continue;
      // The relation is part of the saved logical model; a missing FK column is
      // emitted inline so the SQL remains relationally complete and repeatable.
      const replacement = statements.findIndex(text => text.startsWith(`CREATE TABLE ${tableSqlName(child, dialect)} `));
      if (replacement >= 0) {
        const text = statements[replacement];
        const childMin = child === from ? edge.fromMin : edge.toMin;
        const nullable = edge.foreignKey?.nullable ?? childMin === '0';
        const actionDelete = edge.onDelete && ACTIONS.has(edge.onDelete) ? ` ON DELETE ${edge.onDelete}` : '';
        const actionUpdate = edge.onUpdate && ACTIONS.has(edge.onUpdate) ? ` ON UPDATE ${edge.onUpdate}` : '';
        const oneToOne = edge.fromMax === '1' && edge.toMax === '1';
        const fkClause=`FOREIGN KEY (${quoteIdentifier(fkName, dialect)}) REFERENCES ${tableSqlName(parent, dialect)} (${quoteIdentifier(parentField.name, dialect)})${actionDelete}${actionUpdate}`;
        const columnDefinition=`  ${quoteIdentifier(fkName, dialect)} ${sqlType(parentField, dialect)}${nullable ? '' : ' NOT NULL'}${oneToOne ? ' UNIQUE' : ''}`;
        const insert=dialect==='sqlite'?`${columnDefinition},\n  ${fkClause}`:columnDefinition;
        statements[replacement] = text.replace(/\n\);$/, `,\n${insert}\n);`);
        if(dialect!=='sqlite')statements.push(`ALTER TABLE ${tableSqlName(child,dialect)} ADD ${fkClause};`);
        if (edge.identifying) {
          const keys = [...primaryKeyFieldsForSql(child).map(field => field.name), fkName];
          const pkPattern = /PRIMARY KEY \(([^)]*)\)/;
          const updated = statements[replacement].replace(pkPattern, `PRIMARY KEY (${keys.map(name => quoteIdentifier(name, dialect)).join(', ')})`);
          statements[replacement] = updated === statements[replacement] ? updated.replace(/\n\);$/, `,\n  PRIMARY KEY (${keys.map(name => quoteIdentifier(name, dialect)).join(', ')})\n);`) : updated;
        }
      }
    }
  }
  if (dialect === 'postgresql') statements.unshift(...[...new Set(tables.map(table => table.schema).filter(Boolean))].map(schema => `CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(schema, dialect)};`));
  return `-- Generated by brModelo Studio · ${dialect}\n-- Review this script before running it.\n\n${statements.join('\n\n')}\n`;
}
function primaryKeyFieldsForSql(table) {
  const ids = table.primaryKey?.length ? table.primaryKey : (table.fields || []).filter(field => field.key === 'PK').map(columnId);
  return ids.map(id => table.fields.find(field => columnId(field) === id || field.name === id)).filter(Boolean);
}

export function dataDictionaryRows(diagram) {
  const tables = tableNodes(diagram);
  return tables.flatMap(table => (table.fields || []).map(field => ({
    schema: table.schema || '', table: table.title, tableDescription: table.description || '', column: field.name,
    type: `${logicalType(field)}${field.size ? `(${field.size})` : field.precision ? `(${field.precision}${field.scale != null ? `,${field.scale}` : ''})` : ''}`,
    nullable: isPk(table, field) ? 'Não' : field.nullable === false ? 'Não' : 'Sim', key: isPk(table, field) ? 'PK' : field.references ? 'FK' : field.unique ? 'UQ' : field.key || '',
    defaultValue: field.defaultValue ?? '', description: field.description || '', check: field.check || '',
    references:(()=>{const target=tables.find(item=>item.id===field.references?.tableId);const column=target?.fields.find(item=>columnId(item)===field.references?.columnId||item.name===field.references?.columnName);return target&&column?`${target.title}.${column.name}`:''})(),
    relationships:(diagram.edges||[]).filter(edge=>edge.from===table.id||edge.to===table.id).map(edge=>{const other=tables.find(item=>item.id===(edge.from===table.id?edge.to:edge.from));return other?`${edge.from===table.id?edge.fromMax:edge.toMax}:${edge.from===table.id?edge.toMax:edge.fromMax} ${other.title}${edge.identifying?' · identificadora':' · não identificadora'}`:''}).filter(Boolean).join('; ')
  })));
}
export function dataDictionaryCsv(diagram) {
  const rows = dataDictionaryRows(diagram), headings = ['schema', 'table', 'tableDescription', 'column', 'type', 'nullable', 'key', 'defaultValue', 'description', 'check','references','relationships'];
  const cell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return `\uFEFF${headings.join(',')}\r\n${rows.map(row => headings.map(key => cell(row[key])).join(',')).join('\r\n')}`;
}

export function analyzeNormalization(diagram) {
  const issues = [];
  for (const table of tableNodes(diagram)) {
    const fields = table.fields || [], fds = table.functionalDependencies || [];
    if (fields.some(field => field.multivalued || field.repeatingGroup)) issues.push({severity: 'suggestion', code: 'first-normal-form', elementId: table.id, message: `${table.title}: revise valores multivalorados ou grupos repetitivos para atender à 1FN.`});
    if (!fds.length) {
      issues.push({severity: 'warning', code: 'normalization-insufficient-evidence', elementId: table.id, message: `${table.title}: informe dependências funcionais para avaliar 2FN, 3FN e BCNF; a estrutura sozinha não comprova essas formas.`});
      continue;
    }
    const primary=table.primaryKey?.length?table.primaryKey:fields.filter(field=>field.key==='PK').map(columnId);
    const uniqueCandidates=[...(table.constraints||[]).filter(item=>item.type==='UNIQUE').map(item=>item.columns||[]),...fields.filter(field=>field.unique).map(field=>[columnId(field)])];
    const keys = table.candidateKeys || [primary,...uniqueCandidates].filter(key=>key.length);
    const nonKey = new Set(fields.filter(field => !keys.some(key => key.includes(columnId(field)) || key.includes(field.name))).map(field => columnId(field)));
    for (const fd of fds) {
      const lhs = fd.determinant || [], rhs = fd.dependent || [];
      if (!lhs.length || !rhs.length || [...lhs, ...rhs].some(name => !fields.some(field => columnId(field) === name || field.name === name))) {
        issues.push({severity: 'error', code: 'invalid-functional-dependency', elementId: table.id, message: `${table.title}: dependência funcional incompleta ou com colunas inexistentes.`}); continue;
      }
      const partial = keys.some(key => key.length > lhs.length && lhs.every(name => key.includes(name)) && rhs.some(name => nonKey.has(name)));
      if (partial) issues.push({severity: 'warning', code: 'second-normal-form', elementId: table.id, message: `${table.title}: dependência parcial de uma chave candidata pode violar a 2FN.`});
      const determinantIsSuperkey = keys.some(key => key.every(name => lhs.includes(name)));
      if (!determinantIsSuperkey && rhs.some(name => nonKey.has(name))) issues.push({severity: 'warning', code: 'third-normal-form', elementId: table.id, message: `${table.title}: dependência transitiva possível; confirme a condição da 3FN e BCNF.`});
    }
  }
  return issues;
}

// Conservative DDL importer for a documented CREATE TABLE subset. It never
// executes SQL; unsupported statements are rejected instead of guessed.
export function parseSqlDdl(source) {
  if (typeof source !== 'string' || source.length > 2_000_000) throw new Error('Arquivo SQL inválido ou maior que 2 MB.');
  const text = stripSqlComments(source);
  const tables=[];
  for(const statement of splitSqlStatements(text)){
    const create=parseCreateTableHeader(statement);if(!create)continue;
    const {nameParts,openIndex}=create,closeIndex=findMatchingParen(statement,openIndex);
    if(closeIndex<0)throw new Error('Definição CREATE TABLE sem fechamento de parênteses.');
    const rawName=nameParts.at(-1),fields=[],constraints=[];let primaryKey=[],primaryKeyName='';
    for(const rawItem of splitSqlItems(statement.slice(openIndex+1,closeIndex))){
      const item=rawItem.trim();if(!item)continue;
      const tableConstraint=parseTableConstraint(item);
      if(tableConstraint){
        if(tableConstraint.type==='PRIMARY_KEY'){if(primaryKey.length)throw new Error(`Mais de uma PRIMARY KEY declarada em ${rawName}.`);primaryKey=tableConstraint.columns;primaryKeyName=tableConstraint.name||'';}
        else constraints.push(tableConstraint);
        continue;
      }
      if(/^CONSTRAINT\b/i.test(item))throw new Error(`Constraint não suportada em ${rawName}: ${item.slice(0,90)}`);
      const parsed=parseColumnDefinition(item,fields.length);
      fields.push(parsed.field);
      if(parsed.primary){if(primaryKey.length)throw new Error(`Mais de uma PRIMARY KEY declarada em ${rawName}.`);primaryKey=[parsed.field.name];primaryKeyName=parsed.primaryName||'';}
      constraints.push(...parsed.constraints);
    }
    for(const field of fields){if(field.type!=='TEXT'||!field.check)continue;const check=field.check.match(new RegExp(`^\\s*(${SQL_IDENTIFIER_TOKEN})\\s+IN\\s*\\((.*)\\)\\s*$`,'i'));if(!check||unquote(check[1])!==field.name)continue;try{const values=splitSqlItems(check[2]).map(parseSqlStringLiteral);if(values.length){field.type='ENUM';field.enumValues=values;delete field.check;}}catch{}}
    for(const field of fields)if(primaryKey.includes(field.name)){field.key='PK';field.nullable=false;}
    tables.push({id:`t_${tables.length+1}`,kind:'table',title:rawName,...(nameParts.length>1?{schema:nameParts.at(-2)}:{}),x:80+(tables.length%3)*260,y:80+Math.floor(tables.length/3)*210,fields,primaryKey,primaryKeyName,constraints});
  }
  for(const statement of splitSqlStatements(text)){
    const alter=parseAlterConstraint(statement);if(!alter)continue;
    const source=tables.find(table=>table.title.toLowerCase()===alter.source.at(-1).toLowerCase()&&(!alter.source.at(-2)||table.schema?.toLowerCase()===alter.source.at(-2).toLowerCase()));
    if(!source)continue;
    if(alter.constraint.type==='PRIMARY_KEY'){
      source.primaryKey=alter.constraint.columns;source.primaryKeyName=alter.constraint.name||'';
      for(const field of source.fields)if(source.primaryKey.includes(field.name)){field.key='PK';field.nullable=false;}
    }else source.constraints.push(alter.constraint);
  }
  if (!tables.length) throw new Error('Nenhuma instrução CREATE TABLE compatível foi encontrada.');
  return tables;
}
export function importLogicalDiagramFromDdl(source,title='Importado · DDL'){
  const nodes=parseSqlDdl(source),edges=[];
  const tableFor=constraint=>nodes.find(table=>norm(table.title)===norm(constraint.table)&&(!constraint.schema||norm(table.schema)===norm(constraint.schema)));
  for(const child of nodes){for(const fk of child.constraints.filter(item=>item.type==='FOREIGN_KEY')){
    const parent=tableFor(fk),constraintId=fk.name||`fk_${child.id}_${edges.length+1}`;
    if(parent){fk.columns.forEach((name,index)=>{const field=child.fields.find(item=>item.name===name),targetName=fk.targetColumns[index],target=parent.fields.find(item=>item.name===targetName);if(!field)return;field.key='FK';field.references={tableId:parent.id,columnId:target?.id||targetName,columnName:targetName,constraintId,onDelete:fk.onDelete,onUpdate:fk.onUpdate};});
      edges.push({id:`e_${edges.length+1}`,from:parent.id,to:child.id,fromMin:'1',fromMax:'1',toMin:fk.columns.some(name=>child.fields.find(field=>field.name===name)?.nullable===false)?'1':'0',toMax:'N',onDelete:fk.onDelete||'NO ACTION',onUpdate:fk.onUpdate||'NO ACTION',foreignKey:{constraintId,name:fk.name||'',columnName:fk.columns[0],columns:[...fk.columns],targetColumns:[...fk.targetColumns],materialized:true}});
    }
  }}
  return {type:'logico',title,nodes,edges};
}
const SQL_IDENTIFIER_TOKEN='(?:`(?:``|[^`])+`|"(?:""|[^"])*"|\\[[^\\]]+\\]|[A-Za-z_][A-Za-z0-9_$]*)';
function unquote(value) { const text=String(value).trim();if(text.startsWith('[')&&text.endsWith(']'))return text.slice(1,-1);if(text.startsWith('`')&&text.endsWith('`'))return text.slice(1,-1).replaceAll('``','`');if(text.startsWith('"')&&text.endsWith('"'))return text.slice(1,-1).replaceAll('""','"');return text; }
function parseSqlStringLiteral(value) {
  const text=String(value).trim();
  if(text.length<2||!(["'",'"'].includes(text[0]))||text.at(-1)!==text[0])throw new Error(`Valor ENUM inválido: ${text}`);
  const quote=text[0];return text.slice(1,-1).replaceAll(quote+quote,quote);
}
function findMatchingParen(source, openIndex) {
  let depth=0,quote='';
  for(let i=openIndex;i<source.length;i++){
    const char=source[i];
    if(quote){if(char===quote&&source[i+1]===quote){i++;continue;}if(char===quote)quote='';continue;}
    if(char==='['){quote=']';continue;}
    if(char==="'"||char==='"'||char==='`'){quote=char;continue;}
    if(char==='(')depth++;else if(char===')'&&--depth===0)return i;
  }
  return -1;
}
function parseAction(text, operation) { const match=String(text).match(new RegExp(`\\bON\\s+${operation}\\s+(NO\\s+ACTION|RESTRICT|CASCADE|SET\\s+NULL|SET\\s+DEFAULT)\\b`,'i'));return match?.[1]?.toUpperCase().replace(/\s+/g,' ')||''; }
function stripSqlComments(source){let out='',quote='',line=false,block=false;for(let i=0;i<source.length;i++){const c=source[i],next=source[i+1];if(line){if(c==='\n'){line=false;out+=c}else out+=' ';continue}if(block){if(c==='*'&&next==='/'){block=false;out+='  ';i++}else out+=c==='\n'?'\n':' ';continue}if(quote){out+=c;if(c===quote&&next===quote){out+=next;i++}else if(c===quote)quote='';continue}if(c==='['){quote=']';out+=c;continue}if(c==="'"||c==='"'||c==='`'){quote=c;out+=c;continue}if(c==='-'&&next==='-'){line=true;out+='  ';i++;continue}if(c==='/'&&next==='*'){block=true;out+='  ';i++;continue}out+=c}return out}
function splitSqlItems(value) {
  const result = []; let start = 0, depth = 0, quote = '';
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (quote) { if (char === quote && value[i + 1] === quote) i++; else if (char === quote) quote = ''; continue; }
    if(char==='['){quote=']';continue;}
    if (char === '"' || char === '`' || char === "'") quote = char;
    else if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) { result.push(value.slice(start, i).trim()); start = i + 1; }
  }
  if (value.slice(start).trim()) result.push(value.slice(start).trim());
  return result;
}

function splitSqlStatements(value){const result=[];let start=0,depth=0,quote='';for(let i=0;i<value.length;i++){const c=value[i];if(quote){if(c===quote&&value[i+1]===quote){i++;continue;}if(c===quote)quote='';continue;}if(c==='['){quote=']';continue;}if(c==="'"||c==='"'||c==='`'){quote=c;continue;}if(c==='(')depth++;else if(c===')')depth--;else if(c===';'&&depth===0){if(value.slice(start,i).trim())result.push(value.slice(start,i).trim());start=i+1;}}if(value.slice(start).trim())result.push(value.slice(start).trim());return result;}
function readIdentifier(source,index=0){const rest=source.slice(index),match=rest.match(new RegExp(`^(${SQL_IDENTIFIER_TOKEN})`,'i'));if(!match)return null;return {value:unquote(match[1]),end:index+match[1].length};}
function readQualifiedIdentifier(source,index=0){const first=readIdentifier(source,index);if(!first)return null;const parts=[first.value];let end=first.end;while(source[end]==='.'){const next=readIdentifier(source,end+1);if(!next)return null;parts.push(next.value);end=next.end;}return {parts,end};}
function readParenthesized(source,index){while(/\s/.test(source[index]||''))index++;if(source[index]!=='(')return null;const end=findMatchingParen(source,index);return end<0?null:{value:source.slice(index+1,end),end:end+1};}
function parseNameList(value){return splitSqlItems(value).map(item=>{const token=readIdentifier(item.trim());if(!token||item.trim().slice(token.end).trim())throw new Error(`Identificador de coluna inválido: ${item}`);return token.value;});}
function parseCreateTableHeader(statement){const start=statement.match(/^\s*CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/i);if(!start)return null;const name=readQualifiedIdentifier(statement,start[0].length);if(!name)return null;let index=name.end;while(/\s/.test(statement[index]||''))index++;if(statement[index]!=='(')return null;return {nameParts:name.parts,openIndex:index};}
function parseConstraintActions(text){return {onDelete:parseAction(text,'DELETE'),onUpdate:parseAction(text,'UPDATE')};}
function parseTableConstraint(raw){let text=raw.trim(),name='';const named=text.match(new RegExp(`^CONSTRAINT\\s+(${SQL_IDENTIFIER_TOKEN})\\s+`,'i'));if(named){name=unquote(named[1]);text=text.slice(named[0].length).trim();}
  let match=text.match(/^PRIMARY\s+KEY\s*(?:USING\s+\w+\s*)?/i);if(match){const group=readParenthesized(text,match[0].length);if(!group)throw new Error(`PRIMARY KEY inválida: ${raw}`);return {type:'PRIMARY_KEY',name,columns:parseNameList(group.value)};}
  match=text.match(new RegExp(`^(?:UNIQUE\\s+(?:(?:KEY|INDEX)\\s+(${SQL_IDENTIFIER_TOKEN})\\s*)?|UNIQUE\\s*)`,'i'));if(match){const group=readParenthesized(text,match[0].length);if(!group)throw new Error(`UNIQUE inválida: ${raw}`);return {type:'UNIQUE',name:name||unquote(match[1]||''),columns:parseNameList(group.value)};}
  match=text.match(/^FOREIGN\s+KEY\s*/i);if(match){const local=readParenthesized(text,match[0].length);if(!local)throw new Error(`FOREIGN KEY inválida: ${raw}`);let cursor=local.end;const ref=text.slice(cursor).match(/^\s*REFERENCES\s+/i);if(!ref)throw new Error(`FOREIGN KEY sem REFERENCES: ${raw}`);cursor+=ref[0].length;const target=readQualifiedIdentifier(text,cursor);if(!target)throw new Error(`Tabela referenciada inválida: ${raw}`);cursor=target.end;const remote=readParenthesized(text,cursor);if(!remote)throw new Error(`Colunas referenciadas inválidas: ${raw}`);const actions=parseConstraintActions(text.slice(remote.end));return {type:'FOREIGN_KEY',name,columns:parseNameList(local.value),table:target.parts.at(-1),...(target.parts.length>1?{schema:target.parts.at(-2)}:{}),targetColumns:parseNameList(remote.value),...actions};}
  match=text.match(/^CHECK\s*/i);if(match){const group=readParenthesized(text,match[0].length);if(!group)throw new Error(`CHECK inválido: ${raw}`);return {type:'CHECK',name,expression:group.value.trim()};}
  return null;
}
function parseColumnDefinition(raw,index){const start=readIdentifier(raw.trim());if(!start)throw new Error(`Definição de coluna inválida: ${raw}`);const text=raw.trim(),name=start.value;let cursor=start.end;while(/\s/.test(text[cursor]||''))cursor++;
  const typeMatch=text.slice(cursor).match(/^([A-Za-z][A-Za-z0-9_]*)/);if(!typeMatch)throw new Error(`Tipo ausente na coluna ${name}.`);let type=typeMatch[1].toUpperCase();cursor+=typeMatch[0].length;const compound=text.slice(cursor).match(/^\s+(PRECISION|VARYING)\b/i);if(compound&&(['DOUBLE','CHARACTER'].includes(type))){type=`${type} ${compound[1].toUpperCase()}`;cursor+=compound[0].length;}while(/\s/.test(text[cursor]||''))cursor++;
  let size=null,precision=null,scale=null,enumValues;
  if(text[cursor]==='('){const group=readParenthesized(text,cursor);if(!group)throw new Error(`Tipo com parênteses inválidos em ${name}.`);cursor=group.end;const args=splitSqlItems(group.value);if(type==='ENUM'||type==='SET')enumValues=args.map(parseSqlStringLiteral);else if(['DECIMAL','NUMERIC'].includes(type)){precision=Number(args[0]);scale=args.length>1?Number(args[1]):null;}else if(args.length===1&&/^\d+$/.test(args[0].trim()))size=Number(args[0]);type=type==='CHARACTER VARYING'?'VARCHAR':type;}
  else type=type.split(' ')[0];
  if(type==='DOUBLE PRECISION')type='DOUBLE';else if(type==='CHARACTER VARYING')type='VARCHAR';
  if(!TYPE_MAP[type])throw new Error(`Tipo não suportado na coluna ${name}: ${type}`);
  const field={id:`c_${index+1}`,name,type,...(size?{size}:{}),...(precision?{precision,scale}:{}),nullable:true,...(enumValues?{enumValues}:{})};let tail=text.slice(cursor),primary=false,primaryName='',constraints=[];
  const consume=(pattern,fn)=>{const match=tail.match(pattern);if(!match)return false;fn(match);tail=tail.slice(match[0].length);return true;};
  while(tail.trim()){
    const before=tail;tail=tail.trimStart();
    let m=tail.match(new RegExp(`^CONSTRAINT\\s+(${SQL_IDENTIFIER_TOKEN})\\s+`,'i'));let inlineName='';if(m){inlineName=unquote(m[1]);tail=tail.slice(m[0].length);}
    if(consume(/^NOT\s+NULL\b/i,()=>{field.nullable=false;}))continue;
    if(consume(/^NULL\b/i,()=>{field.nullable=true;}))continue;
    if(consume(/^AUTO_INCREMENT\b|^AUTOINCREMENT\b/i,()=>{field.identity=true;}))continue;
    if(consume(/^GENERATED\s+(?:ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY(?:\s*\([^)]*\))?/i,()=>{field.identity=true;}))continue;
    if(consume(/^PRIMARY\s+KEY\b/i,()=>{primary=true;primaryName=inlineName;field.nullable=false;field.key='PK';}))continue;
    if(consume(/^UNIQUE\b/i,()=>{field.unique=true;constraints.push({type:'UNIQUE',name:inlineName,columns:[name]});}))continue;
    m=tail.match(/^DEFAULT\s+/i);if(m){tail=tail.slice(m[0].length);const value=readSqlExpression(tail);field.defaultValue=value.value;tail=tail.slice(value.length);continue;}
    if(/^CHECK\s*\(/i.test(tail)){const m=tail.match(/^CHECK\s*/i),group=readParenthesized(tail,m[0].length);if(!group)throw new Error(`CHECK inválido em ${name}.`);if(inlineName)constraints.push({type:'CHECK',name:inlineName,expression:group.value.trim()});else field.check=group.value.trim();tail=tail.slice(group.end);continue;}
    if(/^REFERENCES\s+/i.test(tail)){const ref=tail.match(/^REFERENCES\s+/i),target=readQualifiedIdentifier(tail,ref[0].length);if(!target)throw new Error(`REFERENCES inválido em ${name}.`);const group=readParenthesized(tail,target.end);if(!group)throw new Error(`REFERENCES sem coluna em ${name}.`);const actions=parseConstraintActions(tail.slice(group.end)),constraint={type:'FOREIGN_KEY',name:inlineName,columns:[name],table:target.parts.at(-1),...(target.parts.length>1?{schema:target.parts.at(-2)}:{}),targetColumns:parseNameList(group.value),...actions};constraints.push(constraint);field.key='FK';tail=tail.slice(group.end);while((m=tail.match(/^\s*ON\s+(DELETE|UPDATE)\s+(NO\s+ACTION|RESTRICT|CASCADE|SET\s+NULL|SET\s+DEFAULT)\b/i))){constraint[m[1].toLowerCase()==='delete'?'onDelete':'onUpdate']=m[2].toUpperCase().replace(/\s+/g,' ');tail=tail.slice(m[0].length);}continue;}
    const identity=tail.match(/^COMMENT\s+('(?:''|[^'])*')/i);if(identity){field.description=parseSqlStringLiteral(identity[1]);tail=tail.slice(identity[0].length);continue;}
    if(tail===before)throw new Error(`Cláusula não suportada na coluna ${name}: ${tail.slice(0,80)}`);
  }
  return {field,primary,primaryName,constraints};
}
function readSqlExpression(source){let depth=0,quote='',index=0;for(;index<source.length;index++){const c=source[index];if(quote){if(c===quote&&source[index+1]===quote){index++;continue;}if(c===quote)quote='';continue;}if(c==="'"||c==='"'||c==='`'){quote=c;continue;}if(c==='(')depth++;else if(c===')')depth--;if(depth===0&&index>0&&/\s/.test(c)&&/^\s+(?:NOT\s+NULL|NULL|PRIMARY\s+KEY|UNIQUE|CHECK|REFERENCES|AUTO_INCREMENT|AUTOINCREMENT|GENERATED|CONSTRAINT)\b/i.test(source.slice(index)))break;}return {value:source.slice(0,index).trim(),length:index};}
function parseAlterConstraint(statement){const head=statement.match(/^\s*ALTER\s+TABLE\s+/i);if(!head)return null;const source=readQualifiedIdentifier(statement,head[0].length);if(!source)return null;let rest=statement.slice(source.end).trim().replace(/^ADD\s+(?:COLUMN\s+)?/i,'');const constraint=parseTableConstraint(rest);return constraint?{source:source.parts,constraint}:null;}
