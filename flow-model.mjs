const START_KINDS = new Set(['start']);
const END_KINDS = new Set(['end']);
const REQUIRED_NAME_KINDS = new Set(['process','decision','start','end','inputOutput','subprocess','document','documents','database','connector','pageConnector','preparation','manualInput','display','delay']);

const outgoingFor = (diagram, id) => (diagram?.edges || []).filter(edge => edge.from === id);

export function validateFlowDiagram(diagram, {diagrams=[]}={}) {
  const issues=[];
  const nodes=Array.isArray(diagram?.nodes)?diagram.nodes:[];
  const edges=Array.isArray(diagram?.edges)?diagram.edges:[];
  const add=(severity,code,message,elementId,suggestion='')=>issues.push({severity,code,message,elementId,suggestion});
  const ids=new Set(),byId=new Map();
  for(const node of nodes){
    if(!node?.id||ids.has(node.id))add('error','duplicate-element-id','Há elementos sem identificador único.',node?.id||'');
    ids.add(node?.id);byId.set(node?.id,node);
    if(REQUIRED_NAME_KINDS.has(node.kind)&&!String(node.title||'').trim())add('error','empty-element-name','Um símbolo obrigatório está sem nome.',node.id,'Dê um nome ao elemento.');
  }
  const starts=nodes.filter(node=>START_KINDS.has(node.kind));
  const ends=nodes.filter(node=>END_KINDS.has(node.kind));
  if(!starts.length)add('error','missing-start','O fluxograma precisa de ao menos um elemento de início.',nodes[0]?.id||'');
  if(!ends.length)add('warning','missing-end','Não há um elemento Fim explícito.','', 'Adicione um símbolo Fim para indicar onde o fluxo termina.');
  const validEdges=[];
  for(const edge of edges){
    const from=byId.get(edge.from),to=byId.get(edge.to);
    if(!from||!to){add('error','invalid-endpoint','A conexão aponta para um elemento inexistente.',edge.id);continue;}
    validEdges.push(edge);
    if(END_KINDS.has(from.kind))add('error','flow-from-end','Um elemento Fim não pode ter saídas.',edge.id,'Redirecione a conexão para outro símbolo.');
    if(START_KINDS.has(to.kind))add('error','flow-into-start','Uma conexão não pode entrar no Início.',edge.id,'Inicie o fluxo neste símbolo.');
  }
  const outgoingById=new Map(nodes.map(node=>[node.id,[]])),incomingById=new Map(nodes.map(node=>[node.id,[]]));
  for(const edge of validEdges){outgoingById.get(edge.from)?.push(edge);incomingById.get(edge.to)?.push(edge);}
  const outgoing=id=>outgoingById.get(id)||[],incoming=id=>incomingById.get(id)||[];
  for(const node of nodes){
    const nodeIncoming=incoming(node.id),nodeOutgoing=outgoing(node.id);
    if(!nodeIncoming.length&&!START_KINDS.has(node.kind))add('warning','disconnected-input',`${node.title||'Elemento'} não possui conexão de entrada.`,node.id,'Conecte o elemento ao fluxo ou remova-o.');
    if(!nodeOutgoing.length&&!END_KINDS.has(node.kind))add('warning','disconnected-output',`${node.title||'Elemento'} não possui conexão de saída.`,node.id,'Conecte o elemento a uma próxima etapa ou a um Fim.');
    if(node.kind==='decision'){
      if(nodeOutgoing.length<2)add('warning','decision-branches',`A decisão ${node.title||''} tem menos de duas saídas.`,node.id,'Adicione saídas para os resultados possíveis.');
      const missing=nodeOutgoing.filter(edge=>!String(edge.label||'').trim());
      if(missing.length)add('warning','unlabeled-decision-branch',`A decisão ${node.title||''} tem ${missing.length} saída(s) sem rótulo.`,missing[0].id,'Identifique cada conexão, por exemplo Sim e Não.');
      if(!String(node.condition||'').trim())add('info','unnamed-condition',`A condição da decisão ${node.title||''} não foi documentada.`,node.id,'Descreva a condição no painel de propriedades.');
    }
    if(node.kind==='subprocess'&&node.subprocessRef&&!diagrams.some(item=>item.id===node.subprocessRef&&item.type==='fluxo'))add('warning','invalid-subprocess-reference','O fluxograma vinculado não está disponível.',node.id,'Selecione um fluxograma existente.');
  }
  for(const connector of nodes.filter(node=>['connector','pageConnector'].includes(node.kind))){
    const key=String(connector.connectorId||connector.title||'').trim().toLocaleLowerCase('pt-BR');
    const matches=nodes.filter(node=>node.id!==connector.id&&['connector','pageConnector'].includes(node.kind)&&String(node.connectorId||node.title||'').trim().toLocaleLowerCase('pt-BR')===key);
    if(!key||matches.length!==1)add('warning','unmatched-connector',`O conector ${connector.title||''} não possui exatamente um par correspondente.`,connector.id,'Use o mesmo identificador em dois conectores.');
  }
  const reachable=new Set(),queue=starts.map(node=>node.id);
  for(let cursor=0;cursor<queue.length;cursor++){const id=queue[cursor];if(reachable.has(id))continue;reachable.add(id);for(const edge of outgoing(id))queue.push(edge.to);}
  for(const node of nodes)if(!START_KINDS.has(node.kind)&&!reachable.has(node.id))add('warning','unreachable-element',`${node.title||'Elemento'} não pode ser alcançado a partir de um início.`,node.id);
  const reachesEnd=new Set(),reverse=ends.map(node=>node.id);
  for(let cursor=0;cursor<reverse.length;cursor++){const id=reverse[cursor];if(reachesEnd.has(id))continue;reachesEnd.add(id);for(const edge of incoming(id))reverse.push(edge.from);}
  for(const node of nodes)if(reachable.has(node.id)&&!reachesEnd.has(node.id))add('warning','no-end-path',`Não foi identificada uma rota de ${node.title||'elemento'} até um Fim. Ciclos podem ser intencionais.`,node.id,'Verifique se há uma saída que alcance um elemento Fim.');
  const visited=new Set(),finishOrder=[];
  for(const node of nodes){if(visited.has(node.id))continue;const stack=[[node.id,false]];while(stack.length){const [id,exit]=stack.pop();if(exit){finishOrder.push(id);continue;}if(visited.has(id))continue;visited.add(id);stack.push([id,true]);const next=outgoing(id);for(let index=next.length-1;index>=0;index--)if(!visited.has(next[index].to))stack.push([next[index].to,false]);}}
  const reverseAdj=new Map(nodes.map(node=>[node.id,[]]));for(const edge of validEdges)reverseAdj.get(edge.to)?.push(edge.from);const assigned=new Set();
  for(const id of finishOrder.reverse()){if(assigned.has(id))continue;const component=[],stack=[id];assigned.add(id);while(stack.length){const currentId=stack.pop();component.push(currentId);for(const prior of reverseAdj.get(currentId)||[])if(!assigned.has(prior)){assigned.add(prior);stack.push(prior);}}const cyclic=component.length>1||validEdges.some(edge=>edge.from===id&&edge.to===id);if(cyclic){const first=byId.get(component[0]);add('info','potential-cycle',`Foi identificado um ciclo envolvendo ${component.length} elemento(s).`,first?.id||id,'Ciclos podem representar repetição intencional; confirme que existe uma condição de saída.');}}
  return issues;
}

export function flowNextOptions(diagram,nodeId) {
  const node=(diagram?.nodes||[]).find(item=>item.id===nodeId);
  if(!node)return {status:'invalid',options:[]};
  if(END_KINDS.has(node.kind))return {status:'complete',options:[]};
  const options=outgoingFor(diagram,nodeId).map(edge=>({edge,node:(diagram.nodes||[]).find(item=>item.id===edge.to)})).filter(item=>item.node);
  if(!options.length)return {status:'dead-end',options:[]};
  if(node.kind==='decision'&&options.length>1)return {status:'choice',options};
  return {status:'next',options};
}

export function initialFlowNode(diagram) {
  return (diagram?.nodes||[]).find(node=>START_KINDS.has(node.kind))||null;
}
