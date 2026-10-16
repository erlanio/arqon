const byName=(a,b)=>String(a.title||'').localeCompare(String(b.title||''),'pt-BR')||String(a.id).localeCompare(String(b.id));
const size=(node,sizes)=>sizes.get(node.id)||{w:node.kind==='relationship'||node.kind==='specialization'?110:180,h:node.kind==='attribute'?60:80};
const box=(node,position,sizes)=>{const {w,h}=size(node,sizes);return{x:position.x,y:position.y,w,h}};
const overlaps=(a,b,gap=24)=>a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;

function connectedOrder(nodes,edges){
  const ids=new Set(nodes.map(node=>node.id)),neighbors=new Map(nodes.map(node=>[node.id,new Set()]));
  for(const edge of edges){if(ids.has(edge.from)&&ids.has(edge.to)){neighbors.get(edge.from).add(edge.to);neighbors.get(edge.to).add(edge.from)}}
  const remaining=new Set(ids),result=[];
  while(remaining.size){const root=[...nodes].filter(node=>remaining.has(node.id)).sort((a,b)=>(neighbors.get(a.id).size||Infinity)-(neighbors.get(b.id).size||Infinity)||(Number(a.x)||0)-(Number(b.x)||0)||byName(a,b))[0],queue=[root.id];remaining.delete(root.id);
    for(let i=0;i<queue.length;i++){const id=queue[i];result.push(nodes.find(node=>node.id===id));for(const next of [...neighbors.get(id)].sort())if(remaining.delete(next))queue.push(next)}}
  return result;
}

/** Places logical tables by foreign-key dependency while accounting for rendered heights. */
export function layoutLogicalDiagram(diagram,sizes=new Map()){
  const tables=diagram.nodes.filter(node=>node.kind==='table');if(!tables.length)return new Map();
  const byId=new Map(tables.map(node=>[node.id,node])),children=new Map(tables.map(node=>[node.id,new Set()])),parents=new Map(tables.map(node=>[node.id,new Set()]));
  const connect=(child,parent)=>{if(byId.has(child)&&byId.has(parent)&&child!==parent){children.get(parent).add(child);parents.get(child).add(parent)}};
  for(const edge of diagram.edges||[])connect(edge.from,edge.to);
  for(const table of tables)for(const field of table.fields||[])if(field.references?.tableId)connect(table.id,field.references.tableId);
  // Collapse foreign-key cycles before ranking; an acyclic dependency always moves right.
  const index=new Map(),low=new Map(),stack=[],onStack=new Set(),components=[],componentOf=new Map();let cursor=0;
  function visit(id){index.set(id,cursor);low.set(id,cursor++);stack.push(id);onStack.add(id);for(const child of [...children.get(id)].sort()){if(!index.has(child)){visit(child);low.set(id,Math.min(low.get(id),low.get(child)))}else if(onStack.has(child))low.set(id,Math.min(low.get(id),index.get(child)))}if(low.get(id)===index.get(id)){const component=[];let member;do{member=stack.pop();onStack.delete(member);component.push(member);componentOf.set(member,components.length)}while(member!==id);components.push(component)}}
  for(const node of [...tables].sort(byName))if(!index.has(node.id))visit(node.id);
  const successors=components.map(()=>new Set()),indegree=components.map(()=>0),componentRanks=components.map(()=>0);
  for(const [parent,dependents] of children)for(const child of dependents){const from=componentOf.get(parent),to=componentOf.get(child);if(from!==to&&!successors[from].has(to)){successors[from].add(to);indegree[to]++}}
  const queue=indegree.flatMap((degree,id)=>degree?[]:[id]);for(let i=0;i<queue.length;i++)for(const next of successors[queue[i]]){componentRanks[next]=Math.max(componentRanks[next],componentRanks[queue[i]]+1);if(--indegree[next]===0)queue.push(next)}
  const ranks=new Map(tables.map(node=>[node.id,componentRanks[componentOf.get(node.id)]]));
  const columns=new Map();for(const node of tables){const rank=ranks.get(node.id);if(!columns.has(rank))columns.set(rank,[]);columns.get(rank).push(node)}
  const positions=new Map(),left=Math.max(50,Math.min(...tables.map(node=>Number(node.x)||50))),top=Math.max(50,Math.min(...tables.map(node=>Number(node.y)||50)));
  let x=left;for(const rank of [...columns.keys()].sort((a,b)=>a-b)){const column=columns.get(rank);column.sort((a,b)=>{const related=node=>[...parents.get(node.id)].filter(id=>positions.has(id)).map(id=>positions.get(id).y);const ay=related(a),by=related(b);return (ay.length?ay.reduce((sum,y)=>sum+y,0)/ay.length:Infinity)-(by.length?by.reduce((sum,y)=>sum+y,0)/by.length:Infinity)||byName(a,b)});let y=top;for(const node of column){positions.set(node.id,{x,y});y+=size(node,sizes).h+86}x+=Math.max(...column.map(node=>size(node,sizes).w))+180}
  const bottom=Math.max(...tables.map(node=>positions.get(node.id).y+size(node,sizes).h));let noteX=left;for(const note of diagram.nodes.filter(node=>node.kind!=='table').sort(byName)){positions.set(note.id,{x:noteX,y:bottom+110});noteX+=size(note,sizes).w+50}
  return positions;
}

