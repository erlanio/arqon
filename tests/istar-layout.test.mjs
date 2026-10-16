import test from 'node:test';
import assert from 'node:assert/strict';
import {placeIStarElement,clampIStarElement,iStarVisibleNodes,fitIStarActors,resizeIStarOwner} from '../istar-layout.mjs';
import {validateIStarDiagram} from '../istar-model.mjs';
const actor=(id,x=0)=>({id,kind:'istarBoundary',x,y:0,width:300,height:220,istar:{collapsed:false}});
const goal=(id,x,y)=>({id,kind:'istarGoal',x,y,istar:{ownerId:null}});
test('drop assigns ownership, avoids overlap and expands the boundary',()=>{
 const a=actor('a'),g=goal('g',200,180),d={nodes:[a,g],edges:[]};
 placeIStarElement(d,g);
 assert.equal(g.istar.ownerId,'a');assert.ok(a.x+a.width>=g.x+202);assert.ok(a.y+a.height>=g.y+92);
 const h=goal('h',200,180);d.nodes.push(h);placeIStarElement(d,h);
 assert.equal(h.istar.ownerId,'a');assert.ok(h.y>=g.y+74);assert.ok(a.y+a.height>=h.y+92);
});
test('children stay inside their owner when dragged toward a different actor',()=>{
 const a=actor('a'),b=actor('b',600),g=goal('g',40,128),d={nodes:[a,b,g]};
 placeIStarElement(d,g,'a');g.x=650;g.y=-500;clampIStarElement(d,g);
 assert.equal(g.istar.ownerId,'a');assert.equal(g.x,a.x+a.width-202);assert.equal(g.y,a.y+16);
});
test('hybrid visibility preserves hidden children and expanded actor sizes',()=>{
 const a=actor('a'),b=actor('b',600),g=goal('g',40,128),h=goal('h',640,128),d={istar:{view:'SR'},nodes:[a,b,g,h]};
 placeIStarElement(d,g,'a');placeIStarElement(d,h,'b');fitIStarActors(d);
 const before=JSON.stringify(g),width=a.width;a.istar.collapsed=true;
 assert.deepEqual(iStarVisibleNodes(d).map(n=>n.id),['a','b','h']);assert.equal(JSON.stringify(g),before);
 a.istar.collapsed=false;assert.equal(iStarVisibleNodes(d).length,4);assert.equal(a.width,width);
});
test('intentional links cannot cross actor ownership boundaries',()=>{
 const a=actor('a'),b=actor('b',600),g=goal('g',40,128),h=goal('h',640,128),d={nodes:[a,b,g,h],edges:[{id:'edge',from:'g',to:'h',type:'refinementOr'}]};
 placeIStarElement(d,g,'a');placeIStarElement(d,h,'b');
 assert.ok(validateIStarDiagram(d).some(i=>i.elementId==='edge'&&i.severity==='error'));
});

test('dragging refits all four actor edges without moving siblings',()=>{
 const a=actor('a',200);a.y=200;
 const g=goal('g',240,328),sibling=goal('s',440,400),d={nodes:[a,g,sibling]};
 placeIStarElement(d,g,'a');placeIStarElement(d,sibling,'a');
 const siblingPosition={x:sibling.x,y:sibling.y};
 g.x=1000;g.y=900;resizeIStarOwner(d,g);
 assert.equal(g.istar.ownerId,'a');assert.ok(a.x+a.width>=g.x+202);assert.ok(a.y+a.height>=g.y+92);
 const right=a.x+a.width,bottom=a.y+a.height;
 g.x=100;g.y=160;resizeIStarOwner(d,g);
 assert.equal(a.x,68);assert.equal(a.y,144);assert.ok(a.x+a.width<right);assert.ok(a.y+a.height<bottom);
 assert.deepEqual({x:sibling.x,y:sibling.y},siblingPosition);
});

test('moving outer elements inward shrinks the boundary and retains its minimum size',()=>{
 const a=actor('a'),g=goal('g',40,128),h=goal('h',900,700),d={nodes:[a,g,h]};
 placeIStarElement(d,g,'a');placeIStarElement(d,h,'a');
 const large={width:a.width,height:a.height};
 h.x=250;h.y=250;resizeIStarOwner(d,h);
 assert.ok(a.width<large.width);assert.ok(a.height<large.height);
 const left=a.x,top=a.y;
 g.x=260;g.y=250;resizeIStarOwner(d,g);
 assert.equal(a.x,left);assert.equal(a.y,top);
 assert.ok(a.width>=300);assert.ok(a.height>=220);
 const bounds={x:a.x,y:a.y,width:a.width,height:a.height};
 fitIStarActors(d);assert.deepEqual({x:a.x,y:a.y,width:a.width,height:a.height},bounds);
 assert.equal(g.istar.ownerId,'a');assert.equal(h.istar.ownerId,'a');
});

test('internal movement changes the child position relative to the actor header',()=>{
 const a=actor('a',200);a.y=200;
 const g=goal('g',240,340),d={nodes:[a,g]};placeIStarElement(d,g,'a');
 const before={x:a.x,y:a.y};g.x+=100;g.y+=80;resizeIStarOwner(d,g);
 assert.equal(a.x,before.x);assert.equal(a.y,before.y);
 assert.equal(g.x-a.x,140);assert.equal(g.y-a.y,220);
 g.x=100;g.y=160;resizeIStarOwner(d,g);assert.ok(a.x<before.x);assert.ok(a.y<before.y);
 g.x=240;g.y=340;resizeIStarOwner(d,g);assert.equal(a.x,before.x);assert.equal(a.y,before.y);
});

test('child can reach the upper interior edge without pushing the actor upward',()=>{
 const a=actor('a',200);a.y=200;
 const g=goal('g',400,340),d={nodes:[a,g]};placeIStarElement(d,g,'a');
 g.y=216;resizeIStarOwner(d,g);
 assert.equal(g.y,216);assert.equal(a.y,200);assert.equal(g.istar.ownerId,'a');
 fitIStarActors(d);assert.equal(g.y,216);assert.equal(a.y,200);
 g.y=180;resizeIStarOwner(d,g);assert.equal(a.y,164);assert.equal(g.y-a.y,16);
});
