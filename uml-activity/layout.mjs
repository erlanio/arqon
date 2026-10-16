import {CONTAINER_KINDS,NON_EXECUTABLE_KINDS} from './registry.mjs';

const center=(view,axis)=>view[axis]+view[axis==='x'?'w':'h']/2;
function stronglyConnectedComponents(nodes,edges) {
  const byId=new Map(nodes.map(node=>[node.id,node])),adj=new Map(nodes.map(node=>[node.id,[]]));
  for(const edge of edges)if(byId.has(edge.sourceId)&&byId.has(edge.targetId))adj.get(edge.sourceId).push(edge.targetId);
  let next=0;const stack=[],onStack=new Set(),index=new Map(),low=new Map(),components=[];
  function visit(id){index.set(id,next);low.set(id,next++);stack.push(id);onStack.add(id);for(const target of adj.get(id)){if(!index.has(target)){visit(target);low.set(id,Math.min(low.get(id),low.get(target)));}else if(onStack.has(target))low.set(id,Math.min(low.get(id),index.get(target)));}if(low.get(id)===index.get(id)){const component=[];let item;do{item=stack.pop();onStack.delete(item);component.push(item);}while(item!==id);components.push(component);}}
  for(const node of nodes)if(!index.has(node.id))visit(node.id);
  return{components,adj};
}
function graphLayers(nodes,edges) {
  const {components,adj}=stronglyConnectedComponents(nodes,edges),componentOf=new Map();components.forEach((items,index)=>items.forEach(id=>componentOf.set(id,index)));
  const next=components.map(()=>new Set()),indegree=components.map(()=>0);
  for(const [source,targets] of adj)for(const target of targets){const a=componentOf.get(source),b=componentOf.get(target);if(a!==b&&!next[a].has(b)){next[a].add(b);indegree[b]++;}}
  const rank=components.map(()=>0),queue=indegree.map((n,i)=>n===0?i:-1).filter(i=>i>=0),topology=[];
  while(queue.length){const current=queue.shift();topology.push(current);for(const target of next[current]){rank[target]=Math.max(rank[target],rank[current]+1);if(--indegree[target]===0)queue.push(target);}}
  const layers=new Map();for(const node of nodes){const value=rank[componentOf.get(node.id)]||0;if(!layers.has(value))layers.set(value,[]);layers.get(value).push(node);}
  return{layers,adj,componentOf,components};
}
function partitionIndex(diagram,node) {
  const id=(node.partitionIds||[]).find(value=>diagram.model.partitions.some(partition=>partition.id===value));
  return id?diagram.model.partitions.findIndex(partition=>partition.id===id):diagram.model.partitions.length;
}
function orderLayers(diagram,layers,adj,axis) {
  const ordered=new Map([...layers].map(([rank,nodes])=>[rank,[...nodes].sort((a,b)=>partitionIndex(diagram,a)-partitionIndex(diagram,b)||center(diagram.view.nodes[a.id],axis)-center(diagram.view.nodes[b.id],axis))]));
  for(let pass=0;pass<4;pass++){
    const ranks=[...ordered.keys()].sort((a,b)=>a-b);if(pass%2)ranks.reverse();const positions=new Map();for(const nodes of ordered.values())nodes.forEach((node,index)=>positions.set(node.id,index));
    for(const rank of ranks){if(rank===ranks[0]||ordered.get(rank).length<2)continue;const nodes=ordered.get(rank);nodes.sort((a,b)=>{
      const score=node=>{const neighbors=[...(adj.get(node.id)||[])].map(id=>positions.get(id)).filter(Number.isFinite);return neighbors.length?neighbors.reduce((sum,n)=>sum+n,0)/neighbors.length:center(diagram.view.nodes[node.id],axis)/100;};
      return partitionIndex(diagram,a)-partitionIndex(diagram,b)||score(a)-score(b)||center(diagram.view.nodes[a.id],axis)-center(diagram.view.nodes[b.id],axis);
    });nodes.forEach((node,index)=>positions.set(node.id,index));}
  }
  return ordered;
}
function layoutUnpartitioned(diagram,layers,direction,{margin=90,rankGap=110,nodeGap=56}={}) {
  const ordered=orderLayers(diagram,layers,graphLayers(diagram.model.nodes.filter(node=>!CONTAINER_KINDS.has(node.kind)&&!NON_EXECUTABLE_KINDS.has(node.kind)),diagram.model.edges).adj,direction==='horizontal'?'y':'x'),ranks=[...ordered.keys()].sort((a,b)=>a-b);
  let cursor=margin;
  for(const rank of ranks){const nodes=ordered.get(rank),rankSize=Math.max(...nodes.map(node=>diagram.view.nodes[node.id][direction==='horizontal'?'w':'h']));let cross=margin;for(const node of nodes){const view=diagram.view.nodes[node.id],size=view[direction==='horizontal'?'h':'w'];if(direction==='horizontal'){view.x=cursor;view.y=cross;}else{view.x=cross;view.y=cursor;}cross+=size+nodeGap;}cursor+=rankSize+rankGap;}
}
function layoutInPartitions(diagram,layers,direction,{margin=56,rankGap=110,nodeGap=46,laneGap=32}={}) {
  const partitions=diagram.model.partitions,axis=direction==='horizontal'?'x':'y',crossAxis=axis==='x'?'y':'x';
  const ordered=orderLayers(diagram,layers,graphLayers(diagram.model.nodes.filter(node=>!CONTAINER_KINDS.has(node.kind)&&!NON_EXECUTABLE_KINDS.has(node.kind)),diagram.model.edges).adj,crossAxis);
  let laneCursor=Math.min(...partitions.map(p=>diagram.view.partitions[p.id]?.[crossAxis]??0));
  for(const part of partitions){
    const rect=diagram.view.partitions[part.id];if(!rect)continue;
    const members=diagram.model.nodes.filter(node=>node.partitionIds?.find(id=>partitions.some(candidate=>candidate.id===id))===part.id&&!CONTAINER_KINDS.has(node.kind)&&!NON_EXECUTABLE_KINDS.has(node.kind));
    const groups=new Map();for(const rank of [...ordered.keys()].sort((a,b)=>a-b)){const contained=ordered.get(rank).filter(node=>members.includes(node));if(contained.length)groups.set(rank,contained);}
    const crossSize=part.orientation==='vertical'?Math.max(220,...[...groups.values()].map(group=>group.reduce((sum,node)=>sum+diagram.view.nodes[node.id].w,0)+nodeGap*Math.max(0,group.length-1)+margin*2)):Math.max(170,...[...groups.values()].map(group=>Math.max(...group.map(node=>diagram.view.nodes[node.id].h))+margin*2));
    const ranks=[...groups.keys()],maxFlowItem=groups.size?Math.max(...[...groups.values()].map(group=>Math.max(...group.map(node=>diagram.view.nodes[node.id][direction==='horizontal'?'w':'h'])))):0;
    const flowSize=Math.max(320,Math.max(0,groups.size-1)*rankGap+maxFlowItem+margin*2);
    if(part.orientation==='vertical')rect.x=laneCursor;else rect.y=laneCursor;
    rect.w=direction==='horizontal'?flowSize:crossSize;rect.h=direction==='vertical'?flowSize:crossSize;
    for(const [rank,group] of groups){const index=[...groups.keys()].sort((a,b)=>a-b).indexOf(rank),axisPosition=margin+index*rankGap;let cross=margin;
      for(const node of group){const view=diagram.view.nodes[node.id];if(direction==='horizontal'){view.x=rect.x+axisPosition;view.y=rect.y+cross;}else{view.x=rect.x+cross;view.y=rect.y+axisPosition+38;}cross+=(direction==='horizontal'?view.h:view.w)+nodeGap;}
    }
    laneCursor+=(part.orientation==='vertical'?rect.w:rect.h)+laneGap;
  }
  // A node may participate in multiple ActivityPartitions. Place it once using
  // its primary partition, then expand its other partitions to contain it.
  for(const node of diagram.model.nodes){const memberships=node.partitionIds||[];if(memberships.length<2||CONTAINER_KINDS.has(node.kind)||NON_EXECUTABLE_KINDS.has(node.kind))continue;const view=diagram.view.nodes[node.id];if(!view)continue;for(const id of memberships.slice(1)){const rect=diagram.view.partitions[id];if(!rect)continue;const left=Math.min(rect.x,view.x-18),top=Math.min(rect.y,view.y-42),right=Math.max(rect.x+rect.w,view.x+view.w+18),bottom=Math.max(rect.y+rect.h,view.y+view.h+18);rect.x=left;rect.y=top;rect.w=right-left;rect.h=bottom-top;}}
  const unassigned=diagram.model.nodes.filter(node=>!CONTAINER_KINDS.has(node.kind)&&!NON_EXECUTABLE_KINDS.has(node.kind)&&!(node.partitionIds||[]).some(id=>partitions.some(part=>part.id===id)));
  if(unassigned.length){const base=Math.max(...partitions.map(p=>{const r=diagram.view.partitions[p.id];return r? r[axis]+r[axis==='x'?'w':'h']+laneGap:0}));let cross=margin;for(const node of unassigned){const view=diagram.view.nodes[node.id];if(direction==='horizontal'){view.x=base;view.y=cross;}else{view.x=cross;view.y=base;}cross+=(direction==='horizontal'?view.h:view.w)+nodeGap;}}
}
export function autoLayout(diagram,{direction='auto',margin=90,rankGap=110,nodeGap=56,laneGap=32}={}) {
  const flowNodes=diagram.model.nodes.filter(node=>!CONTAINER_KINDS.has(node.kind)&&!NON_EXECUTABLE_KINDS.has(node.kind));
  if(!flowNodes.length)return{direction:'horizontal',moved:0};
  const graph=graphLayers(flowNodes,diagram.model.edges),layers=graph.layers;
  const laneOrientations=diagram.model.partitions.map(partition=>partition.orientation),resolved=direction==='auto'?(laneOrientations.length?(laneOrientations.filter(value=>value==='vertical').length>=laneOrientations.filter(value=>value==='horizontal').length?'vertical':'horizontal'):'horizontal'):direction;
  if(!['horizontal','vertical'].includes(resolved))throw new Error('Direção de organização inválida.');
  const before=new Map(flowNodes.map(node=>[node.id,{...diagram.view.nodes[node.id]}]));
  if(diagram.model.partitions.length)layoutInPartitions(diagram,layers,resolved,{margin,rankGap,nodeGap,laneGap});else layoutUnpartitioned(diagram,layers,resolved,{margin,rankGap,nodeGap});
  const strays=diagram.model.nodes.filter(node=>!flowNodes.includes(node)),startY=Math.max(200,...flowNodes.map(node=>diagram.view.nodes[node.id].y+diagram.view.nodes[node.id].h+80));let x=margin;
  for(const node of strays){const view=diagram.view.nodes[node.id];view.x=x;view.y=startY;x+=view.w+nodeGap;}
  return{direction:resolved,moved:flowNodes.filter(node=>before.get(node.id).x!==diagram.view.nodes[node.id].x||before.get(node.id).y!==diagram.view.nodes[node.id].y).length};
}
export function alignNodes(diagram, ids) {
  const views=ids.map(id=>diagram.view.nodes[id]).filter(Boolean);if(views.length<2)return;
  const y=Math.min(...views.map(v=>v.y));for(const view of views)view.y=y;
}
export function distributeNodes(diagram, ids) {
  const views=ids.map(id=>diagram.view.nodes[id]).filter(Boolean).sort((a,b)=>a.x-b.x);if(views.length<3)return;
  const left=views[0].x,right=views.at(-1).x;views.forEach((view,index)=>view.x=left+(right-left)*index/(views.length-1));
}
