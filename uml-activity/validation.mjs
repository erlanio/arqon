import {NODE_REGISTRY, OBJECT_KINDS, CONTROL_KINDS, CONTAINER_KINDS, NON_EXECUTABLE_KINDS} from './registry.mjs';
import {stereotypeOptions} from './model.mjs';

const issue=(severity,code,message,elementId)=>({severity,code,message,elementId});
const guardText=value=>typeof value==='string'&&/^\[(?:[^\[\]]+)\]$/.test(value.trim());
const tagValid=(type,value)=>value==null||value===''||(
  type==='string' ? typeof value==='string' :
  type==='integer' ? Number.isInteger(Number(value)) :
  type==='number' ? Number.isFinite(Number(value)) :
  type==='boolean' ? typeof value==='boolean'||value==='true'||value==='false' : true
);

// This validates the editor's supported UML activity subset. Suggestions are kept
// separate from structural errors so common modeling advice is not called a UML rule.
export function validateDiagram(project,diagram) {
  const issues=[];
  const nodes=new Map(diagram.model.nodes.map(n=>[n.id,n]));
  const partitions=new Map(diagram.model.partitions.map(p=>[p.id,p]));
  const incoming=id=>diagram.model.edges.filter(e=>e.targetId===id);
  const outgoing=id=>diagram.model.edges.filter(e=>e.sourceId===id);
  const applied=stereotypeOptions(project,diagram);
  const stereotypes=new Map(applied.map(({stereotype})=>[stereotype.id,stereotype]));
  for(const node of diagram.model.nodes) {
    const inEdges=incoming(node.id),outEdges=outgoing(node.id);
    if(node.kind==='initial'&&inEdges.length) issues.push(issue('error','INITIAL_INCOMING','Initial Node não pode receber fluxo de entrada.',node.id));
    if(node.kind==='initial'&&outEdges.length>1) issues.push(issue('error','INITIAL_MULTIPLE_OUTGOING','Initial Node não pode iniciar vários fluxos diretamente.',node.id));
    if(node.kind==='initial'&&!outEdges.length&&diagram.model.nodes.length>1) issues.push(issue('warning','INITIAL_NO_OUTGOING','Initial Node ainda não inicia um fluxo.',node.id));
    if(['activityFinal','flowFinal'].includes(node.kind)&&outEdges.length) issues.push(issue('error','FINAL_OUTGOING','Nó final não pode possuir fluxo de saída.',node.id));
    if(node.kind==='decision') {
      const guards=outEdges.map(edge=>String(edge.guard||'').trim());
      if(inEdges.length!==1) issues.push(issue('error','DECISION_INCOMING','Decision Node deve receber exatamente um fluxo de entrada.',node.id));
      if(outEdges.length<2) issues.push(issue('error','DECISION_OUTGOING','Decision Node precisa de pelo menos dois fluxos de saída.',node.id));
      if(guards.filter(g=>g==='[else]').length>1) issues.push(issue('error','MULTIPLE_ELSE','Decision Node possui mais de uma guarda [else].',node.id));
      if(outEdges.length>1&&guards.some(g=>!g)) issues.push(issue('warning','DECISION_GUARDS','Considere guardas nos fluxos de saída da decisão.',node.id));
      const explicit=guards.filter(Boolean);if(new Set(explicit).size!==explicit.length)issues.push(issue('warning','DUPLICATE_DECISION_GUARD','A decisão repete uma guarda de saída.',node.id));
    }
    if(node.kind==='fork'&&(inEdges.length!==1||outEdges.length<2)) issues.push(issue('warning','FORK_SHAPE','Fork costuma ter uma entrada e múltiplas saídas.',node.id));
    if(node.kind==='join'&&(inEdges.length<2||outEdges.length!==1)) issues.push(issue('warning','JOIN_SHAPE','Join costuma sincronizar múltiplas entradas antes de uma saída.',node.id));
    if(node.kind==='merge'&&(inEdges.length<2||outEdges.length!==1)) issues.push(issue('suggestion','MERGE_SHAPE','Confira se Merge reúne caminhos alternativos.',node.id));
    if(node.kind==='callBehavior') {
      const id=node.properties?.calledActivityId;
      if(id&&!project.diagrams.some(d=>d.id===id)) issues.push(issue('error','MISSING_ACTIVITY','A atividade chamada não existe no projeto.',node.id));
      if(!id) issues.push(issue('warning','UNBOUND_ACTIVITY','Selecione a atividade reutilizada por esta ação.',node.id));
    }
    if(!inEdges.length&&!['initial','note','constraint','durationConstraint','timeConstraint','timeEvent','signalEvent','exceptionHandler'].includes(node.kind))issues.push(issue('warning','NODE_WITHOUT_INPUT','Elemento sem fluxo de entrada; confira se está conectado à atividade.',node.id));
    if(!outEdges.length&&!['activityFinal','flowFinal','note','constraint','durationConstraint','timeConstraint','timeEvent','signalEvent','exceptionHandler'].includes(node.kind))issues.push(issue('warning','NODE_WITHOUT_OUTPUT','Elemento sem fluxo de saída; confira se o caminho termina corretamente.',node.id));
    if(node.kind==='join'&&node.properties?.joinSpec!=null&&typeof node.properties.joinSpec!=='string') issues.push(issue('error','JOIN_SPEC','JoinSpec deve ser uma expressão textual.',node.id));
    if(node.kind==='expansion'&&!['iterative','parallel','stream'].includes(node.properties?.mode)) issues.push(issue('error','EXPANSION_MODE','Modo da Expansion Region inválido.',node.id));
    if(node.parentId) {
      const parent=nodes.get(node.parentId);
      if(!parent||!CONTAINER_KINDS.has(parent.kind)) issues.push(issue('error','BAD_CONTAINER','Nó contido em estrutura inexistente ou incompatível.',node.id));
      const visited=new Set([node.id]);let cursor=parent;
      while(cursor) {if(visited.has(cursor.id)){issues.push(issue('error','CONTAINMENT_CYCLE','Ciclo de contenção detectado.',node.id));break;}visited.add(cursor.id);cursor=nodes.get(cursor.parentId);}
    }
    for(const partitionId of node.partitionIds||[]) if(!partitions.has(partitionId)) issues.push(issue('error','MISSING_PARTITION','Nó referencia uma partição inexistente.',node.id));
    for(const application of node.stereotypes||[]) {
      const stereotype=stereotypes.get(application.id);
      if(!stereotype) {issues.push(issue('error','MISSING_STEREOTYPE','Estereótipo indisponível no perfil aplicado.',node.id));continue;}
      if(!stereotype.metaclasses.includes(NODE_REGISTRY[node.kind].metaclass)) issues.push(issue('error','STEREOTYPE_METACLASS',`«${stereotype.name}» não se aplica a ${NODE_REGISTRY[node.kind].metaclass}.`,node.id));
      for(const tag of stereotype.tags||[]) {
        const value=application.values?.[tag.name];
        if(!tagValid(tag.type,value)) issues.push(issue('error','TAG_TYPE',`Valor de ${tag.name} não corresponde ao tipo ${tag.type}.`,node.id));
        if(tag.required&&(value==null||value==='')) issues.push(issue('error','TAG_REQUIRED',`Valor obrigatório de ${tag.name} ausente.`,node.id));
      }
      for(const constraint of stereotype.constraints||[]) {
        const value=application.values?.[constraint.tag];
        if(constraint.operator==='equals'&&String(value??'')!==String(constraint.value??'')) issues.push(issue('error','PROFILE_CONSTRAINT',`Restrição de «${stereotype.name}» não atendida.`,node.id));
      }
    }
  }
  for(const edge of diagram.model.edges) {
    const source=nodes.get(edge.sourceId),target=nodes.get(edge.targetId);
    if(!source||!target){issues.push(issue('error','BROKEN_EDGE','Fluxo referencia nó inexistente.',edge.id));continue;}
    if(source.kind==='activityFinal'||source.kind==='flowFinal') issues.push(issue('error','FINAL_SOURCE','Nó final não pode iniciar fluxo.',edge.id));
    if(target.kind==='initial') issues.push(issue('error','INITIAL_TARGET','Initial Node não pode receber fluxo.',edge.id));
    if(NON_EXECUTABLE_KINDS.has(source.kind)||NON_EXECUTABLE_KINDS.has(target.kind)) issues.push(issue('error','NON_FLOW_NODE','Um elemento de anotação ou restrição não é extremo de fluxo.',edge.id));
    if(edge.kind==='control'&&(OBJECT_KINDS.has(source.kind)||OBJECT_KINDS.has(target.kind))) issues.push(issue('error','CONTROL_OBJECT','Control Flow não conecta diretamente nós de objeto neste editor.',edge.id));
    if(edge.kind==='object') {
      if(CONTROL_KINDS.has(source.kind)||CONTROL_KINDS.has(target.kind)) issues.push(issue('error','OBJECT_CONTROL','Object Flow não pode conectar nós de controle.',edge.id));
      if(!OBJECT_KINDS.has(source.kind)&&!OBJECT_KINDS.has(target.kind)) issues.push(issue('error','OBJECT_ENDPOINT','Object Flow requer nó de objeto ou pin.',edge.id));
      if(source.kind==='inputPin'||target.kind==='outputPin') issues.push(issue('error','PIN_DIRECTION','Direção do pin é incompatível com este fluxo.',edge.id));
      const sourceDirection=source.kind==='activityParameter'?source.properties?.direction:null,targetDirection=target.kind==='activityParameter'?target.properties?.direction:null;
      if(sourceDirection&&['out','return'].includes(sourceDirection))issues.push(issue('error','PARAMETER_SOURCE_DIRECTION',`Activity Parameter Node com direção ${sourceDirection} não pode ser origem deste fluxo.`,edge.id));
      if(targetDirection==='in')issues.push(issue('error','PARAMETER_TARGET_DIRECTION','Activity Parameter Node com direção in não pode ser destino deste fluxo.',edge.id));
      const fromType=source.properties?.objectType,toType=target.properties?.objectType;
      if(fromType&&toType&&fromType!==toType) issues.push(issue('warning','OBJECT_TYPE','Confira a compatibilidade entre os tipos de objeto; subtipos não são inferidos.',edge.id));
    }
    if(edge.guard&&!guardText(edge.guard)) issues.push(issue('error','GUARD_FORMAT','Use guardas entre colchetes, como [aprovado] ou [else].',edge.id));
    if(!Number.isInteger(Number(edge.weight))||Number(edge.weight)<1) issues.push(issue('error','WEIGHT','O peso do fluxo deve ser um inteiro positivo.',edge.id));
    if(edge.interrupting&&!diagram.model.nodes.some(n=>n.kind==='interruptible'&&(source.parentId===n.id||target.parentId===n.id))) issues.push(issue('warning','INTERRUPTING_REGION','Confira a origem do Interrupting Edge em uma região interrompível.',edge.id));
  }
  for(const partition of diagram.model.partitions) {
    if(partition.parentId&&!partitions.has(partition.parentId)) issues.push(issue('error','PARTITION_PARENT','Partição pai inexistente.',partition.id));
    const visited=new Set([partition.id]);let parent=partitions.get(partition.parentId);while(parent){if(visited.has(parent.id)){issues.push(issue('error','PARTITION_CYCLE','Ciclo de contenção entre partições.',partition.id));break;}visited.add(parent.id);parent=partitions.get(parent.parentId);}
  }
  const starts=diagram.model.nodes.filter(node=>node.kind==='initial');
  if(starts.length){const reachable=new Set(starts.map(node=>node.id)),queue=[...reachable];while(queue.length){const id=queue.shift();for(const edge of diagram.model.edges.filter(item=>item.kind==='control'&&item.sourceId===id))if(!reachable.has(edge.targetId)){reachable.add(edge.targetId);queue.push(edge.targetId);}}for(const node of diagram.model.nodes)if(!reachable.has(node.id)&&!NON_EXECUTABLE_KINDS.has(node.kind))issues.push(issue('warning','UNREACHABLE_NODE','Elemento não alcançável a partir de um Initial Node.',node.id));}
  if(!diagram.model.nodes.some(n=>n.kind==='initial')) issues.push(issue('suggestion','NO_INITIAL','Considere um Initial Node para indicar o início.',null));
  return issues;
}
