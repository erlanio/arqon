export const iStarRelationships = {
  dependencyGoal: 'Dependência · objetivo', dependencyQuality: 'Dependência · qualidade',
  dependencyTask: 'Dependência · tarefa', dependencyResource: 'Dependência · recurso',
  refinementAnd: 'Refinamento AND', refinementOr: 'Refinamento OR',
  contributionMake: 'Contribuição · Make', contributionHelp: 'Contribuição · Help',
  contributionHurt: 'Contribuição · Hurt', contributionBreak: 'Contribuição · Break',
  qualification: 'Qualificação', neededBy: 'Needed-by', isA: 'Is-a', participatesIn: 'Participates-in'
};

export const iStarActorKinds = new Set(['istarBoundary', 'istarAgent', 'istarRole']);
export const iStarIntentionalKinds = new Set(['istarGoal', 'istarQuality', 'istarTask', 'istarResource']);
const intentionalKinds = new Set(['istarGoal', 'istarQuality', 'istarTask', 'istarResource']);
const relationshipKinds = new Set(Object.keys(iStarRelationships));

export function normalizeIStarDiagram(diagram) {
  if (diagram?.type !== 'istar') return diagram;
  diagram.istar ||= { version: '2.0', view: 'SR', stereotypes: [] };
  diagram.istar.version ||= '2.0';
  diagram.istar.view ||= 'SR';
  if (!Array.isArray(diagram.istar.stereotypes)) diagram.istar.stereotypes = [];
  for (const node of diagram.nodes || []) {
    if (node.kind.startsWith('istar')) {
      node.istar ||= {};
      if (intentionalKinds.has(node.kind)) node.istar.ownerId ??= null;
      node.istar.stereotypeId ??= null;
    }
  }
  return diagram;
}

export function validateIStarDiagram(diagram) {
  const issues = [];
  const nodes = new Map((diagram?.nodes || []).map(node => [node.id, node]));
  const add = (severity, elementId, message) => issues.push({ severity, code: `iStar.${severity}`, elementId, message });
  for (const node of nodes.values()) {
    if (intentionalKinds.has(node.kind) && (!node.istar?.ownerId || !nodes.has(node.istar.ownerId) || !iStarActorKinds.has(nodes.get(node.istar.ownerId).kind))) {
      add('warning', node.id, 'Elemento intencional sem ator proprietário / boundary.');
    }
    if (node.istar?.stereotypeId && !(diagram.istar?.stereotypes || []).some(item => item.id === node.istar.stereotypeId)) {
      add('error', node.id, 'O estereótipo aplicado não existe neste diagrama.');
    }
  }
  for (const edge of diagram?.edges || []) {
    const source = nodes.get(edge.from), target = nodes.get(edge.to);
    if (!source || !target) { add('error', edge.id, 'A relação aponta para um elemento inexistente.'); continue; }
    if (!relationshipKinds.has(edge.type)) { add('error', edge.id, 'Tipo de relação iStar desconhecido.'); continue; }
    if (intentionalKinds.has(source.kind) && intentionalKinds.has(target.kind) && source.istar?.ownerId !== target.istar?.ownerId) {
      add('error', edge.id, 'Relações intencionais devem permanecer dentro do mesmo ator. Use dependências entre atores.');
    }
    if (edge.type.startsWith('dependency')) {
      if (!iStarActorKinds.has(source.kind) || !iStarActorKinds.has(target.kind)) add('error', edge.id, 'Dependências devem ligar dois atores; o dependum é configurado nas propriedades.');
      if (!edge.dependum?.trim()) add('warning', edge.id, 'Defina o dependum (objetivo, qualidade, tarefa ou recurso) desta dependência.');
    } else if (edge.type.startsWith('refinement') || edge.type.startsWith('contribution')) {
      if (edge.type.startsWith('refinement') && (!['istarGoal', 'istarTask'].includes(source.kind) || !['istarGoal', 'istarTask'].includes(target.kind))) add('error', edge.id, 'Refinamento liga objetivo ou tarefa filho a objetivo ou tarefa pai.');
      if (edge.type.startsWith('contribution') && (!intentionalKinds.has(source.kind) || target.kind !== 'istarQuality')) add('error', edge.id, 'Contribuição deve apontar para uma qualidade.');
    } else if (edge.type === 'qualification' || edge.type === 'neededBy') {
      if (edge.type === 'qualification' && (source.kind !== 'istarQuality' || !['istarGoal', 'istarTask', 'istarResource'].includes(target.kind))) add('error', edge.id, 'Qualificação liga uma qualidade ao objetivo, tarefa ou recurso qualificado.');
      if (edge.type === 'neededBy' && (source.kind !== 'istarResource' || target.kind !== 'istarTask')) add('error', edge.id, 'Needed-by liga um recurso à tarefa que dele necessita.');
    } else if (edge.type === 'isA' || edge.type === 'participatesIn') {
      const actors = iStarActorKinds.has(source.kind) && iStarActorKinds.has(target.kind);
      if (!actors) add('error', edge.id, 'Is-a e Participates-in devem ligar atores, agentes ou papéis.');
      if (actors && edge.type === 'isA') {
        const actorType = node => node.istar?.actorType || ({istarBoundary:'actor', istarAgent:'agent', istarRole:'role'}[node.kind]);
        const fromType = actorType(source), toType = actorType(target);
        if (fromType === 'agent' || toType === 'agent' || fromType !== toType) add('error', edge.id, 'Is-a admite apenas papel → papel ou ator genérico → ator genérico.');
      }
    }
  }
  return issues;
}

// Import only inert vector drawing primitives. In particular, discard executable,
// external, event-handler and CSS URL content before it enters a project file.
export function sanitizeIStarSvg(source, DOMParserImpl = globalThis.DOMParser, XMLSerializerImpl = globalThis.XMLSerializer) {
  if (typeof source !== 'string' || source.length > 200_000) throw new Error('O SVG deve ter até 200 KB.');
  if (/<!\s*(DOCTYPE|ENTITY)/i.test(source)) throw new Error('SVGs com DTD ou entidades XML não são aceitos.');
  if (!DOMParserImpl || !XMLSerializerImpl) throw new Error('Este navegador não oferece suporte à leitura segura de SVG.');
  const document = new DOMParserImpl().parseFromString(source, 'image/svg+xml');
  const root = document.documentElement;
  if (root.localName !== 'svg' || document.querySelector('parsererror')) throw new Error('Selecione um arquivo SVG válido.');
  const allowedTags = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
  const allowedAttrs = new Set(['viewBox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity', 'transform']);
  for (const element of [...root.querySelectorAll('*')].reverse()) {
    if (!allowedTags.has(element.localName)) { element.remove(); continue; }
    for (const attribute of [...element.attributes]) {
      const value = attribute.value;
      if (!allowedAttrs.has(attribute.name) || /url\s*\(|javascript:|data:|https?:|\/\//i.test(value)) element.removeAttribute(attribute.name);
    }
  }
  for (const attribute of [...root.attributes]) if (!allowedAttrs.has(attribute.name)) root.removeAttribute(attribute.name);
  if (!root.hasAttribute('viewBox')) {
    const width = Number.parseFloat(root.getAttribute('width')) || 100;
    const height = Number.parseFloat(root.getAttribute('height')) || 100;
    root.setAttribute('viewBox', `0 0 ${Math.min(1000, width)} ${Math.min(1000, height)}`);
  }
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new XMLSerializerImpl().serializeToString(root);
}
