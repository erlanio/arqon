import {NODE_REGISTRY, DEFAULT_STEREOTYPE_NAMES, OBJECT_KINDS, CONTROL_KINDS, CONTAINER_KINDS, NON_EXECUTABLE_KINDS, defaultSize} from './registry.mjs';

export const FORMAT = 'brmodelo.uml-activity';
export const FORMAT_VERSION = 1;
export const uid = () => crypto.randomUUID();
export const clone = value => structuredClone(value);

export function createDiagram(name = 'Nova atividade') {
  const id = uid();
  return {id, name, activity:{id:uid(),name,parameters:[]}, model:{nodes:[],edges:[],partitions:[]}, view:{nodes:{},edges:{},partitions:{},grid:20,snap:true,zoom:1,pan:{x:120,y:95}}, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()};
}
export function createProject() {
  const first = createDiagram();
  return {format:FORMAT,version:FORMAT_VERSION,id:uid(),title:'Atividades UML',diagrams:[first],activeDiagramId:first.id,profiles:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
}
export function activeDiagram(project) { return project.diagrams.find(d => d.id === project.activeDiagramId) || project.diagrams[0]; }
export function addDiagram(project, name = 'Nova atividade') {
  const diagram = createDiagram(name);
  project.diagrams.push(diagram); project.activeDiagramId = diagram.id;
  return diagram;
}
export function duplicateDiagram(project, source) {
  const diagram = clone(source), idMap = new Map();
  diagram.id = uid(); diagram.activity.id = uid(); diagram.name = `${source.name} — cópia`; diagram.activity.name = diagram.name;
  for (const node of diagram.model.nodes) {const old=node.id; node.id=uid(); idMap.set(old,node.id);}
  for (const edge of diagram.model.edges) {edge.id=uid();edge.sourceId=idMap.get(edge.sourceId)||edge.sourceId;edge.targetId=idMap.get(edge.targetId)||edge.targetId;}
  for (const partition of diagram.model.partitions) {const old=partition.id;partition.id=uid();idMap.set(old,partition.id);}
  for (const node of diagram.model.nodes) {node.parentId=idMap.get(node.parentId)||null;node.partitionIds=node.partitionIds.map(id=>idMap.get(id)||id);}
  for (const partition of diagram.model.partitions) partition.parentId=idMap.get(partition.parentId)||null;
  diagram.view.nodes=Object.fromEntries(Object.entries(diagram.view.nodes).map(([id,view])=>[idMap.get(id)||id,{...view,x:view.x+30,y:view.y+30}]));
  diagram.view.partitions=Object.fromEntries(Object.entries(diagram.view.partitions).map(([id,view])=>[idMap.get(id)||id,{...view,x:view.x+30,y:view.y+30}]));
  diagram.view.edges={};
  project.diagrams.push(diagram);project.activeDiagramId=diagram.id;
  return diagram;
}
export function addNode(diagram, kind, x, y) {
  const definition=NODE_REGISTRY[kind];if(!definition) throw new Error('Tipo de nó desconhecido');
  const node={id:uid(),kind,name:definition.label,documentation:'',properties:clone(definition.defaults),stereotypes:[],partitionIds:[],parentId:null};
  const size=defaultSize(kind);diagram.model.nodes.push(node);diagram.view.nodes[node.id]={x,y,...size};
  return node;
}
export function addPartition(diagram, x, y, orientation='vertical') {
  const partition={id:uid(),name:'Nova partição',orientation,parentId:null,responsible:'',role:''};
  diagram.model.partitions.push(partition);diagram.view.partitions[partition.id]={x,y,w:orientation==='vertical'?280:470,h:orientation==='vertical'?420:210};
  return partition;
}
export function connectionProblem(diagram, sourceId, targetId, kind='control') {
  const source=diagram.model.nodes.find(n=>n.id===sourceId),target=diagram.model.nodes.find(n=>n.id===targetId);
  if(!source||!target) return 'Escolha dois nós existentes.';
  if(sourceId===targetId) return 'Escolha nós diferentes para esta conexão.';
  if(source.kind==='activityFinal'||source.kind==='flowFinal') return 'Nós finais não possuem fluxo de saída.';
  if(target.kind==='initial') return 'O nó inicial não recebe fluxo de entrada.';
  if(NON_EXECUTABLE_KINDS.has(source.kind)||NON_EXECUTABLE_KINDS.has(target.kind)) return 'Este elemento não participa diretamente de fluxos.';
  if(kind==='object') {
    if(CONTROL_KINDS.has(source.kind)||CONTROL_KINDS.has(target.kind)) return 'Object Flow não pode conectar nós de controle.';
    if(!OBJECT_KINDS.has(source.kind)&&!OBJECT_KINDS.has(target.kind)) return 'Use ao menos um nó de objeto ou pin em Object Flow.';
    if(source.kind==='inputPin'||target.kind==='outputPin') return 'A direção deste pin não permite a conexão.';
  }
  if(kind==='control'&&(OBJECT_KINDS.has(source.kind)||OBJECT_KINDS.has(target.kind))) return 'Use Object Flow para nós de objeto e pins.';
  return null;
}
export function addEdge(diagram, sourceId, targetId, kind='control') {
  const problem=connectionProblem(diagram,sourceId,targetId,kind);if(problem) throw new Error(problem);
  const edge={id:uid(),kind,sourceId,targetId,guard:'',weight:1,objectType:'',interrupting:false,documentation:''};
  diagram.model.edges.push(edge);diagram.view.edges[edge.id]={style:'automatic',points:[]};
  return edge;
}
export function removeElement(diagram, id) {
  if(diagram.model.nodes.some(n=>n.id===id)) {
    diagram.model.nodes=diagram.model.nodes.filter(n=>n.id!==id);
    for(const edge of diagram.model.edges.filter(e=>e.sourceId===id||e.targetId===id)) delete diagram.view.edges[edge.id];
    diagram.model.edges=diagram.model.edges.filter(e=>e.sourceId!==id&&e.targetId!==id);
    for(const node of diagram.model.nodes) if(node.parentId===id) node.parentId=null;
    delete diagram.view.nodes[id];return;
  }
  if(diagram.model.edges.some(e=>e.id===id)) {diagram.model.edges=diagram.model.edges.filter(e=>e.id!==id);delete diagram.view.edges[id];return;}
  if(diagram.model.partitions.some(p=>p.id===id)) {
    diagram.model.partitions=diagram.model.partitions.filter(p=>p.id!==id);
    for(const node of diagram.model.nodes) node.partitionIds=node.partitionIds.filter(pid=>pid!==id);
    for(const part of diagram.model.partitions) if(part.parentId===id) part.parentId=null;
    delete diagram.view.partitions[id];
  }
}
export function createProfile(project,name='Novo perfil') {
  const profile={id:uid(),name,description:'',stereotypes:[],appliedDiagramIds:[]};project.profiles.push(profile);return profile;
}
export function createStereotype(profile,name='NovoEstereotipo') {
  const stereotype={id:uid(),name,description:'',metaclasses:['Action'],tags:[],constraints:[],icon:'',appearance:{color:'#6671a5'}};
  profile.stereotypes.push(stereotype);return stereotype;
}
export function stereotypeOptions(project,diagram) {
  return project.profiles.filter(p=>p.appliedDiagramIds.includes(diagram.id)).flatMap(profile=>profile.stereotypes.map(stereotype=>({profile,stereotype})));
}
export function sampleProfile(project) {
  const profile=createProfile(project,'Exemplos de estereótipos');
  profile.description='Exemplos editáveis; não fazem parte dos estereótipos nativos UML.';
  for(const name of DEFAULT_STEREOTYPE_NAMES) {const item=createStereotype(profile,name);item.metaclasses=['Action','CallBehaviorAction','CallOperationAction','OpaqueAction'];}
  return profile;
}
export function parseProject(value) {
  if(!value||value.format!==FORMAT||value.version!==FORMAT_VERSION||!Array.isArray(value.diagrams)||!Array.isArray(value.profiles)) throw new Error('Formato de projeto UML inválido.');
  if(!value.diagrams.length||value.diagrams.length>100) throw new Error('O projeto deve conter entre 1 e 100 diagramas.');
  const project=clone(value);
  for(const diagram of project.diagrams) {
    if(typeof diagram.id!=='string'||typeof diagram.name!=='string'||!diagram.model||!diagram.view||!Array.isArray(diagram.model.nodes)||!Array.isArray(diagram.model.edges)||!Array.isArray(diagram.model.partitions)) throw new Error('Diagrama inválido.');
    if(diagram.model.nodes.length>2000||diagram.model.edges.length>5000) throw new Error('O diagrama excede o limite de elementos.');
    const ids=new Set();
    for(const node of diagram.model.nodes) {
      if(typeof node.id!=='string'||ids.has(node.id)||!NODE_REGISTRY[node.kind]||typeof node.name!=='string') throw new Error('Nó UML inválido.');
      ids.add(node.id);node.properties ||= {};node.stereotypes ||= [];node.partitionIds ||= [];
      const view=diagram.view.nodes?.[node.id];if(!view||![view.x,view.y,view.w,view.h].every(Number.isFinite)) throw new Error('Posição de nó inválida.');
    }
    for(const edge of diagram.model.edges) {
      if(typeof edge.id!=='string'||ids.has(edge.id)||!ids.has(edge.sourceId)||!ids.has(edge.targetId)||!['control','object'].includes(edge.kind)) throw new Error('Fluxo UML inválido.');
      ids.add(edge.id);
    }
    for(const partition of diagram.model.partitions) {
      if(typeof partition.id!=='string'||ids.has(partition.id)) throw new Error('Partição inválida.');ids.add(partition.id);
      const view=diagram.view.partitions?.[partition.id];if(!view||![view.x,view.y,view.w,view.h].every(Number.isFinite)) throw new Error('Área da partição inválida.');
    }
  }
  project.activeDiagramId=project.diagrams.some(d=>d.id===project.activeDiagramId)?project.activeDiagramId:project.diagrams[0]?.id;
  return project;
}
