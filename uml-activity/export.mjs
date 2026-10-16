import {NODE_REGISTRY,CONTAINER_KINDS} from './registry.mjs';

const xml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const fmt=n=>Math.round(n*100)/100;
const rectOf=(diagram,id)=>diagram.view.nodes[id];
function sideToward(rect,toward) {
  const dx=toward.x-(rect.x+rect.w/2),dy=toward.y-(rect.y+rect.h/2);
  if(Math.abs(dx)>=Math.abs(dy))return dx<0?'left':'right';
  return dy<0?'top':'bottom';
}
function shapeBounds(rect,kind) {
  const size=kind==='initial'?29:['activityFinal','flowFinal'].includes(kind)?36:null,height=['fork','join'].includes(kind)?14:null;
  if(size)return{x:rect.x+(rect.w-size)/2,y:rect.y+(rect.h-size)/2,w:size,h:size};
  if(height)return{x:rect.x,y:rect.y+(rect.h-height)/2,w:rect.w,h:height};
  return rect;
}
function boundary(rect,toward,kind,side) {
  rect=shapeBounds(rect,kind);
  const cx=rect.x+rect.w/2,cy=rect.y+rect.h/2,dx=toward.x-cx,dy=toward.y-cy;
  if(side){
    const diamond=NODE_REGISTRY[kind]?.shape==='diamond',circle=['initial','activityFinal','flowFinal'].includes(kind);
    if(diamond)return ({left:{x:rect.x,y:cy},right:{x:rect.x+rect.w,y:cy},top:{x:cx,y:rect.y},bottom:{x:cx,y:rect.y+rect.h}})[side];
    if(circle){const radius=Math.min(rect.w,rect.h)/2;return ({left:{x:cx-radius,y:cy},right:{x:cx+radius,y:cy},top:{x:cx,y:cy-radius},bottom:{x:cx,y:cy+radius}})[side];}
    return ({left:{x:rect.x,y:cy},right:{x:rect.x+rect.w,y:cy},top:{x:cx,y:rect.y},bottom:{x:cx,y:rect.y+rect.h}})[side];
  }
  const shape=NODE_REGISTRY[kind]?.shape;
  if(shape==='diamond'){const t=1/(Math.abs(dx)/(rect.w/2)+Math.abs(dy)/(rect.h/2)||1);return{x:fmt(cx+dx*t),y:fmt(cy+dy*t)};}
  if(['initial','activityFinal','flowFinal'].includes(kind)){const radius=Math.min(rect.w,rect.h)/2,t=radius/(Math.hypot(dx,dy)||1);return{x:fmt(cx+dx*t),y:fmt(cy+dy*t)};}
  const t=Math.min(rect.w/2/Math.max(Math.abs(dx),.001),rect.h/2/Math.max(Math.abs(dy),.001));return{x:fmt(cx+dx*t),y:fmt(cy+dy*t)};
}
function roundedPolyline(points,radius=12) {
  const clean=points.filter((point,index)=>!index||Math.hypot(point.x-points[index-1].x,point.y-points[index-1].y)>.5);
  if(clean.length<3)return clean.map((point,index)=>`${index?'L':'M'} ${fmt(point.x)} ${fmt(point.y)}`).join(' ');
  let d=`M ${fmt(clean[0].x)} ${fmt(clean[0].y)}`;
  for(let i=1;i<clean.length-1;i++){
    const prev=clean[i-1],corner=clean[i],next=clean[i+1],beforeLength=Math.hypot(corner.x-prev.x,corner.y-prev.y),afterLength=Math.hypot(next.x-corner.x,next.y-corner.y),r=Math.min(radius,beforeLength/2,afterLength/2);
    const before={x:corner.x+(prev.x-corner.x)*r/(beforeLength||1),y:corner.y+(prev.y-corner.y)*r/(beforeLength||1)},after={x:corner.x+(next.x-corner.x)*r/(afterLength||1),y:corner.y+(next.y-corner.y)*r/(afterLength||1)};
    d+=` L ${fmt(before.x)} ${fmt(before.y)} Q ${fmt(corner.x)} ${fmt(corner.y)} ${fmt(after.x)} ${fmt(after.y)}`;
  }
  const last=clean.at(-1);return d+` L ${fmt(last.x)} ${fmt(last.y)}`;
}
function longestSegmentLabel(points) {
  let chosen=null,length=0;
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],n=Math.hypot(b.x-a.x,b.y-a.y);if(n>length){length=n;chosen={a,b};}}
  if(!chosen)return{x:0,y:0};const horizontal=Math.abs(chosen.b.x-chosen.a.x)>=Math.abs(chosen.b.y-chosen.a.y);
  return{x:fmt((chosen.a.x+chosen.b.x)/2+(horizontal?0:14)),y:fmt((chosen.a.y+chosen.b.y)/2+(horizontal?-12:4))};
}
function routeObstacles(diagram,sourceId,targetId,start,end,margin=14) {
  const bounds={left:Math.min(start.x,end.x)-180,right:Math.max(start.x,end.x)+180,top:Math.min(start.y,end.y)-180,bottom:Math.max(start.y,end.y)+180};
  const nodes=diagram.model.nodes.filter(node=>node.id!==sourceId&&node.id!==targetId).map(node=>diagram.view.nodes[node.id]).filter(r=>r&&r.x+r.w>=bounds.left&&r.x<=bounds.right&&r.y+r.h>=bounds.top&&r.y<=bounds.bottom).map(r=>({x:r.x-margin,y:r.y-margin,w:r.w+margin*2,h:r.h+margin*2}));
  const headers=diagram.model.partitions.map(item=>{const r=diagram.view.partitions[item.id];return r&&r.x+r.w>=bounds.left&&r.x<=bounds.right&&r.y+34>=bounds.top&&r.y<=bounds.bottom?{x:r.x,y:r.y,w:r.w,h:34}:null}).filter(Boolean);
  return [...nodes,...headers];
}
function intersects(a,b,r) {
  if(Math.abs(a.y-b.y)<.5)return a.y>r.y&&a.y<r.y+r.h&&Math.max(Math.min(a.x,b.x),r.x)<Math.min(Math.max(a.x,b.x),r.x+r.w);
  if(Math.abs(a.x-b.x)<.5)return a.x>r.x&&a.x<r.x+r.w&&Math.max(Math.min(a.y,b.y),r.y)<Math.min(Math.max(a.y,b.y),r.y+r.h);
  return true;
}
function routeCost(points,obstacles) {
  let length=0,bends=0,collisions=0,lastDirection='';
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],distance=Math.hypot(b.x-a.x,b.y-a.y),direction=Math.abs(a.x-b.x)>=Math.abs(a.y-b.y)?'h':'v';length+=distance;if(lastDirection&&direction!==lastDirection)bends++;lastDirection=direction;for(const obstacle of obstacles)if(intersects(a,b,obstacle))collisions++;}
  return length+bends*22+collisions*10000;
}
function automaticOrthogonalRoute(diagram,edge,start,end,sourceSide,targetSide,sourceId,targetId) {
  const stub=22,offset=(point,side)=>({x:point.x+(side==='right'?stub:side==='left'?-stub:0),y:point.y+(side==='bottom'?stub:side==='top'?-stub:0)}),first=offset(start,sourceSide),last=offset(end,targetSide),horizontal=['left','right'].includes(sourceSide)&&['left','right'].includes(targetSide),obstacles=routeObstacles(diagram,sourceId,targetId,start,end);
  const candidates=[];
  if(horizontal){
    const lo=Math.min(first.x,last.x),hi=Math.max(first.x,last.x),middle=(first.y+last.y)/2,channels=new Set([middle]);
    for(const r of obstacles)if(r.x<hi&&r.x+r.w>lo){channels.add(r.y-18);channels.add(r.y+r.h+18);}
    for(const y of channels)candidates.push([start,first,{x:first.x,y},{x:last.x,y},last,end]);
    candidates.push([start,first,last,end]);
  }else{
    const lo=Math.min(first.y,last.y),hi=Math.max(first.y,last.y),middle=(first.x+last.x)/2,channels=new Set([middle]);
    for(const r of obstacles)if(r.y<hi&&r.y+r.h>lo){channels.add(r.x-18);channels.add(r.x+r.w+18);}
    for(const x of channels)candidates.push([start,first,{x,y:first.y},{x,y:last.y},last,end]);
    candidates.push([start,first,last,end]);
  }
  return candidates.sort((a,b)=>routeCost(a,obstacles)-routeCost(b,obstacles))[0];
}
function guardLabel(points) {
  for(let i=1;i<points.length-1;i++){
    const a=points[i],b=points[i+1];if(Math.hypot(b.x-a.x,b.y-a.y)<34)continue;
    const horizontal=Math.abs(b.x-a.x)>=Math.abs(b.y-a.y);
    return{x:fmt((a.x+b.x)/2+(horizontal?0:16)),y:fmt((a.y+b.y)/2+(horizontal?-13:0))};
  }
  return longestSegmentLabel(points);
}
export function edgeGeometry(diagram,edge) {
  const a=rectOf(diagram,edge.sourceId),b=rectOf(diagram,edge.targetId);if(!a||!b)return null;
  const ac={x:a.x+a.w/2,y:a.y+a.h/2},bc={x:b.x+b.w/2,y:b.y+b.h/2};
  const view=diagram.view.edges[edge.id]||{style:'orthogonal',points:[]};
  const points=Array.isArray(view.points)?view.points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)):[];
  const sourceSide=sideToward(a,points[0]||bc),targetSide=sideToward(b,points.at(-1)||ac);
  const sourceKind=diagram.model.nodes.find(n=>n.id===edge.sourceId)?.kind,targetKind=diagram.model.nodes.find(n=>n.id===edge.targetId)?.kind;
  const actualStart=boundary(a,points[0]||bc,sourceKind,sourceSide),actualEnd=boundary(b,points.at(-1)||ac,targetKind,targetSide);
  if(view.style==='curve'&&!points.length){const dx=actualEnd.x-actualStart.x,dy=actualEnd.y-actualStart.y,len=Math.hypot(dx,dy)||1,sign=String(edge.id).charCodeAt(0)%2?1:-1,cx=fmt((actualStart.x+actualEnd.x)/2-dy/len*54*sign),cy=fmt((actualStart.y+actualEnd.y)/2+dx/len*54*sign);return{d:`M ${actualStart.x} ${actualStart.y} Q ${cx} ${cy} ${actualEnd.x} ${actualEnd.y}`,start:actualStart,end:actualEnd,points:[actualStart,{x:cx,y:cy},actualEnd],label:{x:fmt((actualStart.x+2*cx+actualEnd.x)/4),y:fmt((actualStart.y+2*cy+actualEnd.y)/4-12)}};}
  if(view.style==='straight'&&!points.length){return{d:`M ${actualStart.x} ${actualStart.y} L ${actualEnd.x} ${actualEnd.y}`,start:actualStart,end:actualEnd,points:[actualStart,actualEnd],label:longestSegmentLabel([actualStart,actualEnd])};}
  let route;
  if(points.length)route=[actualStart,...points,actualEnd];
  else {
    if(view.style==='automatic')route=automaticOrthogonalRoute(diagram,edge,actualStart,actualEnd,sourceSide,targetSide,edge.sourceId,edge.targetId);
    else {
    const horizontal=['left','right'].includes(sourceSide)&&['left','right'].includes(targetSide),stub=24;
    const offset=(point,side)=>({x:point.x+(side==='right'?stub:side==='left'?-stub:0),y:point.y+(side==='bottom'?stub:side==='top'?-stub:0)});
    const first=offset(actualStart,sourceSide),last=offset(actualEnd,targetSide);
    if(horizontal){const mid=fmt((first.x+last.x)/2);route=[actualStart,first,{x:mid,y:first.y},{x:mid,y:last.y},last,actualEnd];}
    else{const mid=fmt((first.y+last.y)/2);route=[actualStart,first,{x:first.x,y:mid},{x:last.x,y:mid},last,actualEnd];}
    }
  }
  return{d:roundedPolyline(route),start:actualStart,end:actualEnd,points:route,label:edge.guard?guardLabel(route):longestSegmentLabel(route)};
}
function svgNode(node,view) {
  const def=NODE_REGISTRY[node.kind],label=xml(node.name),x=view.x,y=view.y,w=view.w,h=view.h,cx=x+w/2,cy=y+h/2;
  const base='fill="var(--node-fill,#fff)" stroke="var(--node-stroke,#65748a)" stroke-width="2"';
  let shape='';
  switch(def.shape) {
    case 'initial':shape=`<circle cx="${cx}" cy="${cy}" r="14" fill="#27364a"/>`;break;
    case 'activity-final':shape=`<circle cx="${cx}" cy="${cy}" r="16" ${base}/><circle cx="${cx}" cy="${cy}" r="9" fill="#27364a"/>`;break;
    case 'flow-final':shape=`<circle cx="${cx}" cy="${cy}" r="16" ${base}/><path d="M ${cx-7} ${cy-7} L ${cx+7} ${cy+7} M ${cx+7} ${cy-7} L ${cx-7} ${cy+7}" stroke="#27364a" stroke-width="2"/>`;break;
    case 'diamond':shape=`<polygon points="${cx},${y} ${x+w},${cy} ${cx},${y+h} ${x},${cy}" ${base}/>`;break;
    case 'bar':{const vertical=node.properties?.orientation==='vertical';shape=vertical?`<rect x="${cx-7}" y="${y}" width="14" height="${h}" rx="3" fill="#27364a"/>`:`<rect x="${x}" y="${cy-7}" width="${w}" height="14" rx="3" fill="#27364a"/>`;break;}
    case 'pin':shape=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" ${base}/>`;break;
    case 'store':shape=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" ${base}/><path d="M ${x+7} ${y+7} V ${y+h-7} M ${x+w-7} ${y+7} V ${y+h-7}" stroke="#65748a"/>`;break;
    case 'buffer':shape=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" ${base}/><text x="${x+8}" y="${y+16}" class="small">«centralBuffer»</text>`;break;
    case 'container':case 'interruptible':shape=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#f5f7fb" stroke="#8da0be" stroke-width="2" ${def.shape==='interruptible'?'stroke-dasharray="8 5"':''}/><text x="${x+10}" y="${y+23}" class="small">${xml(def.label)}</text>`;break;
    case 'note':shape=`<path d="M ${x} ${y} H ${x+w-15} L ${x+w} ${y+15} V ${y+h} H ${x} Z" fill="#fff8dd" stroke="#bdad78"/><path d="M ${x+w-15} ${y} V ${y+15} H ${x+w}" fill="none" stroke="#bdad78"/>`;break;
    case 'event':case 'event-time':shape=`<path d="M ${x+10} ${y} H ${x+w-10} L ${x+w} ${cy} L ${x+w-10} ${y+h} H ${x+10} L ${x} ${cy} Z" ${base}/>`;break;
    case 'signal':shape=`<polygon points="${x},${y} ${x+w-18},${y} ${x+w},${cy} ${x+w-18},${y+h} ${x},${y+h}" ${base}/>`;break;
    default:shape=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" ${base}/>`;
  }
  if(['initial','activityFinal','flowFinal','fork','join'].includes(node.kind)){const vertical=['fork','join'].includes(node.kind)&&node.properties?.orientation==='vertical',barLabel=vertical?`<text x="${cx+13}" y="${cy}" dominant-baseline="middle" class="small">${label}</text>`:`<text x="${cx}" y="${cy-12}" text-anchor="middle" class="small">${label}</text>`;return `<g data-id="${xml(node.id)}">${shape}${['fork','join'].includes(node.kind)?barLabel:''}</g>`;}
  const textY=CONTAINER_KINDS.has(node.kind)?y+46:cy+4;
  const stereo=(node.stereotypes||[]).length?`<text x="${cx}" y="${textY-16}" text-anchor="middle" class="small">«${xml(node.stereotypes[0].name||'stereotype')}»</text>`:'';
  return `<g data-id="${xml(node.id)}">${shape}${stereo}<text x="${cx}" y="${textY}" text-anchor="middle" class="label">${label}</text></g>`;
}
export function diagramSvg(diagram,{padding=60}={}) {
  const rects=[...Object.values(diagram.view.nodes),...Object.values(diagram.view.partitions)];
  const width=Math.max(1000,...rects.map(r=>r.x+r.w+padding));const height=Math.max(700,...rects.map(r=>r.y+r.h+padding));
  const partitions=diagram.model.partitions.map(partition=>{const r=diagram.view.partitions[partition.id];return r?`<g><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10" fill="#f4f7fb" stroke="#a5b5c9" stroke-width="2"/><text x="${r.x+12}" y="${r.y+24}" class="small">${xml(partition.name)}</text></g>`:''}).join('');
  const edges=diagram.model.edges.map(edge=>{const route=edgeGeometry(diagram,edge);if(!route)return '';const guard=edge.guard?`${edge.guard} `:'';const weight=edge.weight!==1?`{weight=${edge.weight}}`:'';const label=`${guard}${weight}`.trim(),labelWidth=Math.max(38,label.length*7+18);return `<g><path d="${route.d}" fill="none" stroke="${edge.kind==='object'?'#278999':'#71809a'}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#${edge.kind==='object'?'objectArrow':'controlArrow'})"/>${label?`<g><rect x="${route.label.x-labelWidth/2}" y="${route.label.y-11.5}" width="${labelWidth}" height="23" rx="11.5" fill="#fff" stroke="#dce3ec"/><text x="${route.label.x}" y="${route.label.y}" text-anchor="middle" dominant-baseline="middle" class="small">${xml(label)}</text></g>`:''}</g>`;}).join('');
  const nodes=diagram.model.nodes.map(node=>{const view=diagram.view.nodes[node.id];return view?svgNode(node,view):''}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(diagram.name)}"><defs><marker id="controlArrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#71809a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker><marker id="objectArrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#278999" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker><style>.label{font:600 13px system-ui,sans-serif;fill:#24344b}.small{font:700 11px system-ui,sans-serif;fill:#33445c}</style></defs><rect width="100%" height="100%" fill="#fff"/>${partitions}${edges}${nodes}</svg>`;
}
export function downloadBlob(name,blob) {const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function downloadText(name,text,type='text/plain') {downloadBlob(name,new Blob([text],{type}));}
export async function rasterCanvas(svg,scale=2) {
  const blob=new Blob([svg],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),img=new Image();
  try {await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const canvas=document.createElement('canvas');canvas.width=Math.min(12000,img.width*scale);canvas.height=Math.min(12000,img.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);return canvas;} finally {URL.revokeObjectURL(url);}
}
export async function exportPng(diagram,name) {const canvas=await rasterCanvas(diagramSvg(diagram));const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG indisponível.');downloadBlob(name,blob);}
const bytes=value=>new TextEncoder().encode(value);
function concat(parts) {const length=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(length);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;}
export async function exportPdf(diagram,name) {
  const canvas=await rasterCanvas(diagramSvg(diagram),1),data=atob(canvas.toDataURL('image/jpeg',.9).split(',')[1]);
  const image=Uint8Array.from(data,c=>c.charCodeAt(0)),w=canvas.width,h=canvas.height,parts=[bytes('%PDF-1.4\n')],offsets=[0];
  const object=(id,content)=>{offsets[id]=parts.reduce((n,p)=>n+p.length,0);parts.push(bytes(`${id} 0 obj\n`),...(Array.isArray(content)?content:[bytes(content)]),bytes('\nendobj\n'));};
  object(1,'<< /Type /Catalog /Pages 2 0 R >>');object(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  object(4,[bytes(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`),image,bytes('\nendstream')]);
  const stream=bytes(`q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`);object(5,[bytes(`<< /Length ${stream.length} >>\nstream\n`),stream,bytes('endstream')]);
  const xref=parts.reduce((n,p)=>n+p.length,0);parts.push(bytes('xref\n0 6\n0000000000 65535 f \n'));
  for(let i=1;i<=5;i++)parts.push(bytes(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`));
  parts.push(bytes(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));
  downloadBlob(name,new Blob([concat(parts)],{type:'application/pdf'}));
}
export function plantUmlSubset(diagram) {
  const nodes=diagram.model.nodes,edges=diagram.model.edges;
  if(nodes.some(n=>!['initial','activityFinal','flowFinal','action','opaqueAction','callBehavior','callOperation'].includes(n.kind))||edges.some(e=>e.kind!=='control'||e.guard||e.weight!==1)) throw new Error('PlantUML disponível somente para fluxos lineares com Initial, Action, Call Action e Final.');
  const first=nodes.find(n=>n.kind==='initial');if(!first)throw new Error('Adicione um Initial Node para exportar PlantUML.');
  const lines=['@startuml','start'],seen=new Set();let node=first;
  while(node) {
    if(seen.has(node.id))throw new Error('Ciclos não fazem parte deste subconjunto PlantUML.');seen.add(node.id);
    if(['activityFinal','flowFinal'].includes(node.kind)){lines.push('stop');break;}
    if(node.kind!=='initial') lines.push(`:${node.name.replace(/[\n:;]/g,' ')};`);
    const next=edges.filter(e=>e.sourceId===node.id);if(next.length>1)throw new Error('Ramificações não fazem parte deste subconjunto PlantUML.');
    node=next.length?nodes.find(n=>n.id===next[0].targetId):null;
  }
  if(lines.at(-1)!=='stop')lines.push('stop');lines.push('@enduml');return lines.join('\n');
}
