const CONCEPTUAL_FIELD_KINDS = new Set(['simple', 'composite', 'multivalued', 'derived']);

const text = value => typeof value === 'string' ? value.trim() : '';
const asId = (prefix, value) => typeof value === 'string' && value ? value : `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export function normalizeConceptualDiagram(diagram) {
  if (diagram?.type !== 'conceitual') return diagram;
  diagram.conceptual ||= {version: 1, notation: 'chen', specializations: [], constraints: []};
  diagram.conceptual.version = 1;
  diagram.conceptual.notation = diagram.conceptual.notation === 'crows-foot' ? 'crows-foot' : 'chen';
  diagram.conceptual.specializations ||= [];
  diagram.conceptual.constraints ||= [];
  for (const node of diagram.nodes || []) {
    if (['entity', 'associative'].includes(node.kind)) {
      node.conceptual ||= {};
      node.conceptual.entityKind = node.conceptual.entityKind === 'weak' ? 'weak' : 'strong';
      node.conceptual.partialKey = text(node.conceptual.partialKey);
      node.fields = (node.fields || []).map((field, index) => normalizeAttribute(field, index));
    } else if (node.kind === 'relationship') {
      node.conceptual ||= {};
      node.conceptual.identifying = Boolean(node.conceptual.identifying);
      node.fields = (node.fields || []).map((field, index) => normalizeAttribute(field, index));
    } else if (node.kind === 'attribute') {
      node.conceptual ||= {};
      node.conceptual.attributeKind = CONCEPTUAL_FIELD_KINDS.has(node.conceptual.attributeKind) ? node.conceptual.attributeKind : 'simple';
      node.conceptual.identifier = Boolean(node.conceptual.identifier);
      node.conceptual.required = Boolean(node.conceptual.required);
      node.conceptual.domain = text(node.conceptual.domain);
      node.conceptual.derivation = text(node.conceptual.derivation);
    } else if (node.kind === 'specialization') {
      node.conceptual ||= {};
      node.conceptual.completeness = node.conceptual.completeness === 'total' ? 'total' : 'partial';
      node.conceptual.disjointness = node.conceptual.disjointness === 'overlapping' ? 'overlapping' : 'disjoint';
    }
  }
  for (const edge of diagram.edges || []) {
    if (edge.role !== undefined) edge.role = text(edge.role);
    edge.totalParticipation = Boolean(edge.totalParticipation);
  }
  return diagram;
}

export function materializeConceptualAttributeNodes(input) {
  const diagram=normalizeConceptualDiagram(input);
  if(diagram?.type!=='conceitual')return diagram;
  diagram.nodes||=[];diagram.edges||=[];
  for(const owner of diagram.nodes.filter(node=>['entity','associative'].includes(node.kind))){
    const fields=owner.fields||[];
    fields.forEach((field,index)=>{
      let attribute=diagram.nodes.find(node=>node.kind==='attribute'&&node.id===field.id);
      if(!attribute){
        let id=field.id;
        if(diagram.nodes.some(node=>node.id===id))id=`attribute-${id}`;
        attribute={id,kind:'attribute',title:field.name,x:(Number(owner.x)||0)-15+(index%3)*145,y:(Number(owner.y)||0)-100-Math.floor(index/3)*80,fields:[],conceptual:{attributeKind:field.kind,identifier:field.identifier,required:field.required,domain:field.domain,derivation:field.derivation,parentId:field.parentId}};
        diagram.nodes.push(attribute);
      }
      if(!diagram.edges.some(edge=>(edge.from===owner.id&&edge.to===attribute.id)||(edge.to===owner.id&&edge.from===attribute.id)))diagram.edges.push({id:`attribute-edge:${attribute.id}`,from:owner.id,to:attribute.id,fromMin:'1',fromMax:'1',toMin:'1',toMax:'1'});
    });
    owner.fields=[];
  }
  diagram.conceptual.attributeRepresentation='nodes';
  return diagram;
}

function normalizeAttribute(value, index) {
  if (typeof value === 'string') return {id: asId('a', ''), name: value, kind: 'simple', domain: '', required: false, identifier: false, derivation: '', parentId: null, order: index};
  const attribute = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    ...attribute,
    id: asId('a', attribute.id),
    name: text(attribute.name),
    kind: CONCEPTUAL_FIELD_KINDS.has(attribute.kind) ? attribute.kind : 'simple',
    domain: text(attribute.domain),
    required: Boolean(attribute.required),
    identifier: Boolean(attribute.identifier),
    derivation: text(attribute.derivation),
    parentId: typeof attribute.parentId === 'string' && attribute.parentId ? attribute.parentId : null,
    order: Number.isInteger(attribute.order) ? attribute.order : index
  };
}

function conceptualAttributes(diagram, owner) {
  const embedded=(owner.fields||[]).map((field,index)=>normalizeAttribute(field,index));
  const embeddedIds=new Set(embedded.map(field=>field.id));
  const attached=diagram.nodes.filter(node=>node.kind==='attribute'&&diagram.edges.some(edge=>(edge.from===owner.id&&edge.to===node.id)||(edge.to===owner.id&&edge.from===node.id))).map((node,index)=>normalizeAttribute({id:node.id,name:node.title,kind:node.conceptual?.attributeKind,...node.conceptual},embedded.length+index));
  return [...embedded,...attached.filter(field=>!embeddedIds.has(field.id))];
}

export function validateConceptualDiagram(input) {
  const diagram = normalizeConceptualDiagram(structuredClone(input));
  const issues = [];
  const add = (severity, code, message, elementId = '') => issues.push({severity, code, message, elementId});
  const entities = diagram.nodes.filter(node => ['entity', 'associative'].includes(node.kind));
  const relationships = diagram.nodes.filter(node => node.kind === 'relationship');
  const specializations = diagram.nodes.filter(node => node.kind === 'specialization');
  const names = new Map();
  for (const node of diagram.nodes) {
    const name = text(node.title).toLocaleLowerCase('pt-BR');
    if (!name) add('error', 'empty-name', 'O elemento precisa de um nome.', node.id);
    if (name && ['entity', 'associative', 'relationship', 'specialization'].includes(node.kind)) {
      const key = `${node.kind}:${name}`;
      if (names.has(key)) add('error', 'duplicate-name', `Nome duplicado: ${node.title}.`, node.id);
      names.set(key, node.id);
    }
  }
  for (const entity of entities) {
    const attrs = conceptualAttributes(diagram,entity);
    const seen = new Set();
    const parentById=new Map(attrs.map(attr=>[attr.id,attr.parentId]));
    for(const attr of attrs){const path=new Set([attr.id]);let parent=attr.parentId;while(parent){if(path.has(parent)){add('error','attribute-composition-cycle',`A composição de atributos em ${entity.title} contém um ciclo.`,entity.id);break;}path.add(parent);parent=parentById.get(parent)||null;}}
    for (const attr of attrs) {
      const name = text(attr.name).toLocaleLowerCase('pt-BR');
      if (!name) add('error', 'empty-attribute', 'A entidade possui um atributo sem nome.', entity.id);
      else if (seen.has(name)) add('error', 'duplicate-attribute', `Atributo duplicado em ${entity.title}: ${attr.name}.`, entity.id);
      seen.add(name);
      if (attr.kind === 'derived' && !text(attr.derivation)) add('warning', 'missing-derivation', `Documente como ${attr.name} é derivado.`, entity.id);
      if (attr.kind === 'composite' && !attrs.some(child => child.parentId === attr.id)) add('warning', 'empty-composite', `O atributo composto ${attr.name} ainda não tem componentes.`, entity.id);
      if (attr.parentId && !attrs.some(parent => parent.id === attr.parentId && parent.kind === 'composite')) add('error', 'invalid-attribute-parent', `O atributo ${attr.name} aponta para um composto inexistente.`, entity.id);
    }
    if (!attrs.some(attr => attr.identifier)) add('warning', 'missing-identifier', `Defina um identificador para ${entity.title}.`, entity.id);
    if (entity.conceptual.entityKind === 'weak') {
      const identifying = relationships.some(rel => rel.conceptual.identifying && diagram.edges.some(edge => edge.from === rel.id && edge.to === entity.id || edge.to === rel.id && edge.from === entity.id));
      if (!identifying) add('error', 'weak-without-identifying-relationship', `A entidade fraca ${entity.title} precisa participar de um relacionamento identificador.`, entity.id);
      if (!text(entity.conceptual.partialKey) && !attrs.some(attr => attr.identifier)) add('error', 'weak-without-partial-key', `Defina uma chave parcial para ${entity.title} antes de converter o modelo.`, entity.id);
    }
  }
  for (const relationship of relationships) {
    const relationAttributes=conceptualAttributes(diagram,relationship),attributeNames=new Set();
    for(const attr of relationAttributes){const name=text(attr.name).toLocaleLowerCase('pt-BR');if(!name)add('error','empty-attribute','O relacionamento possui um atributo sem nome.',relationship.id);else if(attributeNames.has(name))add('error','duplicate-attribute',`Atributo duplicado em ${relationship.title}: ${attr.name}.`,relationship.id);attributeNames.add(name);}
    const edges = diagram.edges.filter(edge => edge.from === relationship.id || edge.to === relationship.id);
    const participants = edges.filter(edge => entities.some(entity => entity.id === (edge.from === relationship.id ? edge.to : edge.from)));
    if (participants.length < 2) add('error', 'relationship-degree', `${relationship.title} precisa conectar ao menos duas entidades.`, relationship.id);
    const roleNames = participants.map(edge => text(edge.role).toLocaleLowerCase('pt-BR')).filter(Boolean);
    if (new Set(roleNames).size !== roleNames.length) add('error', 'duplicate-role', `Os papéis em ${relationship.title} precisam ser distintos.`, relationship.id);
    for (const edge of participants) {
      const min = edge.from === relationship.id ? edge.toMin : edge.fromMin;
      const max = edge.from === relationship.id ? edge.toMax : edge.fromMax;
      if (!['0','1'].includes(String(min)) || !['1','N'].includes(String(max))) add('error', 'invalid-cardinality', `Cardinalidade inválida em ${relationship.title}.`, relationship.id);
      if (edge.totalParticipation && String(min) !== '1') add('error', 'participation-cardinality-mismatch', 'Participação total exige cardinalidade mínima 1.', relationship.id);
    }
    if (relationship.conceptual.identifying && participants.filter(edge => entities.some(entity => entity.id === (edge.from === relationship.id ? edge.to : edge.from) && entity.conceptual.entityKind === 'weak')).length !== 1) add('warning', 'identifying-participants', 'Um relacionamento identificador deve conectar uma entidade fraca a uma entidade proprietária.', relationship.id);
  }
  for(const attribute of diagram.nodes.filter(node=>node.kind==='attribute')){
    const owners=diagram.edges.filter(edge=>edge.from===attribute.id||edge.to===attribute.id).map(edge=>diagram.nodes.find(node=>node.id===(edge.from===attribute.id?edge.to:edge.from))).filter(node=>node&&(['entity','associative','relationship'].includes(node.kind)));
    if(!owners.length)add('warning','unattached-attribute',`Conecte o atributo ${attribute.title} a uma entidade ou relacionamento.`,attribute.id);
    if(owners.length>1)add('error','attribute-multiple-owners',`O atributo ${attribute.title} está ligado a mais de um elemento proprietário.`,attribute.id);
  }
  for(const edge of diagram.edges)if(!diagram.nodes.some(node=>node.id===edge.from)||!diagram.nodes.some(node=>node.id===edge.to))add('error','dangling-connection','Uma conexão aponta para um elemento inexistente.',edge.id);
  for (const specialization of specializations) {
    const participantEdges = diagram.edges.filter(edge => edge.from === specialization.id || edge.to === specialization.id).filter(edge => entities.some(entity => entity.id === (edge.from === specialization.id ? edge.to : edge.from)));
    const participants = participantEdges.map(edge => edge.from === specialization.id ? edge.to : edge.from);
    if (participants.length < 3) add('error', 'specialization-degree', 'Uma especialização ISA precisa de um supertipo e ao menos dois subtipos.', specialization.id);
    const superTypes=participantEdges.filter(edge=>edge.role==='supertype'),subTypes=participantEdges.filter(edge=>edge.role==='subtype');
    if(participants.length>=3&&(superTypes.length!==1||subTypes.length<2))add('error','specialization-roles','Marque uma conexão como supertipo e ao menos duas como subtipo.',specialization.id);
  }
  const inheritance=new Map();
  for(const specialization of specializations){const edges=diagram.edges.filter(edge=>(edge.from===specialization.id||edge.to===specialization.id)&&['supertype','subtype'].includes(edge.role));const superEdge=edges.find(edge=>edge.role==='supertype');if(!superEdge)continue;const superId=superEdge.from===specialization.id?superEdge.to:superEdge.from;for(const edge of edges.filter(item=>item.role==='subtype')){const subId=edge.from===specialization.id?edge.to:edge.from;inheritance.set(subId,[...(inheritance.get(subId)||[]),superId]);}}
  const visiting=new Set(),visited=new Set();const hasCycle=id=>{if(visiting.has(id))return true;if(visited.has(id))return false;visiting.add(id);for(const parent of inheritance.get(id)||[])if(hasCycle(parent))return true;visiting.delete(id);visited.add(id);return false;};for(const id of inheritance.keys())if(hasCycle(id)){add('error','inheritance-cycle','A hierarquia de especialização contém um ciclo.',id);break;}
  for (const constraint of diagram.conceptual.constraints) {
    if (!constraint || typeof constraint.description !== 'string' || !constraint.description.trim()) add('error', 'empty-constraint', 'Uma regra de negócio está sem descrição.', constraint?.id || '');
    else if (constraint.elementId && !diagram.nodes.some(node => node.id === constraint.elementId)) add('error', 'constraint-reference', 'Uma regra de negócio aponta para um elemento inexistente.', constraint.id);
  }
  return issues;
}

export function convertConceptualToLogical(input, {inheritance = 'joined'} = {}) {
  const diagram = normalizeConceptualDiagram(structuredClone(input));
  if (diagram.type !== 'conceitual') throw new TypeError('A conversão requer um diagrama conceitual.');
  if (!['joined', 'single', 'concrete'].includes(inheritance)) throw new TypeError('Estratégia de herança inválida.');
  const entities = diagram.nodes.filter(node => ['entity', 'associative'].includes(node.kind));
  const relationships = diagram.nodes.filter(node => node.kind === 'relationship');
  const tables = new Map();
  const slug = value => text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'campo';
  const makeField = (id, name, type = 'VARCHAR', extra = {}) => ({id, name, type, size: type === 'VARCHAR' ? 255 : null, key: '', nullable: true, ...extra});
  const leaves = (attrs, parent = null, path = new Set()) => attrs.filter(attr => attr.parentId === parent).flatMap(attr => {if(attr.kind==='composite'){if(path.has(attr.id))return[];const next=new Set(path);next.add(attr.id);return leaves(attrs,attr.id,next);}return attr.kind==='multivalued'||attr.kind==='derived'?[]:[attr];});
  const fieldIdMap = new Map();
  const uniqueName = (used, value) => { const base=slug(value);let name=base,n=2;while(used.has(name))name=`${base}_${n++}`;used.add(name);return name; };
  for (const entity of entities) {
    const title=slug(entity.title), used=new Set(), fields=[];
    const entityAttrs=conceptualAttributes(diagram,entity);
    for (const attr of leaves(entityAttrs)) {
      const name=uniqueName(used,attr.name), field=makeField(attr.id,name,'VARCHAR',{nullable:!attr.required, conceptualSourceId:attr.id});
      if(attr.identifier){field.key='PK';field.nullable=false;}
      fields.push(field);fieldIdMap.set(`${entity.id}:${attr.id}`,name);
    }
    if(entity.conceptual.entityKind==='weak'&&text(entity.conceptual.partialKey)&&!fields.some(field=>field.key==='PK'))fields.push(makeField(`${entity.id}:partial-key`,uniqueName(used,entity.conceptual.partialKey),'VARCHAR',{key:'PK',nullable:false,partialKey:true,conceptualSourceId:entity.id}));
    const identifier=fields.filter(field=>field.key==='PK');
    if(!identifier.length){const id=makeField(`${entity.id}:generated-id`,'id','INT',{key:'PK',nullable:false,identity:true,generated:true});fields.unshift(id);}
    tables.set(entity.id,{id:`logical:${entity.id}`,kind:'table',title,x:entity.x,y:entity.y,fields,primaryKey:fields.filter(field=>field.key==='PK').map(field=>field.id),schema:'',conceptualSourceId:entity.id});
  }
  const addForeignKey = (ownerId,targetId,relationshipId,nullable) => {
    const owner=tables.get(ownerId),target=tables.get(targetId);if(!owner||!target)return;
    const targetKeys=target.fields.filter(field=>field.key==='PK');const used=new Set(owner.fields.map(field=>field.name));const fkNames=[];
    const identifying=relationships.some(relationship=>relationship.id===relationshipId&&relationship.conceptual.identifying)&&entities.some(entity=>entity.id===ownerId&&entity.conceptual.entityKind==='weak');
    if(identifying){owner.fields=owner.fields.filter(field=>!field.generated);owner.primaryKey=owner.fields.filter(field=>field.key==='PK').map(field=>field.id);}
    for(const targetKey of targetKeys){const name=uniqueName(used,`${slug(entities.find(x=>x.id===targetId)?.title||'ref')}_${targetKey.name}`),id=`fk:${relationshipId}:${ownerId}:${targetKey.id}`;owner.fields.push(makeField(id,name,targetKey.type,{size:targetKey.size,key:identifying?'PK':'FK',nullable:identifying?false:nullable,references:{tableId:target.id,columnId:targetKey.id,columnName:targetKey.name,relationshipId:`edge:${id}`},conceptualSourceId:relationshipId}));fkNames.push(id);}
    if(identifying)owner.primaryKey=owner.fields.filter(field=>field.key==='PK').map(field=>field.id);
    return fkNames;
  };
  for (const relationship of relationships) {
    const edges=diagram.edges.filter(edge=>edge.from===relationship.id||edge.to===relationship.id).map(edge=>({edge,entityId:edge.from===relationship.id?edge.to:edge.from})).filter(x=>tables.has(x.entityId));
    if(edges.length<2)continue;
    if(edges.length===2){
      const [a,b]=edges, maxA=String(a.edge.from===relationship.id?a.edge.toMax:a.edge.fromMax),maxB=String(b.edge.from===relationship.id?b.edge.toMax:b.edge.fromMax);
      if(maxA==='N'&&maxB==='N'){
        const title=uniqueName(new Set([...tables.values()].map(t=>t.title)),relationship.title),used=new Set(),fields=[];
        for(const participant of edges){const parent=tables.get(participant.entityId);for(const key of parent.fields.filter(f=>f.key==='PK')){const id=`fk:${relationship.id}:${participant.entityId}:${key.id}`;fields.push(makeField(id,uniqueName(used,`${slug(entities.find(e=>e.id===participant.entityId)?.title||'ref')}_${key.name}`),key.type,{size:key.size,key:'PK',nullable:false,references:{tableId:parent.id,columnId:key.id,columnName:key.name,relationshipId:`edge:${id}`},conceptualSourceId:relationship.id}));}}
        const id=`logical:relationship:${relationship.id}`;fields.forEach(field=>{field.references && (field.key='FK');});tables.set(id,{id,kind:'table',title,x:relationship.x,y:relationship.y,fields,primaryKey:fields.map(f=>f.id),conceptualSourceId:relationship.id});
      }else{
        const weakParticipant=relationship.conceptual.identifying?edges.find(item=>entities.some(entity=>entity.id===item.entityId&&entity.conceptual.entityKind==='weak')):null;
        const owner=weakParticipant|| (maxA==='N'?a:maxB==='N'?b:(String(a.edge.from===relationship.id?a.edge.toMin:a.edge.fromMin)==='0'?a:b));
        const target=owner===a?b:a,ownerTable=tables.get(owner.entityId),keys=addForeignKey(owner.entityId,target.entityId,relationship.id,String(owner.edge.from===relationship.id?owner.edge.toMin:owner.edge.fromMin)==='0');
        if(maxA==='1'&&maxB==='1')for(const field of ownerTable.fields.filter(field=>keys?.includes(field.id)))field.unique=true;
        for(const attr of leaves(conceptualAttributes(diagram,relationship))){const used=new Set(ownerTable.fields.map(field=>field.name));ownerTable.fields.push(makeField(attr.id,uniqueName(used,attr.name),'VARCHAR',{nullable:!attr.required,conceptualSourceId:attr.id}));}
      }
    } else {
      const used=new Set(),fields=[];
      for(const participant of edges){const parent=tables.get(participant.entityId);for(const key of parent.fields.filter(f=>f.key==='PK')){const id=`fk:${relationship.id}:${participant.entityId}:${key.id}`;fields.push(makeField(id,uniqueName(used,`${slug(entities.find(e=>e.id===participant.entityId)?.title||'ref')}_${key.name}`),key.type,{size:key.size,key:'FK',nullable:false,references:{tableId:parent.id,columnId:key.id,columnName:key.name,relationshipId:`edge:${id}`},conceptualSourceId:relationship.id}));}}
      const id=`logical:relationship:${relationship.id}`;fields.forEach(field=>field.key='FK');fields.forEach(field=>field.key='PK');tables.set(id,{id,kind:'table',title:slug(relationship.title),x:relationship.x,y:relationship.y,fields,primaryKey:fields.map(f=>f.id),conceptualSourceId:relationship.id});
    }
    const relationTable=[...tables.values()].find(table=>table.conceptualSourceId===relationship.id&&table.id.startsWith('logical:relationship:'));
    if(relationTable)for(const attr of leaves(conceptualAttributes(diagram,relationship))){const used=new Set(relationTable.fields.map(field=>field.name)),name=uniqueName(used,attr.name);relationTable.fields.push(makeField(attr.id,name,'VARCHAR',{nullable:!attr.required,conceptualSourceId:attr.id}));}
  }
  for(const entity of entities)for(const attr of conceptualAttributes(diagram,entity).filter(field=>field.kind==='multivalued')){
    const parent=tables.get(entity.id),used=new Set(),source=parent.fields.filter(field=>field.key==='PK'),fields=source.map(key=>{const id=`mv:${attr.id}:${key.id}`;return makeField(id,uniqueName(used,`${slug(entity.title)}_${key.name}`),key.type,{key:'PK',nullable:false,references:{tableId:parent.id,columnId:key.id,columnName:key.name,relationshipId:`edge:${id}`}});});
    fields.push(makeField(attr.id,uniqueName(used,attr.name),'VARCHAR',{key:'PK',nullable:false}));const id=`logical:multivalue:${attr.id}`;tables.set(id,{id,kind:'table',title:`${slug(entity.title)}_${slug(attr.name)}`,x:entity.x+35,y:entity.y+180,fields,primaryKey:fields.map(field=>field.id),conceptualSourceId:attr.id});
  }
  const specializationNodes=diagram.nodes.filter(node=>node.kind==='specialization');
  if(specializationNodes.length&&inheritance==='joined'){
    for(const spec of specializationNodes){const connected=diagram.edges.filter(edge=>edge.from===spec.id||edge.to===spec.id).map(edge=>({edge,entityId:edge.from===spec.id?edge.to:edge.from}));const supertype=connected.find(item=>item.edge.role==='supertype'),subtypes=connected.filter(item=>item.edge.role==='subtype');if(!supertype)continue;for(const subtypeRef of subtypes){const child=tables.get(subtypeRef.entityId),parent=tables.get(supertype.entityId);if(!child||!parent)continue;child.fields=child.fields.filter(field=>!field.generated);for(const field of child.fields)if(field.key==='PK')field.key='';const parentKeys=parent.fields.filter(field=>field.key==='PK');const added=[];for(const key of parentKeys){const id=`isa:${spec.id}:${child.id}:${key.id}`,name=uniqueName(new Set(child.fields.map(field=>field.name)),key.name);child.fields.push(makeField(id,name,key.type,{size:key.size,key:'PK',nullable:false,references:{tableId:parent.id,columnId:key.id,columnName:key.name,relationshipId:`edge:${id}`},conceptualSourceId:spec.id}));added.push(id);}child.primaryKey=added;}}
  }
  const logicalEdges=[];
  for(const table of tables.values())for(const field of table.fields)if(field.references){logicalEdges.push({id:field.references.relationshipId||`edge:${field.id}`,from:table.id,to:field.references.tableId,fromMin:field.nullable?'0':'1',fromMax:field.unique?'1':'N',toMin:'1',toMax:'1',foreignKey:{columnName:field.name,nullable:field.nullable},conceptualSourceId:field.conceptualSourceId});}
  const converted={id:`converted:${diagram.id}`,type:'logico',title:`${diagram.title} · Relacional`,nodes:[...tables.values()],edges:logicalEdges,conversion:{sourceDiagramId:diagram.id,inheritance,strategyNotes:{joined:'Supertipos e subtipos usam tabelas separadas com chave do supertipo herdada.',single:'Estratégia de tabela única ainda exige mapeamento manual.',concrete:'Estratégia de tabelas concretas ainda exige mapeamento manual.'}}};
  return converted;
}

export function conceptualDictionaryCsv(input) {
  const diagram=normalizeConceptualDiagram(structuredClone(input));
  const quote=value=>`"${String(value??'').replaceAll('"','""')}"`;
  const rows=[['Tipo','Elemento','Descrição','Atributo','Classificação','Domínio','Identificador','Participantes','Cardinalidade']];
  for(const entity of diagram.nodes.filter(node=>['entity','associative'].includes(node.kind)))for(const attr of conceptualAttributes(diagram,entity))rows.push(['Entidade',entity.title,entity.description||'',attr.name,attr.kind,attr.domain,attr.identifier?'Sim':'Não','','']);
  for(const relationship of diagram.nodes.filter(node=>node.kind==='relationship')){const participants=diagram.edges.filter(edge=>edge.from===relationship.id||edge.to===relationship.id).map(edge=>{const id=edge.from===relationship.id?edge.to:edge.from,node=diagram.nodes.find(item=>item.id===id);return node?`${node.title}${edge.role?` (${edge.role})`:''} [${edge.from===relationship.id?edge.toMin:edge.fromMin}..${edge.from===relationship.id?edge.toMax:edge.fromMax}]`:'';}).filter(Boolean);rows.push(['Relacionamento',relationship.title,relationship.description||'',conceptualAttributes(diagram,relationship).map(attr=>attr.name).join(', '),'', '', '', participants.join(' ; '),'']);}
  return `\uFEFF${rows.map(row=>row.map(quote).join(',')).join('\r\n')}`;
}
