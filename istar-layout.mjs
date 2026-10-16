import {iStarActorKinds, iStarIntentionalKinds} from './istar-model.mjs';
const TOP_PADDING=16;
export const isIStarActor = node => !!node && iStarActorKinds.has(node.kind);
export const isIStarElement = node => !!node && iStarIntentionalKinds.has(node.kind);
export const actorCollapsed = (diagram,node) => node.istar?.collapsed ?? diagram.istar?.view === 'SD';
export function iStarVisibleNodes(diagram) {
  const byId=new Map(diagram.nodes.map(n=>[n.id,n]));
  return diagram.nodes.filter(n=>!n.istar?.ownerId || !actorCollapsed(diagram,byId.get(n.istar.ownerId)||{}));
}
function fitIStarActor(diagram,actor) {
  actor.istar||={};
  actor.istar.layoutOrigin||={x:actor.x,y:actor.y};
  const origin=actor.istar.layoutOrigin;
  const children=diagram.nodes.filter(n=>n.istar?.ownerId===actor.id);
  if(!children.length){actor.width=300;actor.height=220;return;}
  // Bounds belong to the current contents, never to previous drag positions.
  for(const child of children){child.x=Math.max(32,child.x);child.y=Math.max(TOP_PADDING,child.y);}
  actor.x=Math.max(0,Math.min(origin.x,Math.min(...children.map(n=>n.x))-32));
  actor.y=Math.max(0,Math.min(origin.y,Math.min(...children.map(n=>n.y))-TOP_PADDING));
  actor.width=Math.max(300,Math.max(...children.map(n=>n.x+170))+32-actor.x);
  actor.height=Math.max(220,Math.max(...children.map(n=>n.y+60))+32-actor.y);
}
export function fitIStarActors(diagram) {
  for(const actor of diagram.nodes.filter(isIStarActor))fitIStarActor(diagram,actor);
}
export function placeIStarElement(diagram,node,ownerId=null) {
  if(!isIStarElement(node))return;
  const actors=diagram.nodes.filter(n=>isIStarActor(n)&&!actorCollapsed(diagram,n));
  const owner=ownerId?diagram.nodes.find(n=>n.id===ownerId&&isIStarActor(n)):[...actors].reverse().find(a=>node.x+85>=a.x&&node.x+85<=a.x+a.width&&node.y+30>=a.y&&node.y+30<=a.y+a.height);
  if(!owner)return;
  node.istar||={};node.istar.ownerId=owner.id;owner.istar||={};owner.istar.collapsed=false;
  node.x=Math.max(owner.x+32,node.x);node.y=Math.max(owner.y+TOP_PADDING,node.y);
  const siblings=diagram.nodes.filter(n=>n.id!==node.id&&n.istar?.ownerId===owner.id);
  while(siblings.some(n=>Math.abs(n.x-node.x)<184&&Math.abs(n.y-node.y)<74))node.y+=80;
  fitIStarActors(diagram);
}
export function clampIStarElement(diagram,node) {
  const owner=diagram.nodes.find(a=>a.id===node.istar?.ownerId&&isIStarActor(a));
  if(!owner)return;
  node.x=Math.max(owner.x+32,Math.min(node.x,owner.x+owner.width-202));
  node.y=Math.max(owner.y+TOP_PADDING,Math.min(node.y,owner.y+owner.height-92));
}

// Recompute all four edges on each drag, preserving ownership and sibling positions.
export function resizeIStarOwner(diagram,node) {
  const owner=diagram.nodes.find(a=>a.id===node.istar?.ownerId&&isIStarActor(a));
  if(owner)fitIStarActor(diagram,owner);
}
