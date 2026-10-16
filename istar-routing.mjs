export function iStarCurveControl(a,b) {
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
  const bend=Math.min(80,Math.max(24,length*.16));
  return {x:(a.x+b.x)/2-dy/length*bend,y:(a.y+b.y)/2+dx/length*bend};
}
export function iStarCurvePoint(a,c,b,t) {
  const u=1-t,dx=2*(u*(c.x-a.x)+t*(b.x-c.x)),dy=2*(u*(c.y-a.y)+t*(b.y-c.y));
  const length=Math.hypot(dx,dy)||1;
  return {x:u*u*a.x+2*u*t*c.x+t*t*b.x,y:u*u*a.y+2*u*t*c.y+t*t*b.y,dx:dx/length,dy:dy/length};
}

export function iStarEditableRoute(route,source,target) {
  const corners=route.corners||[],curves={...(route.curves||{})};
  if(!corners.length&&!Object.keys(curves).length)curves[0]=iStarCurveControl(source.center,target.center);
  const start=source.anchor(curves[0]||corners[0]||target.center);
  const end=target.anchor(curves[corners.length]||corners.at(-1)||source.center);
  const points=[start,...corners,end],segments=[];
  let path=`M ${start.x} ${start.y}`;
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1],control=curves[i]||null;
    segments.push({a,b,control});path+=control?` Q ${control.x} ${control.y} ${b.x} ${b.y}`:` L ${b.x} ${b.y}`;
  }
  return {path,segments,label:iStarRoutePoint(segments,.5)};
}
export function iStarRoutePoint(segments,t) {
  const index=Math.min(segments.length-1,Math.floor(t*segments.length));
  const {a,b,control}=segments[index];
  return iStarCurvePoint(a,control||{x:(a.x+b.x)/2,y:(a.y+b.y)/2},b,t*segments.length-index);
}

// Measure backwards along the route so marker spacing also follows curves/corners.
export function iStarEndMarker(segments,distance=18) {
  const samples=[];let total=0;
  for(const segment of segments){
    const control=segment.control||{x:(segment.a.x+segment.b.x)/2,y:(segment.a.y+segment.b.y)/2};
    const steps=segment.control?32:1;
    let previous=iStarCurvePoint(segment.a,control,segment.b,0);
    for(let step=1;step<=steps;step++){
      const point=iStarCurvePoint(segment.a,control,segment.b,step/steps),length=Math.hypot(point.x-previous.x,point.y-previous.y);
      samples.push({segment,control,t0:(step-1)/steps,t1:step/steps,length});total+=length;previous=point;
    }
  }
  let remaining=Math.min(distance,total*.4);
  for(const sample of samples.reverse()){
    if(remaining<=sample.length){const t=sample.t1-(sample.t1-sample.t0)*(remaining/(sample.length||1));return iStarCurvePoint(sample.segment.a,sample.control,sample.segment.b,t);}
    remaining-=sample.length;
  }
  return iStarRoutePoint(segments,1);
}

export function iStarOpenArrow(marker,length=22,halfWidth=11) {
  const bx=marker.x-marker.dx*length,by=marker.y-marker.dy*length;
  return `M ${bx-marker.dy*halfWidth} ${by+marker.dx*halfWidth} L ${marker.x} ${marker.y} L ${bx+marker.dy*halfWidth} ${by-marker.dx*halfWidth}`;
}
