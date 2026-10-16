export const USE_CASE_RELATIONSHIPS=Object.freeze(['association','include','extend','generalization']);
const ACTORS=new Set(['actor']),CASES=new Set(['useCase']),ELEMENTS=new Set(['actor','useCase','systemBoundary','note']);

/** Validate the semantic model; visual placement findings remain warnings. */
export function validateUseCaseDiagram(diagram){
  const issues=[],nodes=Array.isArray(diagram?.nodes)?diagram.nodes:[],edges=Array.isArray(diagram?.edges)?diagram.edges:[];
  const byId=new Map(),add=(severity,code,message,elementId)=>issues.push({severity,code,message,elementId});
  for(const node of nodes){
    if(!node?.id||byId.has(node.id))add('error','element.id.duplicate','Identificador de elemento ausente ou duplicado.',node?.id||null);else byId.set(node.id,node);
    if(!ELEMENTS.has(node?.kind))add('error','element.type.invalid','Tipo de elemento não suportado no diagrama de casos de uso.',node?.id||null);
    if(['actor','useCase','systemBoundary'].includes(node?.kind)&&!String(node.title||'').trim())add('error','element.name.empty','Elemento UML sem nome.',node.id);
    if(node?.kind==='useCase'&&!edges.some(edge=>edge.type==='association'&&(edge.from===node.id||edge.to===node.id)))add('warning','useCase.noActor','Caso de uso sem ator associado.',node.id);
    if(node?.kind==='useCase'&&!String(node.description||node.objective||node.mainFlow||'').trim())add('suggestion','useCase.noDocumentation','Documente o objetivo ou o comportamento deste caso de uso.',node.id);
    if(node?.kind==='useCase'){const pointIds=new Set(),pointNames=new Set();for(const point of node.extensionPoints||[]){const name=String(typeof point==='string'?point:point?.name||'').trim(),id=typeof point==='object'?point.id:null;if(!name)add('error','extend.point.name.empty','Ponto de extensão sem nome.',node.id);if(id&&(pointIds.has(id)))add('error','extend.point.id.duplicate','Identificador de ponto de extensão duplicado.',node.id);if(name&&pointNames.has(name))add('warning','extend.point.name.duplicate','Nome de ponto de extensão duplicado.',node.id);if(id)pointIds.add(id);if(name)pointNames.add(name);}}
  }
  const seenEdges=new Set(),generalizations=new Map(),includes=new Map();
  for(const edge of edges){
    if(!edge?.id||seenEdges.has(edge.id))add('error','relationship.id.duplicate','Identificador de relacionamento ausente ou duplicado.',edge?.id||null);else seenEdges.add(edge.id);
    const source=byId.get(edge?.from),target=byId.get(edge?.to);
    if(!source||!target){add('error','relationship.reference.invalid','Relacionamento aponta para elemento inexistente.',edge?.id||null);continue;}
    if(!USE_CASE_RELATIONSHIPS.includes(edge.type)){add('error','relationship.type.invalid','Tipo de relacionamento UML inválido.',edge.id);continue;}
    if(source.id===target.id)add('error','relationship.self','Um elemento não pode se relacionar consigo mesmo.',edge.id);
    const pair=`${edge.from}\0${edge.to}\0${edge.type}`;
    if(seenEdges.has(pair))add('warning','relationship.duplicate','Relacionamento duplicado entre os mesmos elementos.',edge.id);seenEdges.add(pair);
    if(edge.type==='association'&&!((ACTORS.has(source.kind)&&CASES.has(target.kind))||(CASES.has(source.kind)&&ACTORS.has(target.kind))))add('error','association.endpoints','Associação deve ligar um ator a um caso de uso.',edge.id);
    if(['include','extend'].includes(edge.type)&&(!CASES.has(source.kind)||!CASES.has(target.kind)))add('error','useCaseRelationship.endpoints',`«${edge.type}» deve ligar dois casos de uso.`,edge.id);
    if(edge.type==='generalization'&&(!(source.kind===target.kind)||!['actor','useCase'].includes(source.kind)))add('error','generalization.endpoints','Generalização deve ligar dois atores ou dois casos de uso.',edge.id);
    if(source.kind==='systemBoundary'||target.kind==='systemBoundary')add('error','relationship.boundary.endpoint','O limite do sistema é um elemento visual e não pode ser extremo de relacionamento.',edge.id);
    if(edge.type==='generalization'&&source.kind===target.kind){const list=generalizations.get(source.id)||[];list.push(target.id);generalizations.set(source.id,list);}
    if(edge.type==='include'&&CASES.has(source.kind)&&CASES.has(target.kind)){const list=includes.get(source.id)||[];list.push(target.id);includes.set(source.id,list);}
    if(edge.type==='extend'&&edge.extensionPoint){const points=target.extensionPoints||[];if(!points.some(point=>(typeof point==='string'?point:point?.id)===edge.extensionPoint||(typeof point==='string'?point:point?.name)===edge.extensionPoint))add('warning','extend.point.missing','O ponto de extensão indicado não existe no caso de uso estendido.',edge.id);}
  }
  for(const[graph,label,code]of[[generalizations,'generalização','generalization.cycle'],[includes,'inclusão','include.cycle']]){
    const visiting=new Set(),visited=new Set();
    function visit(id){if(visiting.has(id))return true;if(visited.has(id))return false;visiting.add(id);for(const parent of graph.get(id)||[])if(visit(parent))return true;visiting.delete(id);visited.add(id);return false;}
    for(const id of graph.keys())if(visit(id)){add('error',code,`Ciclo de ${label} detectado.`,id);break;}
  }
  const boundaries=nodes.filter(node=>node.kind==='systemBoundary');
  for(const node of nodes){
    if(node.kind==='actor'&&boundaries.some(boundary=>contains(boundary,node)))add('warning','actor.insideBoundary','Ator está dentro do limite do sistema; revise a posição visual.',node.id);
    if(node.kind==='useCase'&&node.systemBoundaryId){const boundary=byId.get(node.systemBoundaryId);if(!boundary||boundary.kind!=='systemBoundary')add('warning','useCase.boundary.reference','O caso de uso referencia um limite do sistema inexistente.',node.id);else if(!contains(boundary,node))add('warning','useCase.outsideBoundary','Caso de uso associado está fora do limite do sistema.',node.id);}
  }
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j];if(!['actor','useCase'].includes(a.kind)||!['actor','useCase'].includes(b.kind))continue;if(overlaps(a,b))add('warning','element.overlap','Elementos estão visualmente sobrepostos.',b.id);}
  return issues;
}

