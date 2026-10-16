import test from 'node:test';
import assert from 'node:assert/strict';
import {iStarCurveControl,iStarCurvePoint} from '../istar-routing.mjs';
test('curved route updates with moved endpoints and keeps endpoint positions',()=>{
 const a={x:50,y:80},b={x:400,y:80},c=iStarCurveControl(a,b);
 assert.ok(c.y>80);
 assert.equal(iStarCurvePoint(a,c,b,0).x,a.x);
 assert.equal(iStarCurvePoint(a,c,b,1).x,b.x);
 const moved={x:70,y:500},next=iStarCurveControl(a,moved);
 assert.notDeepEqual(next,c);
 const end=iStarCurvePoint(a,next,moved,1);
 assert.equal(end.x,moved.x);assert.equal(end.y,moved.y);
 assert.ok(Math.abs(Math.hypot(end.dx,end.dy)-1)<1e-10);
});
test('vertical and coincident endpoints keep finite geometry',()=>{
 for(const b of [{x:0,y:200},{x:0,y:0}]){
  const a={x:0,y:0},c=iStarCurveControl(a,b);
  for(const t of [0,.25,.5,.75,1])assert.ok(Object.values(iStarCurvePoint(a,c,b,t)).every(Number.isFinite));
 }
});

test('manual corners and curves survive serialization and moving connected actors',async()=>{
 const {iStarEditableRoute,iStarRoutePoint}=await import('../istar-routing.mjs');
 const symbol=(x,y)=>({center:{x,y},anchor(t){const dx=t.x-x,dy=t.y-y,l=Math.hypot(dx,dy)||1;return{x:x+dx/l*50,y:y+dy/l*50};}});
 const route=JSON.parse(JSON.stringify({corners:[{x:200,y:180}],curves:{1:{x:350,y:240}}}));
 const a=symbol(0,0),b=symbol(500,0),first=iStarEditableRoute(route,a,b);
 assert.equal(first.segments.length,2);assert.equal(first.segments[0].control,null);
 assert.deepEqual(first.segments[0].b,route.corners[0]);assert.deepEqual(first.segments[1].control,route.curves[1]);
 const moved=iStarEditableRoute(route,symbol(80,40),b);
 assert.notDeepEqual(moved.segments[0].a,first.segments[0].a);
 assert.deepEqual(moved.segments[0].b,first.segments[0].b);
 assert.ok(Math.abs(Math.hypot(moved.segments[0].a.x-80,moved.segments[0].a.y-40)-50)<1e-9);
 assert.deepEqual(iStarRoutePoint(moved.segments,1).x,moved.segments.at(-1).b.x);
 const reset=iStarEditableRoute({corners:[],curves:{}},a,b);
 assert.equal(reset.segments.length,1);assert.ok(reset.segments[0].control);
});

test('destination markers have spacing along straight, curved and cornered routes',async()=>{
 const {iStarEndMarker}=await import('../istar-routing.mjs');
 const segment={a:{x:0,y:0},b:{x:100,y:0},control:null};
 assert.equal(iStarEndMarker([segment]).x,82);
 const cornered=[segment,{a:{x:100,y:0},b:{x:100,y:10},control:null}];
 assert.equal(iStarEndMarker(cornered).x,92);
 const curved={...segment,control:{x:50,y:70}};
 const marker=iStarEndMarker([curved]);assert.ok(marker.x<100);assert.ok(marker.y>0);
 assert.ok(Math.abs(Math.hypot(marker.dx,marker.dy)-1)<1e-10);
 const short=iStarEndMarker([{a:{x:0,y:0},b:{x:10,y:0},control:null}]);
 assert.equal(short.x,6);
});
