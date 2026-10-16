export const FORMAT='brmodelo.uml-class';
export const VERSION=1;
export const uid=()=>crypto.randomUUID();
export const clone=value=>structuredClone(value);
export const RELATIONSHIPS=['association','aggregation','composition','generalization','realization','dependency'];
export const CLASSIFIERS=['class','interface','enumeration','dataType','primitiveType','package'];
export function stereotypeLabels(classifier){const builtIn={interface:'interface',enumeration:'enumeration',dataType:'dataType',primitiveType:'primitive'}[classifier.kind];return [...(builtIn?[`«${builtIn}»`]:[]),...(classifier.stereotypes||[]).map(item=>typeof item==='string'?item:item?.name).filter(name=>typeof name==='string'&&name.trim()).map(name=>`«${name.trim()}»`)];}
export function createProject(title='Classes UML'){
  const diagram=createDiagram('Diagrama de classes');
  const profile={id:uid(),name:'Perfil de domínio (exemplos)',description:'Estereótipos personalizados para iniciar a modelagem; não são estereótipos nativos UML.',stereotypes:['entity','control','boundary','service','repository','DTO','valueObject','aggregateRoot'].map(name=>({id:uid(),name,metaclasses:['Class'],tags:[]}))};
  return {format:FORMAT,version:VERSION,id:uid(),title,classifiers:[],relationships:[],profiles:[profile],diagrams:[diagram],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
}
export function createDiagram(name='Diagrama de classes'){return{id:uid(),name,elementIds:[],relationshipIds:[],view:{nodes:{},edges:{},zoom:1,pan:{x:50,y:40},grid:20},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};}
export function addDiagram(project,name='Diagrama de classes'){const diagram=createDiagram(name);project.diagrams.push(diagram);return diagram;}
export function addClassifier(project,diagram,kind='class',x=140,y=120){
  if(!CLASSIFIERS.includes(kind))throw new Error('Classificador UML desconhecido.');
  const classifier={id:uid(),kind,name:({class:'NovaClasse',interface:'NovaInterface',enumeration:'NovaEnumeracao',dataType:'NovoTipo',primitiveType:'NovoPrimitivo',package:'novo.pacote'})[kind],visibility:'public',isAbstract:false,isLeaf:false,attributes:[],operations:[],literals:[],templateParameters:[],stereotypes:[],constraints:[],documentation:'',representation:'classifier',compartments:{attributes:true,operations:true},parentId:null};
  project.classifiers.push(classifier);diagram.elementIds.push(classifier.id);diagram.view.nodes[classifier.id]={x,y,w:220,h:112};return classifier;
}
export function addRelationship(project,diagram,kind,sourceId,targetId){
  if(!RELATIONSHIPS.includes(kind))throw new Error('Relação UML desconhecida.');
  if(sourceId===targetId&&kind!=='association')throw new Error('Somente associações reflexivas podem ligar uma classe a ela mesma.');
  const source=project.classifiers.find(c=>c.id===sourceId),target=project.classifiers.find(c=>c.id===targetId);
  if(!source||!target||source.kind==='package'||target.kind==='package')throw new Error('Escolha dois classificadores existentes.');
  if(kind==='realization'&&target.kind!=='interface')throw new Error('Uma realização deve apontar para uma interface.');
  if(kind==='generalization'&&[source.kind,target.kind].includes('enumeration'))throw new Error('Enumerações não participam de generalização neste editor.');
  const relation={id:uid(),kind,name:'',sourceId,targetId,sourceEnd:{role:'',multiplicity:'1',navigability:'unspecified',aggregation:kind==='aggregation'?'shared':kind==='composition'?'composite':'none',ordered:false,unique:true,qualifiers:[]},targetEnd:{role:'',multiplicity:'0..*',navigability:'unspecified',aggregation:'none',ordered:false,unique:true,qualifiers:[]},stereotypes:[],constraints:[],documentation:'',points:[]};
  if(kind==='generalization'){relation.sourceEnd.multiplicity='';relation.targetEnd.multiplicity='';}
  project.relationships.push(relation);diagram.relationshipIds.push(relation.id);diagram.view.edges[relation.id]={points:[]};return relation;
}
export function addAttribute(classifier){const item={id:uid(),name:'novoAtributo',type:'String',visibility:'private',multiplicity:'1',defaultValue:'',isStatic:false,isReadOnly:false,isDerived:false,isOrdered:false,isUnique:true,constraints:[],documentation:''};classifier.attributes.push(item);return item;}
export function addOperation(classifier){const item={id:uid(),name:'novaOperacao',visibility:'public',parameters:[],returnType:'void',returnMultiplicity:'1',isAbstract:false,isStatic:false,isQuery:false,constraints:[],exceptions:[],documentation:''};classifier.operations.push(item);return item;}
export function addParameter(operation){const item={id:uid(),name:'parametro',type:'String',direction:'in',multiplicity:'1',defaultValue:''};operation.parameters.push(item);return item;}
export function applyStereotype(classifier,stereotype,profileId){classifier.stereotypes||=[];if(classifier.stereotypes.some(item=>(typeof item==='string'?item:item.id)===stereotype.id))return false;classifier.stereotypes.push({id:stereotype.id,name:stereotype.name,profileId,values:{}});return true;}
export function removeStereotype(classifier,stereotypeId){const before=classifier.stereotypes?.length||0;classifier.stereotypes=(classifier.stereotypes||[]).filter(item=>(typeof item==='string'?item:item.id)!==stereotypeId);return classifier.stereotypes.length!==before;}
export function parseProject(value){
  if(!value||value.format!==FORMAT||value.version!==VERSION||!Array.isArray(value.classifiers)||!Array.isArray(value.relationships)||!Array.isArray(value.diagrams)||!value.diagrams.length)throw new Error('Projeto UML de classes inválido.');
  if(value.classifiers.length>5000||value.relationships.length>10000||value.diagrams.length>100)throw new Error('Projeto UML excede os limites de segurança.');
  const project=clone(value),ids=new Set();
  // Earlier v1 exports omitted profiles and some optional UML collections. Restore
  // those defaults at the model boundary so saved diagrams remain openable.
  project.profiles=Array.isArray(project.profiles)?project.profiles:[];
  project.createdAt||=new Date(0).toISOString();project.updatedAt||=project.createdAt;
  for(const c of project.classifiers){if(typeof c.id!=='string'||ids.has(c.id)||!CLASSIFIERS.includes(c.kind)||typeof c.name!=='string')throw new Error('Classificador UML inválido.');ids.add(c.id);c.attributes=Array.isArray(c.attributes)?c.attributes:[];c.attributes=c.attributes.map(a=>({visibility:'private',multiplicity:'1',defaultValue:'',isStatic:false,isReadOnly:false,isDerived:false,isOrdered:false,isUnique:true,documentation:'',...a,id:a.id||uid()}));c.operations=Array.isArray(c.operations)?c.operations:[];c.operations=c.operations.map(o=>({...{visibility:'public',parameters:[],returnType:'void',returnMultiplicity:'1',isAbstract:false,isStatic:false,isQuery:false,documentation:''},...o,id:o.id||uid(),parameters:(o.parameters||[]).map(p=>({direction:'in',multiplicity:'1',defaultValue:'',...p,id:p.id||uid()}))}));c.literals=Array.isArray(c.literals)?c.literals:[];c.literals=c.literals.map(item=>typeof item==='string'?{id:uid(),name:item}:{...item,id:item.id||uid()});c.templateParameters=Array.isArray(c.templateParameters)?c.templateParameters:[];c.stereotypes=Array.isArray(c.stereotypes)?c.stereotypes:[];c.constraints=Array.isArray(c.constraints)?c.constraints:[];c.compartments||={attributes:true,operations:true};}
  for(const r of project.relationships){if(typeof r.id!=='string'||ids.has(r.id)||!RELATIONSHIPS.includes(r.kind)||!project.classifiers.some(c=>c.id===r.sourceId)||!project.classifiers.some(c=>c.id===r.targetId))throw new Error('Relação UML inválida.');ids.add(r.id);r.sourceEnd={role:'',multiplicity:'1',navigability:'unspecified',aggregation:r.kind==='aggregation'?'shared':r.kind==='composition'?'composite':'none',ordered:false,unique:true,qualifiers:[],...r.sourceEnd};r.targetEnd={role:'',multiplicity:'0..*',navigability:'unspecified',aggregation:'none',ordered:false,unique:true,qualifiers:[],...r.targetEnd};r.points=Array.isArray(r.points)?r.points:[];r.stereotypes=Array.isArray(r.stereotypes)?r.stereotypes:[];r.constraints=Array.isArray(r.constraints)?r.constraints:[];r.documentation||='';}
  for(const d of project.diagrams){if(!Array.isArray(d.elementIds)||!Array.isArray(d.relationshipIds)||!d.view||!d.id)throw new Error('Visão de diagrama inválida.');d.view.nodes||={};d.view.edges||={};d.view.zoom=Number.isFinite(d.view.zoom)?d.view.zoom:1;d.view.pan=d.view.pan&&Number.isFinite(d.view.pan.x)&&Number.isFinite(d.view.pan.y)?d.view.pan:{x:50,y:40};for(const id of d.elementIds){const pos=d.view.nodes[id];if(!project.classifiers.some(c=>c.id===id)||!pos||![pos.x,pos.y].every(Number.isFinite))throw new Error('Classificador sem posição válida no diagrama.');pos.w=Number.isFinite(pos.w)?pos.w:220;pos.h=Number.isFinite(pos.h)?pos.h:112;}for(const id of d.relationshipIds){const r=project.relationships.find(item=>item.id===id);if(!r||!d.elementIds.includes(r.sourceId)||!d.elementIds.includes(r.targetId))throw new Error('Relação ausente ou sem extremidades visíveis no diagrama.');d.view.edges[id]||={points:[]};d.view.edges[id].points=Array.isArray(d.view.edges[id].points)?d.view.edges[id].points:[];d.view.edges[id].style||='automatic';}}
  return project;
}