function dimensions(node){return node.kind==='actor'?{w:90,h:132}:node.kind==='useCase'?{w:Number(node.width)||210,h:Number(node.height)||86}:{w:Number(node.width)||480,h:Number(node.height)||360};}
function contains(boundary,node){const a=dimensions(boundary),b=dimensions(node);return node.x>=boundary.x&&node.y>=boundary.y&&node.x+b.w<=boundary.x+a.w&&node.y+b.h<=boundary.y+a.h;}
function overlaps(a,b){const aa=dimensions(a),bb=dimensions(b);return a.x<b.x+bb.w-12&&a.x+aa.w-12>b.x&&a.y<b.y+bb.h-12&&a.y+aa.h-12>b.y;}

/** Deterministic topology-aware layout. Keeps all semantic objects and edge directions intact. */
export function layoutUseCaseDiagram(diagram){
  const nodes=diagram.nodes||[],edges=diagram.edges||[],actors=nodes.filter(n=>n.kind==='actor'),cases=nodes.filter(n=>n.kind==='useCase'),boundaries=nodes.filter(n=>n.kind==='systemBoundary');
  if(!actors.length&&!cases.length)return false;
  const byId=new Map(nodes.map(n=>[n.id,n])),caseSet=new Set(cases.map(n=>n.id));
  const rank=new Map(),seen=new Set();
  function getRank(id){if(rank.has(id))return rank.get(id);if(seen.has(id))return 0;seen.add(id);const parents=edges.filter(e=>e.type==='include'&&e.from===id&&caseSet.has(e.to)).map(e=>getRank(e.to));const value=parents.length?Math.min(3,Math.max(...parents)+1):0;rank.set(id,value);return value;}
  cases.forEach(n=>getRank(n.id));
  const groups=new Map();for(const node of cases){const group=node.systemBoundaryId||boundaries[0]?.id||'__default';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(node);}
  for(const[groupId,items]of groups){items.sort((a,b)=>(rank.get(a.id)-rank.get(b.id))||a.title.localeCompare(b.title));const columns=Math.max(1,Math.ceil(Math.sqrt(items.length))),gapX=270,gapY=145,left=groupId!=='__default'?60:260,top=85,rows=Math.ceil(items.length/columns),boundary=byId.get(groupId);
    items.forEach((node,index)=>{node.x=left+(index%columns)*gapX;node.y=top+Math.floor(index/columns)*gapY;});
    if(boundary){boundary.x=Math.max(0,boundary.x||180);boundary.y=Math.max(0,boundary.y||30);boundary.width=Math.max(480,columns*gapX+100);boundary.height=Math.max(300,rows*gapY+130);items.forEach(node=>{node.x+=boundary.x;node.y+=boundary.y;});}
  }
  const assoc=edges.filter(e=>e.type==='association');
  const caseLeft=Math.min(260,...cases.map(node=>node.x)),caseRight=Math.max(500,...cases.map(node=>node.x+(Number(node.width)||210)));
  actors.forEach((actor,index)=>{const related=assoc.filter(e=>e.from===actor.id||e.to===actor.id).map(e=>byId.get(e.from===actor.id?e.to:e.from)).filter(n=>n?.kind==='useCase');const center=related.length?related.reduce((sum,n)=>sum+n.x+(Number(n.width)||210)/2,0)/related.length:(index%2?caseRight:caseLeft),side=center<(caseLeft+caseRight)/2?'left':'right',y=related.length?related.reduce((sum,n)=>sum+n.y,0)/related.length:100+index*160;actor.x=side==='left'?30:Math.max(caseRight,...boundaries.map(b=>b.x+(Number(b.width)||480)))+100;actor.y=Math.max(30,Math.round(y-20));});
  return true;
}

export function useCaseRelationshipLabel(type){return ({association:'Associação',include:'«include»',extend:'«extend»',generalization:'Generalização'})[type]||'Relacionamento';}