/** Keeps Chen entities as anchors, relations between participants, and attributes near owners. */
export function layoutConceptualDiagram(diagram,sizes=new Map()){
  const nodes=diagram.nodes||[],edges=diagram.edges||[],byId=new Map(nodes.map(node=>[node.id,node])),core=nodes.filter(node=>['entity','associative'].includes(node.kind));if(!core.length)return new Map();
  const coreEdges=[];for(const relation of nodes.filter(node=>node.kind==='relationship')){const participants=edges.filter(edge=>edge.from===relation.id||edge.to===relation.id).map(edge=>edge.from===relation.id?edge.to:edge.from).filter(id=>core.some(node=>node.id===id));for(let i=1;i<participants.length;i++)coreEdges.push({from:participants[0],to:participants[i]})}
  const ordered=connectedOrder(core,coreEdges),columns=Math.min(4,ordered.length),cellWidth=Math.max(510,...core.map(node=>size(node,sizes).w+320)),rows=Math.ceil(ordered.length/columns),positions=new Map(),occupied=[];
  const left=Math.max(70,Math.min(...core.map(node=>Number(node.x)||70))),top=Math.max(120,Math.min(...core.map(node=>Number(node.y)||120)));
  const rowHeights=Array(rows).fill(340);for(let row=0;row<rows;row++){const members=ordered.slice(row*columns,(row+1)*columns);rowHeights[row]=Math.max(340,...members.map(owner=>{const count=edges.filter(edge=>{const id=edge.from===owner.id?edge.to:edge.to===owner.id?edge.from:null;return byId.get(id)?.kind==='attribute'}).length;return size(owner,sizes).h+125+Math.ceil(count/2)*100}))}
  const rowY=[];for(let row=0,y=top;row<rows;row++){rowY[row]=y;y+=rowHeights[row]+80}
  ordered.forEach((node,index)=>{const p={x:left+(index%columns)*cellWidth,y:rowY[Math.floor(index/columns)]};positions.set(node.id,p);occupied.push(box(node,p,sizes))});
  function place(node,initial){const {w,h}=size(node,sizes),position={x:Math.max(30,Math.round(initial.x)),y:Math.max(30,Math.round(initial.y))};for(let tries=0;tries<80&&occupied.some(item=>overlaps({x:position.x,y:position.y,w,h},item));tries++)position.y+=h+34;positions.set(node.id,position);occupied.push({x:position.x,y:position.y,w,h})}
  for(const relation of nodes.filter(node=>['relationship','specialization'].includes(node.kind)).sort(byName)){const targets=edges.filter(edge=>edge.from===relation.id||edge.to===relation.id).map(edge=>byId.get(edge.from===relation.id?edge.to:edge.from)).filter(node=>node&&positions.has(node.id));if(!targets.length)continue;const centers=targets.map(node=>{const p=positions.get(node.id),{w,h}=size(node,sizes);return{x:p.x+w/2,y:p.y+h/2}});const mean=centers.reduce((sum,p)=>({x:sum.x+p.x,y:sum.y+p.y}),{x:0,y:0});const {w,h}=size(relation,sizes);place(relation,{x:mean.x/centers.length-w/2,y:mean.y/centers.length-h/2})}
  const attributes=nodes.filter(node=>node.kind==='attribute').sort(byName),ownerCount=new Map();for(const attribute of attributes){const ownerId=edges.find(edge=>edge.from===attribute.id&&positions.has(edge.to))?.to||edges.find(edge=>edge.to===attribute.id&&positions.has(edge.from))?.from,owner=byId.get(ownerId);if(!owner)continue;const index=ownerCount.get(ownerId)||0;ownerCount.set(ownerId,index+1);const p=positions.get(ownerId),ownerSize=size(owner,sizes),attrSize=size(attribute,sizes),relationOwner=owner.kind==='relationship'||owner.kind==='specialization';place(attribute,{x:p.x+ownerSize.w/2-attrSize.w/2+(index%2?attrSize.w/2+22:-(attrSize.w/2+22)),y:relationOwner?p.y-attrSize.h-85-Math.floor(index/2)*(attrSize.h+35):p.y+ownerSize.h+70+Math.floor(index/2)*(attrSize.h+35)})}
  const remaining=nodes.filter(node=>!positions.has(node.id)).sort(byName);let y=Math.max(...occupied.map(item=>item.y+item.h))+100;for(const node of remaining){place(node,{x:left,y});y=positions.get(node.id).y+size(node,sizes).h+60}
  return positions;
}
