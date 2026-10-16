import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {layoutConceptualDiagram,layoutLogicalDiagram} from '../data-layout.mjs';

const example=file=>JSON.parse(readFileSync(new URL(`../${file}`,import.meta.url))).diagrams[0];
const size=(node,sizes)=>sizes.get(node.id)||{w:node.kind==='relationship'?110:180,h:node.kind==='attribute'?60:80};
function assertNoOverlap(diagram,positions,sizes=new Map()){
  for(let i=0;i<diagram.nodes.length;i++)for(let j=i+1;j<diagram.nodes.length;j++){
    const a=diagram.nodes[i],b=diagram.nodes[j],pa=positions.get(a.id),pb=positions.get(b.id),sa=size(a,sizes),sb=size(b,sizes);
    assert.ok(pa&&pb,`Missing position for ${a.title} or ${b.title}`);
    assert.ok(!(pa.x<pb.x+sb.w&&pa.x+sa.w>pb.x&&pa.y<pb.y+sb.h&&pa.y+sa.h>pb.y),`${a.title} overlaps ${b.title}`);
  }
}

test('conceptual layout keeps relationships between their participants without overlaps',()=>{
  const diagram=example('exemplo-modelo-conceitual-ecommerce.json'),original=JSON.stringify(diagram),positions=layoutConceptualDiagram(diagram);
  assert.equal(positions.size,diagram.nodes.length);assertNoOverlap(diagram,positions);assert.equal(JSON.stringify(diagram),original);
  for(const relation of diagram.nodes.filter(node=>node.kind==='relationship')){
    const participants=diagram.edges.filter(edge=>edge.from===relation.id||edge.to===relation.id).map(edge=>diagram.nodes.find(node=>node.id===(edge.from===relation.id?edge.to:edge.from))).filter(node=>['entity','associative'].includes(node?.kind));
    if(participants.length===2){const x=positions.get(relation.id).x;assert.ok(x>Math.min(...participants.map(node=>positions.get(node.id).x)));assert.ok(x<Math.max(...participants.map(node=>positions.get(node.id).x)));}
  }
});

test('logical layout respects foreign-key layers and tall rendered tables',()=>{
  const diagram=example('exemplo-modelo-logico-ecommerce.json'),original=JSON.stringify(diagram),sizes=new Map(diagram.nodes.map((node,index)=>[node.id,{w:220+index*13,h:160+index*40}])),positions=layoutLogicalDiagram(diagram,sizes);
  assert.equal(positions.size,diagram.nodes.length);assertNoOverlap(diagram,positions,sizes);assert.equal(JSON.stringify(diagram),original);
  for(const edge of diagram.edges)assert.ok(positions.get(edge.from).x>positions.get(edge.to).x,`${edge.from} should follow ${edge.to}`);
});

test('logical layout places dependencies after cycles and the deepest parent',()=>{
  const nodes=['a','b','c','d','e'].map(id=>({id,kind:'table',title:id,x:50,y:50}));
  const diagram={nodes,edges:[{from:'a',to:'b'},{from:'b',to:'a'},{from:'c',to:'a'},{from:'d',to:'c'},{from:'d',to:'e'},{from:'e',to:'b'}]};
  const positions=layoutLogicalDiagram(diagram);assertNoOverlap(diagram,positions);
  assert.equal(positions.get('a').x,positions.get('b').x);
  assert.ok(positions.get('c').x>positions.get('a').x);
  assert.ok(positions.get('d').x>positions.get('c').x&&positions.get('d').x>positions.get('e').x);
});

test('logical layout reads table foreign keys even without a drawn edge',()=>{
  const diagram={nodes:[{id:'child',kind:'table',title:'Filho',fields:[{references:{tableId:'parent'}}]},{id:'parent',kind:'table',title:'Pai',fields:[]}],edges:[]};
  const positions=layoutLogicalDiagram(diagram);assert.ok(positions.get('child').x>positions.get('parent').x);
});
