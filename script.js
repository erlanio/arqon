import {iStarCurvePoint,iStarEditableRoute,iStarRoutePoint,iStarEndMarker,iStarOpenArrow} from './istar-routing.mjs';
import {isIStarActor, isIStarElement, actorCollapsed, iStarVisibleNodes, fitIStarActors, placeIStarElement, clampIStarElement, resizeIStarOwner} from './istar-layout.mjs';
import { analyzeNormalization, dataDictionaryCsv, generateLogicalSql, importLogicalDiagramFromDdl, validateLogicalDiagram } from './logical-model.mjs?v=logical-ddl-fix-1';
import { normalizeConceptualDiagram, materializeConceptualAttributeNodes, validateConceptualDiagram, convertConceptualToLogical, conceptualDictionaryCsv } from './conceptual-model.mjs';
import {saveDocument as saveStoredDocument, getDocument as getStoredDocument, listDocuments as listStoredDocuments, deleteDocument as deleteStoredDocument} from './document-store.mjs';
import {validateUseCaseDiagram, useCaseRelationshipLabel, layoutUseCaseDiagram} from './use-case-model.mjs';
import {iStarRelationships, normalizeIStarDiagram, sanitizeIStarSvg, validateIStarDiagram} from './istar-model.mjs';
import {flowNextOptions, initialFlowNode, validateFlowDiagram} from './flow-model.mjs';
import {parseProject as parseActivityProject} from './uml-activity/model.mjs';
import {desktopRuntime} from './desktop-bridge.mjs';

const $ = (selector) => document.querySelector(selector);
const STORAGE_KEY = 'brmodelo-studio-v1';
const PROJECTS_KEY = 'brmodelo-studio-projects-v1';
const THEME_KEY = 'brmodelo-studio-theme';
const OPEN_DOCUMENTS_KEY = 'brmodelo-studio-open-documents-v1';
const ACTIVE_TAB_KEY = 'brmodelo-studio-active-tab-v1';
const palettes = {
  conceitual: [
    ['entity', 'Entidade', '▣'], ['relationship', 'Relacionamento', '◇'], ['attribute', 'Atributo', '◯'], ['associative', 'Entidade associativa', '▧'], ['specialization', 'Especialização ISA', '△'], ['note', 'Anotação', '▤']
  ],
  logico: [['table', 'Tabela', '▤'], ['note', 'Anotação', '▤']],
  fluxo: [['start', 'Início', '◯'], ['end', 'Fim', '◉'], ['process', 'Processo', '▢'], ['decision', 'Decisão', '◇'], ['inputOutput', 'Entrada / saída', '▱'], ['subprocess', 'Subprocesso', '▤'], ['document', 'Documento', '▤'], ['documents', 'Múltiplos documentos', '▤'], ['database', 'Banco de dados', '▤'], ['connector', 'Conector', '○'], ['pageConnector', 'Conector de página', '⬟'], ['preparation', 'Preparação', '⬡'], ['manualInput', 'Entrada manual', '⏢'], ['display', 'Exibição', '▱'], ['delay', 'Atraso / espera', '◖'], ['note', 'Anotação', '▤']],
  livre: [['process', 'Retângulo', '▢'], ['decision', 'Losango', '◇'], ['start', 'Círculo', '◯'], ['note', 'Anotação', '▤']],
  usecase: [['actor', 'Ator', '♙'], ['useCase', 'Caso de uso', '⬭'], ['systemBoundary', 'Limite do sistema', '▱'], ['note', 'Anotação', '▤']],
  istar: [['istarBoundary', 'Ator', '◯'], ['istarAgent', 'Agente', '⊖'], ['istarRole', 'Papel', '◡'], ['istarGoal', 'Objetivo', '⬭'], ['istarQuality', 'Qualidade', '☁'], ['istarTask', 'Tarefa', '⬡'], ['istarResource', 'Recurso', '▭'], ['note', 'Anotação', '▤']]
};
const diagramKinds = {
  conceitual: ['Conceitual', '◈'], logico: ['Lógico', '▤'], fluxo: ['Fluxograma', '◇'], atividade: ['Modelagem de Atividades UML', '◉'], classes: ['Diagrama de Classes UML', '▦'], usecase: ['Casos de Uso UML', '◎'], sequencia: ['Diagrama de Sequência UML', '↔'], istar: ['iStar 2.0', '✳']
};
const diagramTabIcons = {
  conceitual: '<rect x="3" y="4" width="7" height="6" rx="1"/><path d="M10 7h4M14 7l2-2m-2 2 2 2"/><ellipse cx="18" cy="7" rx="2" ry="3"/>',
  logico: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M10 9v12M16 9v12"/>',
  fluxo: '<rect x="8" y="3" width="8" height="5" rx="1"/><path d="M12 8v3m0 0-4 4m4-4 4 4m-8 0v4h8v-4"/>',
  atividade: '<circle cx="5" cy="5" r="2" fill="currentColor"/><rect x="10" y="3" width="9" height="5" rx="2.5"/><path d="M7 5.5h3m4 2.5v4m0 0-4 4m4-4 4 4"/><circle cx="14" cy="18" r="2"/>',
  classes: '<rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M3 9h18M3 15h18"/>',
  usecase: '<rect x="3" y="3" width="18" height="18" rx="1.5"/><ellipse cx="12" cy="12" rx="6.5" ry="3.7"/><circle cx="5" cy="5" r="1" fill="currentColor"/>',
  sequencia: '<rect x="2" y="3" width="5" height="4" rx="1"/><rect x="17" y="3" width="5" height="4" rx="1"/><path d="M4.5 7v14M19.5 7v14M5 12h14M15 9l4 3-4 3" stroke-dasharray="2 2"/>',
  istar: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/>'
};
function diagramTabIcon(type) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${diagramTabIcons[type]||diagramTabIcons.fluxo}</svg>`; }
const labels = Object.fromEntries(Object.values(palettes).flat().map(([key, label]) => [key, label]));
Object.assign(labels,{actor:'Ator',useCase:'Caso de uso',systemBoundary:'Limite do sistema',inputOutput:'Entrada / saída',subprocess:'Subprocesso',document:'Documento',documents:'Múltiplos documentos',database:'Banco de dados',connector:'Conector',pageConnector:'Conector de página',preparation:'Preparação',manualInput:'Entrada manual',display:'Exibição',delay:'Atraso / espera'});
const flowElementDescriptions={start:'Inicia o fluxo do processo.',end:'Encerra o fluxo do processo.',process:'Representa uma etapa ou ação.',decision:'Divide o fluxo conforme uma condição.',inputOutput:'Representa leitura ou apresentação de dados.',subprocess:'Representa um processo definido em outro nível.',document:'Representa um documento produzido ou consumido.',documents:'Representa um conjunto de documentos.',database:'Representa armazenamento de dados.',connector:'Continua o fluxo em outro ponto do diagrama.',pageConnector:'Continua o fluxo em outra página ou seção.',preparation:'Representa uma etapa de inicialização ou preparação.',manualInput:'Representa dados digitados por uma pessoa.',display:'Representa saída apresentada em uma tela.',delay:'Representa uma espera ou atraso.'};
const columnTypes = ['VARCHAR', 'CHAR', 'TEXT', 'ENUM', 'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'BOOLEAN', 'DATE', 'TIME', 'DATETIME', 'TIMESTAMP', 'JSON', 'UUID', 'BLOB', 'VARBINARY'];
const sizedTypes = new Set(['CHAR', 'VARCHAR', 'TEXT']);
const tableColors = ['#31ad90', '#6359e9', '#3884d8', '#df8b4e', '#d76691', '#799347'];
let state = loadState();
const isLegacyExampleWorkspace = isBuiltInExampleWorkspace(state);
if(isLegacyExampleWorkspace){localStorage.removeItem(STORAGE_KEY);try{const projects=JSON.parse(localStorage.getItem(PROJECTS_KEY)||'{}');delete projects[state.id];if(Object.keys(projects).length)localStorage.setItem(PROJECTS_KEY,JSON.stringify(projects));else localStorage.removeItem(PROJECTS_KEY);}catch{localStorage.removeItem(PROJECTS_KEY)}state=initialState();}
const hadLegacyWorkspace = hasValidStoredWorkspace() && !isLegacyExampleWorkspace;
let firstRunDiagramPicker = !hadLegacyWorkspace && !hasSavedLocalWorkspace();
state.id ||= uid('project');state.openDiagramIds ||= state.diagrams.map(diagram=>diagram.id);
let activeActivity = null;
let activeClassDiagram = null;
let activeSequenceDiagram = null;
let selectedId = null;
let selectedEdge = null;
let selectedIds = new Set();
let tool = 'select';
let connectFrom = null;
let drag = null;
let zoom = 1;
let pan = {x: 55, y: 50};
let history = [];
let future = [];
let toastTimer;
let tablesAccordionOpen = true;
let expandedTables = new Set();
let paletteView = 'elements';
let paletteQuery = '';
let copiedElements = null;
let pasteCount = 0;
let spacePanActive = false;
let snapToGrid=localStorage.getItem('brmodelo-snap-to-grid')!=='false';
const expandedAdvancedTables=new Set();
let expandedLogicalFieldId=null;
let flowDrag = null;
let flowSimulation = null;
let lastFlowClick = null;
let contextTarget = null;
const savedDocumentSnapshots = new Map();
const documentStatuses = new Map();
const closedDocumentIds = new Set((()=>{try{const value=JSON.parse(localStorage.getItem(OPEN_DOCUMENTS_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return[]}})());
let storageReady = false;
let activeSaveRequest = null;
const pendingDocumentCommands = new Map();
const viewport = $('#canvasViewport');
const surface = $('#canvasSurface');
const modal = $('#modal');
const snapButton=$('[data-layout-action="toggle-snap"]');snapButton.setAttribute('aria-pressed',String(snapToGrid));snapButton.textContent=`${snapToGrid?'✓':'○'} Ajustar ao grid (20 px)`;

function initialState() {
  return normalizeProjectTables({
    id: uid('project'), createdAt: new Date().toISOString(), title: 'Meu projeto', active: 'conceitual', openDiagramIds:['conceitual'],
    diagrams: [{id:'conceitual',type:'conceitual',title:'Modelo conceitual',nodes:[],edges:[],conceptual:{version:1,notation:'chen',specializations:[],constraints:[]}}]
  });
}
function isBuiltInExampleWorkspace(project) {
  if(project?.title!=='Modelo de dados'||project.diagrams?.length!==2)return false;
  const conceptual=project.diagrams.find(item=>item.id==='conceitual'&&item.type==='conceitual');
  const logical=project.diagrams.find(item=>item.id==='logico'&&item.type==='logico');
  if(!conceptual||!logical||conceptual.edges.length!==8||logical.edges.length!==1)return false;
  const conceptSignature=conceptual.nodes.map(node=>`${node.kind}:${node.title}`).sort().join('|');
  const expectedConcept=['entity:Cliente','relationship:realiza','entity:Pedido','note:Seu modelo começa aqui','attribute:id_cliente','attribute:nome','attribute:email','attribute:id_pedido','attribute:data','attribute:valor_total'].sort().join('|');
  return conceptSignature===expectedConcept&&logical.nodes.length===2&&logical.nodes.every(node=>node.kind==='table')&&logical.nodes.map(node=>node.title).sort().join('|')==='clientes|pedidos';
}
function hasValidStoredWorkspace(){try{const project=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');return typeof project?.title==='string'&&Array.isArray(project.diagrams)&&project.diagrams.length>0&&project.diagrams.every(diagram=>Array.isArray(diagram.nodes)&&Array.isArray(diagram.edges));}catch{return false}}
function readStoredJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}}
function hasSavedLocalWorkspace() {
  const current=readStoredJson(STORAGE_KEY,null);
  if(current?.diagrams?.length&&!isBuiltInExampleWorkspace(current))return true;
  const projects=readStoredJson(PROJECTS_KEY,{});
  if(Object.values(projects||{}).some(project=>project?.diagrams?.length&&!isBuiltInExampleWorkspace(project)))return true;
  for(const key of ['brmodelo.uml-activity.projects.v1','brmodelo.uml-class.projects.v1','brmodelo.uml-sequence.projects.v1']){
    const values=readStoredJson(key,{});
    if(Object.values(values||{}).some(project=>project?.diagrams?.length))return true;
  }
  for(const key of ['brmodelo.uml-activity.project.v1','brmodelo.uml-class.project.v1','brmodelo.uml-sequence.project.v1']){
    const project=readStoredJson(key,null);
    if(project?.diagrams?.length)return true;
  }
  return false;
}
function normalizeTableField(field) {
  if (field && typeof field === 'object' && !Array.isArray(field)) {
    const rawType = String(field.type || 'VARCHAR').toUpperCase();
    const parsed = rawType.match(/^([A-Z]+)(?:\((\d+)(?:\s*,\s*(\d+))?\))?$/);
    const type = parsed?.[1] || rawType;
    const rawSize = field.size ?? parsed?.[2];
    return {...field, id: String(field.id || uid('c')), name: String(field.name ?? ''), type, size: sizedTypes.has(type) && Number.isInteger(Number(rawSize)) && Number(rawSize) > 0 ? Number(rawSize) : null, precision:field.precision ?? (parsed?.[3] ? Number(parsed[2]) : undefined), scale:field.scale ?? (parsed?.[3] ? Number(parsed[3]) : undefined), key: ['PK', 'FK'].includes(field.key) ? field.key : ''};
  }
  const raw = String(field ?? '');
  const typed = raw.match(/^(.*?)\s{2,}(VARCHAR|CHAR|TEXT|INT|INTEGER|BIGINT|SMALLINT|TINYINT|DECIMAL|NUMERIC|FLOAT|DOUBLE|BOOLEAN|DATE|TIME|DATETIME|TIMESTAMP|JSON|UUID|BLOB|VARBINARY)(\(\d+(?:,\d+)?\))?(?:\s+(PK|FK))?$/i);
  if (typed) return normalizeTableField({name:typed[1], type:`${typed[2].toUpperCase()}${typed[3] || ''}`, key:typed[4] || ''});
  const keyed = raw.match(/^(.*?)\s{2,}(PK|FK)$/i);
  if (keyed) return normalizeTableField({name:keyed[1], type:'INT', key:keyed[2].toUpperCase()});
  return normalizeTableField({name:raw, type:'VARCHAR'});
}
function normalizeProjectTables(project) {
  for (const diagram of project.diagrams) {
    if (diagram.type === 'atividade') {
      diagram.type = 'livre';
      if (/^Modelo (de )?atividade(s)?$/i.test(diagram.title)) diagram.title = 'Diagrama livre';
    }
  }
  for (const diagram of project.diagrams) for (const node of diagram.nodes) {
    if (node.kind === 'table') {
      node.fields = (node.fields || []).map(normalizeTableField);
      node.color = validTableColor(node.color) ? node.color : tableColors[0];
    }
  }
  for(const diagram of project.diagrams)if(diagram.type==='istar'){
    normalizeIStarDiagram(diagram);
    diagram.istar.stereotypes=diagram.istar.stereotypes.filter(item=>item&&typeof item.id==='string'&&typeof item.name==='string'&&typeof item.svg==='string').map(item=>{try{return{...item,svg:sanitizeIStarSvg(item.svg)}}catch{return null}}).filter(Boolean);
    const known=new Set(diagram.istar.stereotypes.map(item=>item.id));
    for(const node of diagram.nodes)if(node.istar?.stereotypeId&&!known.has(node.istar.stereotypeId))node.istar.stereotypeId=null;
  }
  for (const diagram of project.diagrams) materializeConceptualAttributeNodes(diagram);
  for (const diagram of project.diagrams) if (diagram.type === 'fluxo') {
    for(const node of diagram.nodes)if(node.kind==='decision'){const size=flowDecisionSize(node);node.width=size;node.height=size;}
    for (const edge of diagram.edges) {
      normalizeFlowRoute(edge);
      delete edge.fromMin; delete edge.fromMax; delete edge.toMin; delete edge.toMax;
    }
  }
  return project;
}
function validTableColor(value) { return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value); }
function flowDecisionSize(node){return Math.max(90,Math.min(360,Math.max(Number(node?.width)||110,Number(node?.height)||110)));}
function tableFieldLabel(field) {
  const key=field.key || (field.references?'FK':field.unique?'UQ':'');
  return `${field.name}${field.type ? `  ${field.type}${field.size ? `(${field.size})` : field.precision ? `(${field.precision}${field.scale!=null?`,${field.scale}`:''})` : ''}` : ''}${key ? `  ${key}` : ''}${field.nullable===false&&!['PK'].includes(key)?'  NOT NULL':''}`;
}
function tableFieldNodeMarkup(field,node) {
  const type=field.type ? `${field.type}${field.size?`(${field.size})`:field.precision?`(${field.precision}${field.scale!=null?`,${field.scale}`:''})`:''}` : '';
  const badges=[];
  const primaryKey=field.key==='PK'||node.primaryKey?.includes(field.id)||node.primaryKey?.includes(field.name);
  if(primaryKey)badges.push(['PK','Chave primária']);
  if(field.references||field.key==='FK')badges.push(['FK','Chave estrangeira']);
  if(field.unique)badges.push(['UQ','Valor único']);
  if(field.nullable===false||primaryKey)badges.push(['NN','Não aceita valores nulos']);
  return `<div class="field table-field-canvas-row ${badges.map(([value])=>value.toLowerCase()).join(' ')}"><span class="table-field-canvas-name">${escapeHtml(field.name||'')}</span><span class="table-field-canvas-type">${escapeHtml(type)}</span>${badges.length?`<span class="table-field-canvas-badges">${badges.map(([value,label])=>`<i title="${label}">${value}</i>`).join('')}</span>`:''}</div>`;
}
function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed && typeof parsed.title === 'string' && Array.isArray(parsed.diagrams) && parsed.diagrams.length && parsed.diagrams.every(d => Array.isArray(d.nodes) && Array.isArray(d.edges))) {
      for (const diagram of parsed.diagrams) if (diagram.type !== 'fluxo') for (const edge of diagram.edges) normalizeEdge(edge);
      parsed.id ||= uid('project'); parsed.createdAt ||= parsed.updatedAt || new Date().toISOString();parsed.openDiagramIds ||= parsed.diagrams.map(d=>d.id);
      return normalizeProjectTables(parsed);
    }
  } catch (_) {}
  return initialState();
}
function save() {
  state.id ||= uid('project'); state.createdAt ||= new Date().toISOString(); state.updatedAt = new Date().toISOString();state.openDiagramIds||=state.diagrams.map(d=>d.id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const projects = readWorkspaceProjects(); projects[state.id] = JSON.parse(JSON.stringify(state));
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  refreshDocumentStatuses();renderTabs();
}
function nativeDocumentId(projectId,diagramId){return `studio-diagram:${projectId}:${diagramId}`}
function moduleDocumentId(kind,projectId,diagramId){return `${kind}:${projectId}:${diagramId}`}
function rememberActiveTab(kind,projectId,diagramId){if(!kind||!projectId||!diagramId)return;localStorage.setItem(ACTIVE_TAB_KEY,JSON.stringify({kind,projectId,diagramId}));}
function restoreLastActiveTab(){let saved;try{saved=JSON.parse(localStorage.getItem(ACTIVE_TAB_KEY)||'null')}catch{return false}if(!saved||typeof saved.projectId!=='string'||typeof saved.diagramId!=='string')return false;if(saved.kind==='studio'){if(saved.projectId!==state.id||!state.openDiagramIds.includes(saved.diagramId)||!state.diagrams.some(d=>d.id===saved.diagramId))return false;state.active=saved.diagramId;activeActivity=null;activeClassDiagram=null;activeSequenceDiagram=null;render();switchView('editor');firstRunDiagramPicker=false;return true}if(!['uml-activity','uml-class','uml-sequence'].includes(saved.kind))return false;const key=moduleDocumentId(saved.kind,saved.projectId,saved.diagramId);if(closedDocumentIds.has(key))return false;const projects=saved.kind==='uml-activity'?loadActivityProjects():saved.kind==='uml-class'?loadClassProjects():loadSequenceProjects();if(!projects.some(p=>p.id===saved.projectId&&p.diagrams.some(d=>d.id===saved.diagramId)))return false;if(saved.kind==='uml-activity')openActivityDiagram(saved.projectId,saved.diagramId);else if(saved.kind==='uml-class')openClassDiagram(saved.projectId,saved.diagramId);else openSequenceDiagram(saved.projectId,saved.diagramId);switchView('editor');firstRunDiagramPicker=false;return true}
function nativeSnapshot(diagram,stateSnapshot=state){return{id:nativeDocumentId(stateSnapshot.id,diagram.id),kind:'studio-diagram',version:1,projectId:stateSnapshot.id,name:diagram.title||'Diagrama sem nome',updatedAt:new Date().toISOString(),content:{project:{...JSON.parse(JSON.stringify(stateSnapshot)),diagrams:undefined},diagram:JSON.parse(JSON.stringify(diagram))}}}
function nativeIsDirty(diagram){const snapshot=savedDocumentSnapshots.get(nativeDocumentId(state.id,diagram.id));if(!snapshot)return storageReady;return JSON.stringify(snapshot.content.diagram)!==JSON.stringify(diagram)||snapshot.name!==(diagram.title||'Diagrama sem nome')||snapshot.content.project.title!==state.title}
function refreshDocumentStatuses(){for(const diagram of state.diagrams){const id=nativeDocumentId(state.id,diagram.id);if(documentStatuses.get(id)==='saving'||documentStatuses.get(id)==='error')continue;documentStatuses.set(id,nativeIsDirty(diagram)?'dirty':'saved')}updateSaveStatus()}
function updateSaveStatus(){const id=activeActivity?moduleDocumentId('uml-activity',activeActivity.projectId,activeActivity.diagramId):activeClassDiagram?moduleDocumentId('uml-class',activeClassDiagram.projectId,activeClassDiagram.diagramId):activeSequenceDiagram?moduleDocumentId('uml-sequence',activeSequenceDiagram.projectId,activeSequenceDiagram.diagramId):nativeDocumentId(state.id,state.active);const status=documentStatuses.get(id)||'saved',labels={saved:'Salvo',dirty:'Não salvo',saving:'Salvando…',error:'Erro ao salvar'};$('#saveStatus').innerHTML=`<span class="status-dot status-${status}"></span> ${labels[status]||'Salvo'}`;}
async function persistNativeDocument(diagramId=state.active){const diagram=state.diagrams.find(item=>item.id===diagramId);if(!diagram)throw new Error('O documento não está aberto.');const snapshot=nativeSnapshot(diagram);documentStatuses.set(snapshot.id,'saving');updateSaveStatus();renderTabs();try{const saved=await saveStoredDocument(snapshot);savedDocumentSnapshots.set(saved.id,saved);const current=state.diagrams.find(item=>item.id===diagramId);documentStatuses.set(saved.id,current&&nativeIsDirty(current)?'dirty':'saved');updateSaveStatus();renderTabs();return saved}catch(error){documentStatuses.set(snapshot.id,'error');updateSaveStatus();renderTabs();throw error}}
async function persistAllNativeDocuments(){for(const diagram of state.diagrams)await persistNativeDocument(diagram.id)}
async function initializeDocumentRepository(){try{const docs=await listStoredDocuments();for(const doc of docs)if(doc.kind==='studio-diagram')savedDocumentSnapshots.set(doc.id,doc);storageReady=true;const records=docs.filter(doc=>doc.kind==='studio-diagram'&&doc.projectId===state.id).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));if(records.length&&!hadLegacyWorkspace){const meta=records[0].content.project;if(meta?.id===state.id){state={...meta,diagrams:records.map(doc=>doc.content.diagram)};state.openDiagramIds=state.openDiagramIds||state.diagrams.map(d=>d.id)}}refreshDocumentStatuses();render();if(restoreLastActiveTab())return;if(firstRunDiagramPicker){if(docs.length||hasSavedLocalWorkspace()){firstRunDiagramPicker=false;switchView('projects')}else openDiagramPicker(true)}else if(!hadLegacyWorkspace&&(docs.length||hasSavedLocalWorkspace()))switchView('projects');}catch(error){storageReady=true;documentStatuses.set(nativeDocumentId(state.id,state.active),'error');updateSaveStatus();toast(`Armazenamento indisponível: ${error.message}`);if(firstRunDiagramPicker)openDiagramPicker(true)}}
function snapshot() {
  history.push(JSON.stringify(state));
  if (history.length > 70) history.shift();
  future = [];
  updateHistoryButtons();
}
function undo() {
  if (!history.length) return;
  future.push(JSON.stringify(state));
  state = JSON.parse(history.pop());
  selectedId = null; selectedEdge = null; selectedIds.clear(); render(); save();
}
function redo() {
  if (!future.length) return;
  history.push(JSON.stringify(state));
  state = JSON.parse(future.pop());
  selectedId = null; selectedEdge = null; selectedIds.clear(); render(); save();
}
function updateHistoryButtons() { $('#undoButton').disabled = !history.length; $('#redoButton').disabled = !future.length; }
function current() { return state.diagrams.find(d => d.id === state.active) || state.diagrams[0]; }
function uid(prefix) { return prefix + Math.random().toString(36).slice(2, 10); }
function normalizeEdge(edge) {
  const legacy = String(edge.label || '').replace(/\s/g, '').toUpperCase().match(/^(0|1|N)[,:/](0|1|N)$/);
  edge.fromMin ??= legacy?.[1] === '0' ? '0' : '1';
  edge.fromMax ??= legacy?.[1] === 'N' ? 'N' : '1';
  edge.toMin ??= legacy?.[2] === '0' ? '0' : '1';
  edge.toMax ??= legacy?.[2] === 'N' ? 'N' : '1';
  return edge;
}
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800); }
function applyTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#themeToggle').setAttribute('aria-pressed', String(dark));
  $('#themeToggle').setAttribute('aria-label', dark ? 'Ativar tema claro' : 'Ativar tema escuro');
  $('#themeToggle').innerHTML = `<span aria-hidden="true">${dark ? '☀' : '☾'}</span><span class="theme-toggle-label">Tema ${dark ? 'claro' : 'escuro'}</span>`;
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  for(const id of ['activityEditorFrame','classEditorFrame','sequenceEditorFrame']) try { $(`#${id}`).contentWindow?.postMessage({type:'brmodelo-theme',theme:dark?'dark':'light'},location.origin); } catch {}
}
function nodeAt(id) { return current().nodes.find(n => n.id === id); }
function flowNodeInspectorMarkup(node){
  if(current().type!=='fluxo')return'';
  const decision=node.kind==='decision',connector=['connector','pageConnector'].includes(node.kind),subprocess=node.kind==='subprocess';
  const diagrams=state.diagrams.filter(item=>item.type==='fluxo'&&item.id!==current().id);
  return `<div class="inspector-section flow-node-properties"><h3>FLUXOGRAMA</h3><p class="small-help">${escapeHtml(flowElementDescriptions[node.kind]||'Símbolo de fluxo.')}</p>${decision?`<label class="field-label">Condição<input class="inspector-input" id="flowCondition" value="${escapeHtml(node.condition||'')}" placeholder="Ex.: estoque disponível?"></label><label class="field-label">Rótulos padrão das saídas<select class="inspector-select" id="flowBranchType"><option value="yes-no" ${node.branchType!=='true-false'&&node.branchType!=='custom'?'selected':''}>Sim / Não</option><option value="true-false" ${node.branchType==='true-false'?'selected':''}>Verdadeiro / Falso</option><option value="custom" ${node.branchType==='custom'?'selected':''}>Personalizados</option></select></label><p class="small-help">Os rótulos podem ser alterados individualmente ao selecionar cada conexão. Saídas adicionais permanecem permitidas.</p>`:''}${connector?`<label class="field-label">Identificador do conector<input class="inspector-input" id="flowConnectorId" value="${escapeHtml(node.connectorId||node.title||'')}" placeholder="Ex.: A"></label>`:''}${subprocess?`<label class="field-label">Fluxograma vinculado<select class="inspector-select" id="flowSubprocessRef"><option value="">Nenhum</option>${diagrams.map(item=>`<option value="${escapeHtml(item.id)}" ${node.subprocessRef===item.id?'selected':''}>${escapeHtml(item.title)}</option>`).join('')}</select></label>${node.subprocessRef?`<button type="button" class="inspector-action" id="openFlowSubprocess">Abrir fluxograma ↗</button>`:''}`:''}<div class="inspector-row"><label class="field-label">Largura<input class="inspector-input" type="number" min="90" max="600" data-flow-dimension="width" value="${Number(node.width)||180}"></label><label class="field-label">Altura<input class="inspector-input" type="number" min="52" max="360" data-flow-dimension="height" value="${Number(node.height)||70}"></label></div><div class="inspector-row"><label class="field-label">Preenchimento<input class="inspector-input flow-color" type="color" data-flow-color="fillColor" value="${node.fillColor||'#ffffff'}"></label><label class="field-label">Borda<input class="inspector-input flow-color" type="color" data-flow-color="strokeColor" value="${node.strokeColor||'#91a7c4'}"></label></div><div class="inspector-row"><label class="field-label">Espessura da borda<input class="inspector-input" type="number" min="1" max="6" data-flow-style="strokeWidth" value="${Number(node.strokeWidth)||2}"></label><label class="field-label">Tamanho do texto<input class="inspector-input" type="number" min="10" max="24" data-flow-style="textSize" value="${Number(node.textSize)||13}"></label></div></div>`;
}
function bindFlowNodeInspector(node,body){
  if(current().type!=='fluxo')return;
  const bind=(selector,property,transform=value=>value)=>body.querySelectorAll(selector).forEach(control=>control.addEventListener(control.type==='color'?'input':'change',event=>{snapshot();node[property]=transform(event.target.value);renderNodes();renderEdges();save();}));
  bind('#flowCondition','condition',value=>value.trim());bind('#flowBranchType','branchType');bind('#flowConnectorId','connectorId',value=>value.trim());bind('#flowSubprocessRef','subprocessRef',value=>value||null);
  body.querySelectorAll('[data-flow-color]').forEach(control=>control.addEventListener('input',event=>{snapshot();node[event.target.dataset.flowColor]=event.target.value;renderNodes();save();}));
  body.querySelectorAll('[data-flow-dimension]').forEach(control=>control.addEventListener('change',event=>{snapshot();const value=Number(event.target.value)||0;if(node.kind==='decision'){const size=Math.max(90,Math.min(360,value||110));node.width=size;node.height=size;body.querySelectorAll('[data-flow-dimension]').forEach(input=>input.value=size);}else node[event.target.dataset.flowDimension]=value;renderNodes();renderEdges();save();}));
  body.querySelectorAll('[data-flow-style]').forEach(control=>control.addEventListener('change',event=>{snapshot();node[event.target.dataset.flowStyle]=Number(event.target.value);renderNodes();save();}));
  $('#openFlowSubprocess')?.addEventListener('click',()=>{const id=node.subprocessRef;if(!state.diagrams.some(item=>item.id===id))return toast('O fluxograma vinculado não está disponível.');state.active=id;rememberActiveTab('studio',state.id,state.active);selectedId=null;selectedEdge=null;render();save();});
}
function beginInlineFlowEdit(node,element){
  if(!node||!element||element.isContentEditable)return;
  const before=JSON.stringify(state),original=node.title;
  element.addEventListener('pointerdown',event=>event.stopPropagation(),{once:true});
  snapshot();element.contentEditable='true';element.setAttribute('role','textbox');element.setAttribute('aria-label','Editar nome do elemento');element.focus();
  const selection=getSelection(),range=document.createRange();range.selectNodeContents(element);selection.removeAllRanges();selection.addRange(range);
  const finish=cancel=>{if(!element.isContentEditable)return;if(cancel){element.textContent=original;if(history.at(-1)===before)history.pop();node.title=original;}else node.title=element.textContent.trim()||original;element.contentEditable='false';element.removeAttribute('role');element.removeAttribute('aria-label');element.removeEventListener('blur',onBlur);element.removeEventListener('keydown',onKeydown);renderNodes();renderEdges();renderInspector();save();};
  const onBlur=()=>finish(false),onKeydown=event=>{if(event.key==='Enter'){event.preventDefault();element.blur();}else if(event.key==='Escape'){event.preventDefault();finish(true);}};element.addEventListener('blur',onBlur,{once:true});element.addEventListener('keydown',onKeydown);
}
function defaultTitle(kind) { return ({entity: 'Nova entidade', relationship: 'relaciona', attribute: 'Atributo', associative: 'Entidade associativa', specialization:'ISA', table: 'nova_tabela', note: 'Anotação', process: 'Novo processo', decision: 'Decisão', start: 'Início',end:'Fim',inputOutput:'Entrada / saída',subprocess:'Subprocesso',document:'Documento',documents:'Múltiplos documentos',database:'Banco de dados',connector:'Conector A',pageConnector:'Conector de página A',preparation:'Preparação',manualInput:'Entrada manual',display:'Exibição',delay:'Atraso',actor:'Novo ator',useCase:'Novo caso de uso',systemBoundary:'Sistema',istarBoundary:'Ator',istarAgent:'Agente',istarRole:'Papel',istarGoal:'Novo objetivo',istarQuality:'Nova qualidade',istarTask:'Nova tarefa',istarResource:'Novo recurso'})[kind] || 'Elemento'; }
function createFlowEdge(from,to){const source=nodeAt(from),branchIndex=current().edges.filter(edge=>edge.from===from).length,branchType=source?.branchType||'yes-no',labels=branchType==='true-false'?['Verdadeiro','Falso']:['Sim','Não'];return{id:uid('e'),from,to,label:source?.kind==='decision'?(labels[branchIndex]||`Saída ${branchIndex+1}`):'',direction:'forward',route:{corners:[],curves:{}},comment:'',lineType:'straight'};}
function openFlowQuickCreate(sourceId,side){
  const choices=palettes.fluxo.filter(([kind])=>kind!=='note'&&kind!=='start'),targets=current().nodes.filter(node=>node.id!==sourceId&&node.kind!=='start');
  const kindOptions=choices.map(([kind,label])=>`<option value="${kind}" ${kind==='process'?'selected':''}>${escapeHtml(label)}</option>`).join(''),targetOptions=targets.map(node=>`<option value="${escapeHtml(node.id)}">${escapeHtml(node.title)}</option>`).join('');
  showModal('Continuar o fluxo',`<p class="modal-copy">Crie uma próxima etapa já conectada ou ligue este ponto a um elemento existente.</p><label class="flow-choice"><input type="radio" name="flowQuickMode" value="new" checked><span><strong>Novo elemento</strong><select id="flowQuickKind" class="inspector-select">${kindOptions}</select></span></label><label class="flow-choice" ${targets.length?'':'aria-disabled="true"'}><input type="radio" name="flowQuickMode" value="existing" ${targets.length?'':'disabled'}><span><strong>Elemento existente</strong><select id="flowQuickTarget" class="inspector-select" ${targets.length?'':'disabled'}>${targetOptions}</select></span></label>`, 'Criar conexão',()=>{
    const mode=$('input[name="flowQuickMode"]:checked')?.value,source=nodeAt(sourceId);if(!source)return;
    if(mode==='existing'){const targetId=$('#flowQuickTarget')?.value;if(!targetId||targetId===sourceId)return toast('Escolha outro elemento como destino.');if(current().edges.some(edge=>edge.from===sourceId&&edge.to===targetId))return toast('A conexão já existe.');snapshot();current().edges.push(createFlowEdge(sourceId,targetId));tool='select';connectFrom=null;selectedId=null;selectedEdge=current().edges.at(-1).id;render();save();return toast('Conexão criada.');}
    const kind=$('#flowQuickKind')?.value;if(!kind)return;const dx=side==='left'?-250:side==='right'?250:0,dy=side==='top'?-170:side==='bottom'?170:0,node=addNode(kind,source.x+dx,source.y+dy);current().edges.push(createFlowEdge(sourceId,node.id));selectedId=null;selectedEdge=current().edges.at(-1).id;render();save();toast('Elemento e conexão criados.');
  });
}
function addNode(kind, x, y, ownerId=null) {
  snapshot();
  const node = {id: uid('n'), kind, title: defaultTitle(kind), x: Math.max(10, Math.round(x)), y: Math.max(10, Math.round(y)), fields: kind === 'table' ? [{id:uid('c'),name:'id', type:'INT', size:null, key:'PK',nullable:false}] : [], ...(kind === 'decision'?{width:110,height:110}:kind === 'table' ? {color:tableColors[0]} : kind==='entity'||kind==='associative'?{conceptual:{entityKind:'strong',partialKey:''}}:kind==='relationship'?{conceptual:{identifying:false}}:kind==='attribute'?{conceptual:{attributeKind:'simple',identifier:false,required:false,domain:'',derivation:''}}:kind==='specialization'?{conceptual:{completeness:'partial',disjointness:'disjoint',roles:{}}}:kind==='actor'?{representation:'stick',stereotypes:[],constraints:[]}:kind==='useCase'?{extensionPoints:[],stereotypes:[],constraints:[],objective:'',preconditions:'',postconditions:'',mainFlow:''}:kind==='systemBoundary'?{width:480,height:360}:['istarBoundary','istarAgent','istarRole'].includes(kind)?{width:300,height:200,istar:{collapsed:false,actorType:({istarBoundary:'actor',istarAgent:'agent',istarRole:'role'})[kind],stereotypeId:null}}:['istarGoal','istarQuality','istarTask','istarResource'].includes(kind)?{istar:{ownerId:null,stereotypeId:null}}:{})};
  if(current().type==='usecase'&&kind==='useCase'){const boundary=nodeAt(ownerId)?.kind==='systemBoundary'?nodeAt(ownerId):nodeAt(selectedId)?.kind==='systemBoundary'?nodeAt(selectedId):nodeAt(nodeAt(selectedId)?.systemBoundaryId);if(boundary?.kind==='systemBoundary')node.systemBoundaryId=boundary.id;}
  current().nodes.push(node); if(current().type==='istar'){normalizeIStarDiagram(current());placeIStarElement(current(),node,ownerId);fitIStarActors(current());}
  selectedId = node.id; selectedEdge = null; tool = 'select'; render(); save(); toast(`${labels[kind] || 'Elemento'} adicionado`);
}
function screenToCanvas(clientX, clientY) { const r = viewport.getBoundingClientRect(); return {x: (clientX - r.left - pan.x) / zoom, y: (clientY - r.top - pan.y) / zoom}; }
function addFromPalette(kind) { if(current().type==='istar'&&isIStarElement({kind})){const selected=nodeAt(selectedId),actor=isIStarActor(selected)?selected:nodeAt(selected?.istar?.ownerId);if(actor){actor.istar.collapsed=false;addNode(kind,actor.x+40,actor.y+128,actor.id);return;}}const r=viewport.getBoundingClientRect(),p=screenToCanvas(r.left+r.width/2,r.top+r.height/2),selected=nodeAt(selectedId),boundary=current().type==='usecase'?(selected?.kind==='systemBoundary'?selected:selected?.kind==='useCase'?nodeAt(selected.systemBoundaryId):null):null;if(kind==='useCase'&&boundary){addNode(kind,boundary.x+60,boundary.y+70,boundary.id);return;}addNode(kind,p.x-80,p.y-25); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function renderTabs() {
  const activityProjects = loadActivityProjects();
  const sequenceProjects = loadSequenceProjects();
  const nativeTabs = state.diagrams.filter(d=>state.openDiagramIds.includes(d.id)).map(d=>{const active=!activeActivity&&!activeClassDiagram&&!activeSequenceDiagram&&d.id===state.active,id=nativeDocumentId(state.id,d.id),status=documentStatuses.get(id)||'dirty';return `<span class="diagram-tab-group"><button class="diagram-tab tab-${escapeHtml(d.type)} ${active?'active':''}" role="tab" aria-selected="${active}" data-native-tab="${escapeHtml(d.id)}"><span class="tab-icon">${diagramTabIcon(d.type)}</span><span>${escapeHtml(d.title)}</span>${tabStateIndicator(status,d.title)}</button><button class="tab-close" data-close-document="${escapeHtml(d.id)}" data-document-kind="studio" title="Fechar ${escapeHtml(d.title)}" aria-label="Fechar ${escapeHtml(d.title)}">×</button></span>`}).join('');
  const activityTabs = activityProjects.flatMap(project=>project.diagrams.map(d=>{const active=activeActivity?.projectId===project.id&&activeActivity?.diagramId===d.id,id=moduleDocumentId('uml-activity',project.id,d.id),status=documentStatuses.get(id)||'saved';if(closedDocumentIds.has(id))return'';return `<span class="diagram-tab-group"><button class="diagram-tab tab-atividade ${active?'active':''}" role="tab" aria-selected="${active}" data-activity-project="${escapeHtml(project.id)}" data-activity-diagram="${escapeHtml(d.id)}" title="${escapeHtml(d.name)} · ${escapeHtml(project.title||'Atividades UML')}"><span class="tab-icon">${diagramTabIcon('atividade')}</span><span>${escapeHtml(d.name)}</span>${tabStateIndicator(status,d.name)}</button><button class="tab-close" data-close-document="${escapeHtml(d.id)}" data-project="${escapeHtml(project.id)}" data-document-kind="uml-activity" title="Fechar ${escapeHtml(d.name)}" aria-label="Fechar ${escapeHtml(d.name)}">×</button></span>`})).join('');
  const classProjects=loadClassProjects();
  const classTabs=classProjects.flatMap(project=>project.diagrams.map(d=>{const active=activeClassDiagram?.projectId===project.id&&activeClassDiagram?.diagramId===d.id,id=moduleDocumentId('uml-class',project.id,d.id),status=documentStatuses.get(id)||'saved';if(closedDocumentIds.has(id))return'';return `<span class="diagram-tab-group"><button class="diagram-tab tab-classes ${active?'active':''}" role="tab" aria-selected="${active}" data-class-project="${escapeHtml(project.id)}" data-class-diagram="${escapeHtml(d.id)}" title="${escapeHtml(d.name)} · ${escapeHtml(project.title||'Classes UML')}"><span class="tab-icon">${diagramTabIcon('classes')}</span><span>${escapeHtml(d.name)}</span>${tabStateIndicator(status,d.name)}</button><button class="tab-close" data-close-document="${escapeHtml(d.id)}" data-project="${escapeHtml(project.id)}" data-document-kind="uml-class" title="Fechar ${escapeHtml(d.name)}" aria-label="Fechar ${escapeHtml(d.name)}">×</button></span>`})).join('');
  const sequenceTabs=sequenceProjects.flatMap(project=>project.diagrams.map(d=>{const active=activeSequenceDiagram?.projectId===project.id&&activeSequenceDiagram?.diagramId===d.id,id=moduleDocumentId('uml-sequence',project.id,d.id),status=documentStatuses.get(id)||'saved';if(closedDocumentIds.has(id))return'';return `<span class="diagram-tab-group"><button class="diagram-tab tab-sequencia ${active?'active':''}" role="tab" aria-selected="${active}" data-sequence-project="${escapeHtml(project.id)}" data-sequence-diagram="${escapeHtml(d.id)}" title="${escapeHtml(d.name)} · ${escapeHtml(project.title||'Sequência UML')}"><span class="tab-icon">${diagramTabIcon('sequencia')}</span><span>${escapeHtml(d.name)}</span>${tabStateIndicator(status,d.name)}</button><button class="tab-close" data-close-document="${escapeHtml(d.id)}" data-project="${escapeHtml(project.id)}" data-document-kind="uml-sequence" title="Fechar ${escapeHtml(d.name)}" aria-label="Fechar ${escapeHtml(d.name)}">×</button></span>`})).join('');
  $('#diagramTabs').innerHTML=`${nativeTabs}${activityTabs}${classTabs}${sequenceTabs}<button class="add-tab" id="addTab" title="Novo diagrama" aria-label="Novo diagrama">＋</button>`;
  $('#diagramTabs').querySelectorAll('[data-native-tab]').forEach(tab=>tab.addEventListener('click',()=>{activeActivity=null;activeClassDiagram=null;activeSequenceDiagram=null;$('#activityEditorView').classList.add('hidden');$('#classEditorView').classList.add('hidden');$('#sequenceEditorView').classList.add('hidden');$('#standardEditor').classList.remove('hidden');state.active=tab.dataset.nativeTab;rememberActiveTab('studio',state.id,state.active);selectedId=null;selectedIds.clear();selectedEdge=null;connectFrom=null;render();save();}));
  $('#diagramTabs').querySelectorAll('[data-close-document]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();requestCloseDocument(button.dataset.documentKind,button.dataset.project,button.dataset.closeDocument)}));
  $('#diagramTabs').querySelectorAll('[data-activity-diagram]').forEach(tab=>tab.addEventListener('click',()=>openActivityDiagram(tab.dataset.activityProject,tab.dataset.activityDiagram)));
  $('#diagramTabs').querySelectorAll('[data-class-diagram]').forEach(tab=>tab.addEventListener('click',()=>openClassDiagram(tab.dataset.classProject,tab.dataset.classDiagram)));
  $('#diagramTabs').querySelectorAll('[data-sequence-diagram]').forEach(tab=>tab.addEventListener('click',()=>openSequenceDiagram(tab.dataset.sequenceProject,tab.dataset.sequenceDiagram)));
  $('#addTab').addEventListener('click',newDiagram);
}
function tabStateIndicator(status,name){return status==='saved'?'':`<span class="tab-state-dot ${status}" title="${escapeHtml(name)} · ${{dirty:'Não salvo',saving:'Salvando',error:'Erro ao salvar'}[status]||status}" aria-label="${{dirty:'Não salvo',saving:'Salvando',error:'Erro ao salvar'}[status]||status}">●</span>`}
function loadClassProjects(){try{const projects=JSON.parse(localStorage.getItem('brmodelo.uml-class.projects.v1')||'{}'),current=JSON.parse(localStorage.getItem('brmodelo.uml-class.project.v1')||'null');if(current?.id&&!projects[current.id])projects[current.id]=current;return Object.values(projects).filter(p=>p?.id&&Array.isArray(p.diagrams)).map(p=>({id:p.id,title:p.title,diagrams:p.diagrams.map(d=>({id:d.id,name:d.name||'Diagrama de classes'}))}));}catch{return[];}}
function openClassDiagram(projectId,diagramId){const id=moduleDocumentId('uml-class',projectId,diagramId);closedDocumentIds.delete(id);localStorage.setItem(OPEN_DOCUMENTS_KEY,JSON.stringify([...closedDocumentIds]));activeActivity=null;activeSequenceDiagram=null;activeClassDiagram={projectId,diagramId};rememberActiveTab('uml-class',projectId,diagramId);$('#standardEditor').classList.add('hidden');$('#activityEditorView').classList.add('hidden');$('#sequenceEditorView').classList.add('hidden');$('#classEditorView').classList.remove('hidden');const query=new URLSearchParams({embedded:'1',projectId,diagramId,theme:document.documentElement.dataset.theme||'light',ui:'classes-inspector-inpanel-6'}),frame=$('#classEditorFrame'),url=`uml-class/?${query}`;frame.dataset.documentKey=id;if(!frame.src.endsWith(url))frame.src=url;renderTabs();updateSaveStatus();}
function createClassDiagramInWorkspace(name){activeActivity=null;activeSequenceDiagram=null;activeClassDiagram={pending:true};localStorage.setItem('brmodelo.uml-class.pendingDiagram',JSON.stringify({name}));$('#standardEditor').classList.add('hidden');$('#activityEditorView').classList.add('hidden');$('#sequenceEditorView').classList.add('hidden');$('#classEditorView').classList.remove('hidden');const query=new URLSearchParams({embedded:'1',createDiagram:'1',theme:document.documentElement.dataset.theme||'light',ui:'classes-inspector-inpanel-6'});$('#classEditorFrame').src=`uml-class/?${query}`;renderTabs();}
function loadSequenceProjects(){try{const projects=JSON.parse(localStorage.getItem('brmodelo.uml-sequence.projects.v1')||'{}'),current=JSON.parse(localStorage.getItem('brmodelo.uml-sequence.project.v1')||'null');if(current?.id&&!projects[current.id])projects[current.id]=current;return Object.values(projects).filter(p=>p?.id&&Array.isArray(p.diagrams)).map(p=>({id:p.id,title:p.title,diagrams:p.diagrams.map(d=>({id:d.id,name:d.name||'Diagrama de sequência'}))}));}catch{return[];}}
function openSequenceDiagram(projectId,diagramId){const id=moduleDocumentId('uml-sequence',projectId,diagramId);closedDocumentIds.delete(id);localStorage.setItem(OPEN_DOCUMENTS_KEY,JSON.stringify([...closedDocumentIds]));activeActivity=null;activeClassDiagram=null;activeSequenceDiagram={projectId,diagramId};rememberActiveTab('uml-sequence',projectId,diagramId);$('#standardEditor').classList.add('hidden');$('#activityEditorView').classList.add('hidden');$('#classEditorView').classList.add('hidden');$('#sequenceEditorView').classList.remove('hidden');const query=new URLSearchParams({embedded:'1',projectId,diagramId,editorVersion:'5',theme:document.documentElement.dataset.theme||'light',ui:'sequence-inspector-arrow-4'}),frame=$('#sequenceEditorFrame'),url=`uml-sequence/?${query}`;frame.dataset.documentKey=id;if(!frame.src.endsWith(url))frame.src=url;renderTabs();updateSaveStatus();}
function createSequenceDiagramInWorkspace(name){activeActivity=null;activeClassDiagram=null;activeSequenceDiagram={pending:true};localStorage.setItem('brmodelo.uml-sequence.pendingDiagram',JSON.stringify({name}));$('#standardEditor').classList.add('hidden');$('#activityEditorView').classList.add('hidden');$('#classEditorView').classList.add('hidden');$('#sequenceEditorView').classList.remove('hidden');const query=new URLSearchParams({embedded:'1',createDiagram:'1',editorVersion:'5',theme:document.documentElement.dataset.theme||'light',ui:'sequence-inspector-arrow-4'});$('#sequenceEditorFrame').src=`uml-sequence/?${query}`;renderTabs();}
function loadActivityProjects() {
  try {
    const projects = JSON.parse(localStorage.getItem('brmodelo.uml-activity.projects.v1') || '{}');
    const current = JSON.parse(localStorage.getItem('brmodelo.uml-activity.project.v1') || 'null');
    if (current?.id && !projects[current.id]) projects[current.id] = current;
    return Object.values(projects).filter(p => p && typeof p.id === 'string' && Array.isArray(p.diagrams)).map(p => ({id:p.id,title:p.title,diagrams:p.diagrams.filter(d => d && typeof d.id === 'string').map(d => ({id:d.id,name:d.name || d.activity?.name || 'Nova atividade'}))}));
  } catch { return []; }
}
function openActivityDiagram(projectId, diagramId) {
  const id=moduleDocumentId('uml-activity',projectId,diagramId);closedDocumentIds.delete(id);localStorage.setItem(OPEN_DOCUMENTS_KEY,JSON.stringify([...closedDocumentIds]));
  activeActivity={projectId,diagramId};
  rememberActiveTab('uml-activity',projectId,diagramId);
  localStorage.setItem('brmodelo.uml-activity.lastSelection',JSON.stringify(activeActivity));
  activeClassDiagram=null;activeSequenceDiagram=null;$('#standardEditor').classList.add('hidden');$('#classEditorView').classList.add('hidden');$('#sequenceEditorView').classList.add('hidden');$('#activityEditorView').classList.remove('hidden');
  const query=new URLSearchParams({embedded:'1',projectId,diagramId,theme:document.documentElement.dataset.theme||'light',ui:'activity-inspector-inpanel-6'});
  const frame=$('#activityEditorFrame'),url=`uml-activity/?${query.toString()}`;
  frame.dataset.documentKey=id;if(!frame.src.endsWith(url))frame.src=url;
  renderTabs();updateSaveStatus();
}
function createActivityInWorkspace(name){
  localStorage.setItem('brmodelo.uml-activity.pendingDiagram',JSON.stringify({name}));
  activeActivity={pending:true};activeClassDiagram=null;activeSequenceDiagram=null;$('#standardEditor').classList.add('hidden');$('#classEditorView').classList.add('hidden');$('#sequenceEditorView').classList.add('hidden');$('#activityEditorView').classList.remove('hidden');
  const query=new URLSearchParams({embedded:'1',createActivity:'1',theme:document.documentElement.dataset.theme||'light'});
  query.set('ui','activity-inspector-toggle-3');$('#activityEditorFrame').src=`uml-activity/?${query.toString()}`;
  renderTabs();
}
function selectTable(id, fieldIndex = null) {
  if (!nodeAt(id)) return;
  selectedId = id; selectedEdge = null;
  renderNodes(); renderInspector(); renderPalette();
  if (fieldIndex !== null) $(`[data-field-name="${fieldIndex}"]`)?.focus();
}
function iStarPaletteIcon(kind){
  if(['istarBoundary','istarAgent','istarRole'].includes(kind)){
    const line=kind==='istarAgent'?'<path d="M3 8h26"/>':kind==='istarRole'?'<path d="M7 24 Q16 31 25 24"/>':'';
    return `<svg class="istar-palette-symbol" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13"/>${line}</svg>`;
  }
  if(['istarGoal','istarQuality','istarTask','istarResource'].includes(kind))return `<svg class="istar-palette-symbol" viewBox="0 0 170 60" aria-hidden="true">${iStarShapeMarkup(kind,170,60)}</svg>`;
  return '▤';
}
function flowPaletteIcon(kind){
  const shapes={start:'<rect x="4" y="5" width="28" height="18" rx="9"/>',end:'<rect x="4" y="5" width="28" height="18" rx="9"/><rect x="8" y="8" width="20" height="12" rx="6"/>',process:'<rect x="5" y="5" width="26" height="18" rx="2"/>',decision:'<path d="m18 3 15 11-15 11L3 14 18 3Z"/>',inputOutput:'<path d="m9 5h25l-7 18H2L9 5Z"/>',subprocess:'<rect x="5" y="5" width="26" height="18"/><path d="M10 5v18m16-18v18"/>',document:'<path d="M5 4H31V20 C31 23 27 25 23 24 C19 23 17 20 13 20 C10 20 7 22 5 24 Z"/>',documents:'<path d="M9 2H32V17 C32 20 28 22 24 21 C20 20 18 17 14 17 C12 17 10 18 9 19 Z"/><path d="M5 6V25 C8 22 11 21 14 21 C18 21 20 24 24 25 C28 26 32 24 32 21"/>',database:'<path d="M5 7c0-5 26-5 26 0v14c0 5-26 5-26 0V7Z"/><path d="M5 7c0 5 26 5 26 0M5 14c0 5 26 5 26 0"/>',connector:'<circle cx="18" cy="14" r="10"/>',pageConnector:'<path d="M7 4h22v13L18 25 7 17V4Z"/>',preparation:'<path d="m10 4h16l8 10-8 10H10L2 14l8-10Z"/>',manualInput:'<path d="m4 9 28-5v19H4V9Z"/>',display:'<path d="M8 4h20l5 16H3L8 4Zm10 16v4m-8 0h16"/>',delay:'<path d="M7 4v20a10 10 0 1 0 0-20Z"/>',note:'<path d="M7 4h15l8 8v16H7V4Zm15 0v8h8"/>'};
  return `<svg class="flow-palette-symbol" viewBox="0 0 36 30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${shapes[kind]||shapes.process}</svg>`;
}
function renderPalette() {
  const d = current();
  const tables = d.nodes.filter(n => n.kind === 'table');
  const tableList = () => {const visibleTables=tables.filter(node=>!query||`${node.title} ${(node.fields||[]).map(field=>field.name).join(' ')}`.toLocaleLowerCase('pt-BR').includes(query));return `<details class="table-accordion" ${tablesAccordionOpen ? 'open' : ''}><summary>Tabelas criadas <span>${visibleTables.length}</span></summary><div class="table-accordion-list">${visibleTables.map(n => `<details class="table-entry" data-table-entry="${escapeHtml(n.id)}" ${expandedTables.has(n.id) ? 'open' : ''}><summary><span class="table-entry-name">▤ ${escapeHtml(n.title)}</span><small>${n.fields?.length || 0}</small></summary><div class="table-entry-fields">${(n.fields || []).map((field,i)=>({field,i})).filter(({field})=>!query||`${field.name} ${field.type}`.toLocaleLowerCase('pt-BR').includes(query)).map(({field,i}) => `<button type="button" class="table-field-link" data-table-field="${escapeHtml(n.id)}" data-field-index="${i}" title="Editar ${escapeHtml(field.name)}"><span>${escapeHtml(field.name)}</span><small>${escapeHtml(field.type)}${field.size ? `(${field.size})` : ''}</small></button>`).join('') || '<p class="table-list-empty">Sem campos correspondentes</p>'}<button type="button" class="table-edit-link" data-table-id="${escapeHtml(n.id)}">Editar tabela ↗</button></div></details>`).join('') || '<p class="table-list-empty">Nenhuma tabela corresponde à busca</p>'}</div></details>`;};
  const istarLibrary=d.type==='istar'?`<section class="istar-stereotype-library"><div class="palette-label">ESTEREÓTIPOS SVG</div><button type="button" class="inspector-action" id="addIStarStereotype">＋ Adicionar SVG</button>${(d.istar?.stereotypes||[]).map(item=>`<div class="istar-stereotype-entry"><span class="istar-stereotype-preview">${item.svg}</span><span>${escapeHtml(item.name)}</span><small>${escapeHtml(item.appliesTo||'Todos')}</small></div>`).join('')||'<p class="small-help">Os SVGs cadastrados ficam disponíveis nas propriedades dos elementos.</p>'}</section>`:'';
  const query=paletteQuery.trim().toLocaleLowerCase('pt-BR');
  const nodeLabel=node=>labels[node.kind]||node.kind;
  const structure=d.nodes.filter(node=>!query||`${node.title} ${nodeLabel(node)} ${(node.fields||[]).map(field=>typeof field==='string'?field:field.name).join(' ')}`.toLocaleLowerCase('pt-BR').includes(query));
  const structureView=`<div class="palette-label">${escapeHtml(diagramKinds[d.type]?.[0]||'Diagrama').toUpperCase()} · ${d.nodes.length}</div><div class="structure-tree">${structure.map(node=>{const icon=(Object.values(palettes).flat().find(row=>row[0]===node.kind)||[null,null,'◇'])[2],fieldRows=node.kind==='table'?(node.fields||[]).filter(field=>!query||`${field.name} ${field.type}`.toLocaleLowerCase('pt-BR').includes(query)).map((field,index)=>`<button type="button" class="structure-field" data-table-field="${escapeHtml(node.id)}" data-field-index="${index}"><span>↳ ${escapeHtml(field.name)}</span><small>${escapeHtml(field.type)}${field.size?`(${field.size})`:''}</small></button>`).join(''):'',children=fieldRows?`<div class="structure-children">${fieldRows||'<small class="structure-empty">Nenhum campo corresponde à busca</small>'}</div>`:'';return `<div class="structure-entry"><button type="button" class="structure-node ${selectedId===node.id?'active':''}" data-structure-node="${escapeHtml(node.id)}"><span class="structure-icon">${d.type==='istar'?iStarPaletteIcon(node.kind):icon}</span><span class="structure-label"><strong>${escapeHtml(node.title)}</strong><small>${escapeHtml(nodeLabel(node))}</small></span><span class="structure-count">${node.kind==='table'?(node.fields||[]).length:'›'}</span></button>${children}</div>`}).join('')||`<div class="structure-empty-state">${d.nodes.length?'Nenhum elemento corresponde à busca':'Os elementos criados aparecerão aqui.'}</div>`}</div>`;
  const elementKinds=(palettes[d.type]||palettes.livre).filter(([kind,label])=>!query||`${kind} ${label}`.toLocaleLowerCase('pt-BR').includes(query)||(kind==='table'&&tables.some(node=>`${node.title} ${(node.fields||[]).map(field=>field.name).join(' ')}`.toLocaleLowerCase('pt-BR').includes(query))));
  const flowGroups=[['FLUXO BÁSICO',['start','end','process','decision','inputOutput','subprocess']],['DOCUMENTOS E DADOS',['document','documents','database']],['CONTINUIDADE E CONTROLE',['connector','pageConnector','preparation','manualInput','display','delay']],['ANOTAÇÕES',['note']]];
  const flowElements=flowGroups.map(([group,kinds])=>{const items=elementKinds.filter(([kind])=>kinds.includes(kind));if(!items.length)return'';return `<section class="flow-palette-group"><div class="palette-label">${group}</div>${items.map(([kind,label])=>`<button class="palette-item" draggable="true" data-kind="${kind}" title="${escapeHtml(flowElementDescriptions[kind]||`Adicionar ${label}`)}"><span class="shape-icon">${flowPaletteIcon(kind)}</span><span class="palette-text">${escapeHtml(label)}</span></button>`).join('')}</section>`}).join('');
  const elementView=d.type==='fluxo'?`<div class="palette-label">FLUXOGRAMA · SÍMBOLOS</div>${flowElements||'<p class="palette-search-empty">Nenhum elemento encontrado.</p>'}`:`<div class="palette-label">${escapeHtml(diagramKinds[d.type]?.[0] || 'Elementos').toUpperCase()}</div>` + (elementKinds.map(([kind, label, icon]) => `<button class="palette-item" draggable="true" data-kind="${kind}" title="Adicionar ${escapeHtml(label)}"><span class="shape-icon">${d.type==='istar'?iStarPaletteIcon(kind):icon}</span><span class="palette-text">${escapeHtml(label)}</span></button>${kind === 'table' ? tableList() : ''}`).join('')||'<p class="palette-search-empty">Nenhum elemento encontrado.</p>')+istarLibrary;
  $('#paletteBody').innerHTML = paletteView==='structure'?structureView:elementView;
  $('.palette-tabs').querySelectorAll('[data-palette-view]').forEach(button=>{const active=button.dataset.paletteView===paletteView;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));});
  $('#paletteBody').querySelectorAll('[data-kind]').forEach(el => { el.addEventListener('click', () => {addFromPalette(el.dataset.kind);$('.palette').classList.remove('mobile-open');}); el.addEventListener('dragstart', e => { e.dataTransfer.setData('application/brmodelo-kind', el.dataset.kind); e.dataTransfer.effectAllowed = 'copy'; }); });
  $('#paletteBody .table-accordion')?.addEventListener('toggle', e => { tablesAccordionOpen = e.target.open; });
  $('#paletteBody').querySelectorAll('[data-table-entry]').forEach(el => el.addEventListener('toggle', () => { if (el.open) expandedTables.add(el.dataset.tableEntry); else expandedTables.delete(el.dataset.tableEntry); }));
  $('#paletteBody').querySelectorAll('[data-table-id]').forEach(el => el.addEventListener('click', () => {selectTable(el.dataset.tableId);$('.palette').classList.remove('mobile-open');}));
  $('#paletteBody').querySelectorAll('[data-table-field]').forEach(el => el.addEventListener('click', () => {selectTable(el.dataset.tableField, Number(el.dataset.fieldIndex));centerCanvasOnNode(el.dataset.tableField);$('.palette').classList.remove('mobile-open');}));
  $('#paletteBody').querySelectorAll('[data-structure-node]').forEach(el=>el.addEventListener('click',()=>{selectedId=el.dataset.structureNode;selectedIds=new Set([selectedId]);selectedEdge=null;renderNodes();renderInspector();renderPalette();centerCanvasOnNode(selectedId);$('.palette').classList.remove('mobile-open');}));
  $('#addIStarStereotype')?.addEventListener('click', addIStarStereotype);
}
function centerCanvasOnNode(id){const node=nodeAt(id),element=node&&$('#nodes').querySelector(`[data-id="${CSS.escape(id)}"]`);if(!node||!element)return;const rect=viewport.getBoundingClientRect(),width=element.offsetWidth,height=element.offsetHeight;pan={x:rect.width/2-(node.x+width/2)*zoom,y:rect.height/2-(node.y+height/2)*zoom};renderTransform();}
function addIStarStereotype(){
  showModal('Adicionar estereótipo SVG',`<p class="modal-copy">Importe um símbolo vetorial para reutilizar nas propriedades dos elementos iStar. Scripts, links externos e conteúdo ativo serão removidos.</p><label class="field-label">Nome do estereótipo<input class="inspector-input" id="istarStereoName" maxlength="50" placeholder="Ex.: Critical"></label><label class="field-label">Aplicável a<select class="inspector-select" id="istarStereoType"><option value="all">Todos os elementos</option><option value="actor">Ator, agente ou papel</option><option value="istarGoal">Objetivo</option><option value="istarQuality">Qualidade</option><option value="istarTask">Tarefa</option><option value="istarResource">Recurso</option></select></label><label class="field-label">Arquivo SVG<input class="inspector-input" id="istarStereoFile" type="file" accept="image/svg+xml,.svg"></label><div id="istarStereoPreview" class="istar-stereotype-preview large"></div>`,'Adicionar estereótipo',()=>{
    const name=$('#istarStereoName').value.trim(),file=$('#istarStereoFile').files?.[0],svg=$('#istarStereoPreview').dataset.svg;if(!name||!file||!svg)return toast('Informe um nome e escolha um SVG válido.');
    current().istar||={version:'2.0',view:'SR',stereotypes:[]};if(current().istar.stereotypes.some(item=>item.name.localeCompare(name,undefined,{sensitivity:'accent'})===0))return toast('Já existe um estereótipo com esse nome neste diagrama.');
    snapshot();current().istar.stereotypes.push({id:uid('stereotype'),name,appliesTo:$('#istarStereoType').value,svg});render();save();toast('Estereótipo adicionado à biblioteca.');
  });
  $('#istarStereoFile').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>200_000)throw new Error('O SVG deve ter até 200 KB.');const svg=sanitizeIStarSvg(await file.text());const preview=$('#istarStereoPreview');preview.innerHTML=svg;preview.dataset.svg=svg;}catch(error){$('#istarStereoPreview').replaceChildren();$('#istarStereoPreview').dataset.svg='';toast(error.message);}});
}
function iStarShapeMarkup(kind,w,h){
  const common='fill="currentColor" stroke="var(--istar-stroke)" stroke-width="2" vector-effect="non-scaling-stroke"';
  if(kind==='istarGoal')return `<rect x="2" y="2" width="${w-4}" height="${h-4}" rx="${h/2-2}" ${common}/>`;
  if(kind==='istarQuality')return `<path d="M ${w*.08} ${h*.5} C ${w*.08} ${-h*.12}, ${w*.32} ${h*.05}, ${w*.5} ${h*.17} C ${w*.68} ${h*.05}, ${w*.92} ${-h*.12}, ${w*.92} ${h*.5} C ${w*.92} ${h*1.12}, ${w*.68} ${h*.95}, ${w*.5} ${h*.83} C ${w*.32} ${h*.95}, ${w*.08} ${h*1.12}, ${w*.08} ${h*.5} Z" ${common}/>`;
  if(kind==='istarTask')return `<polygon points="${w*.13},2 ${w*.87},2 ${w-2},${h/2} ${w*.87},${h-2} ${w*.13},${h-2} 2,${h/2}" ${common}/>`;
  return `<rect x="2" y="2" width="${w-4}" height="${h-4}" ${common}/>`;
}
function renderNodes() {
  const d = current();
  $('#flowTools')?.classList.toggle('hidden',d.type!=='fluxo');
  surface.classList.toggle('istar-surface',d.type==='istar');
  surface.classList.toggle('usecase-surface',d.type==='usecase');
  if(d.type==='istar'){fitIStarActors(d);const states=new Set(d.nodes.filter(isIStarActor).map(n=>actorCollapsed(d,n)));$('#istarView').value=states.size>1?'hybrid':states.has(true)?'SD':'SR';}
  const visibleNodes=d.type==='istar'?iStarVisibleNodes(d):d.nodes;
  const orderedNodes=['usecase','istar'].includes(d.type)?[...visibleNodes].sort((a,b)=>(['systemBoundary','istarBoundary','istarAgent','istarRole'].includes(a.kind)?-1:0)-(['systemBoundary','istarBoundary','istarAgent','istarRole'].includes(b.kind)?-1:0)):d.nodes;
  $('#nodes').innerHTML = orderedNodes.map(n => {
    const icon = (Object.values(palettes).flat().find(row => row[0] === n.kind) || [null, null, '▢'])[2];
    const showNodeFields=!(d.type==='conceitual'&&['entity','associative'].includes(n.kind));
    const fields = showNodeFields&&n.fields?.length ? `<div class="node-content">${n.fields.map((f, i) => {const name=typeof f==='string'?f:f.name,kind=f.kind||'simple';const marker=kind==='multivalued'?'◎ ':kind==='derived'?'◌ ':'';return n.kind==='table' ? tableFieldNodeMarkup(typeof f==='string'?{name:f}:f,n) : `<div class="field ${f.identifier?'identifier':''} ${kind}"><span>${escapeHtml(marker+name)}</span>${f.identifier?'<i>ID</i>':''}</div>`;}).join('')}</div>` : n.description ? `<div class="node-content">${escapeHtml(n.description)}</div>` : '';
    const quickActions = n.kind === 'table' ? `<div class="table-quick-actions"><button type="button" data-quick-edit="${escapeHtml(n.id)}" aria-label="Editar tabela ${escapeHtml(n.title)}" title="Editar tabela">✎</button><button type="button" data-quick-delete="${escapeHtml(n.id)}" aria-label="Excluir tabela ${escapeHtml(n.title)}" title="Excluir tabela">⌫</button></div><button type="button" class="table-resize-handle" aria-label="Redimensionar tabela ${escapeHtml(n.title)}" title="Arraste para redimensionar"></button>` : '';
    const isChen=d.type==='conceitual'&&d.conceptual?.notation!=='crows-foot';
    const conceptualClasses=d.type==='conceitual'?[isChen?'chen-concept':'',n.conceptual?.entityKind==='weak'?'weak-entity':'',n.kind==='relationship'&&n.conceptual?.identifying?'identifying-relationship':'',n.kind==='associative'?'chen-associative':'',n.kind==='attribute'&&n.conceptual?.identifier?'identifier-attribute':'',n.kind==='attribute'&&n.conceptual?.attributeKind==='multivalued'?'multivalued-attribute':'',n.kind==='attribute'&&n.conceptual?.attributeKind==='derived'?'derived-attribute':''].filter(Boolean).join(' '):'';
    const useCaseTitle='';
    const actorVisual=n.kind==='actor'?'<svg class="actor-stick" viewBox="0 0 64 88" aria-hidden="true" focusable="false"><circle cx="32" cy="9" r="7"/><path d="M32 16v34M13 30l19 4 19-4M32 50 17 77M32 50l15 27"/></svg>':'';
    const style=`left:${Number(n.x)||0}px;top:${Number(n.y)||0}px${n.kind==='table'?`;--table-color:${n.color};width:${Math.max(190,Math.min(480,Number(n.width)||230))}px;max-width:none`:''}${d.type==='usecase'&&validTableColor(n.fillColor)?`;--usecase-fill:${n.fillColor}`:''}${n.kind==='systemBoundary'?`;width:${Math.max(250,Number(n.width)||480)}px;height:${Math.max(180,Number(n.height)||360)}px`:''}${['istarBoundary','istarAgent','istarRole'].includes(n.kind)?(actorCollapsed(d,n)?';width:112px;height:112px':`;width:${Math.max(250,Number(n.width)||420)}px;height:${Math.max(180,Number(n.height)||300)}px`):''}${n.kind==='useCase'?`;width:${Math.max(150,Number(n.width)||210)}px;height:${Math.max(70,Number(n.height)||86)}px;min-height:70px`:''}${n.kind==='actor'?';width:90px;min-width:90px;min-height:132px':''}${d.type==='istar'&&['istarGoal','istarQuality','istarTask','istarResource'].includes(n.kind)?';width:170px;min-height:60px':''}`;
    const appliedStereotypes=['actor','useCase'].includes(n.kind)&&(n.stereotypes||[]).length?`<span class="usecase-stereotypes">${n.stereotypes.map(value=>`«${escapeHtml(value)}»`).join(' ')}</span>`:'';
    const flowDocumentShape=d.type==='fluxo'&&n.kind==='document'?'<svg class="flow-document-outline" viewBox="0 0 180 70" preserveAspectRatio="none" aria-hidden="true"><path class="document-front" d="M2 2H178V50 C162 56 148 66 130 62 C110 58 101 49 82 52 C62 55 48 67 30 64 C18 62 9 58 2 54 Z"/></svg>':d.type==='fluxo'&&n.kind==='documents'?'<svg class="flow-document-outline multiple" viewBox="0 0 180 76" preserveAspectRatio="none" aria-hidden="true"><path class="document-back" d="M12 2H178V47 C161 54 148 63 130 59 C111 55 101 46 82 49 C62 52 48 64 30 61 C22 60 16 57 12 54 Z"/><path class="document-front" d="M2 9H168V54 C151 60 138 70 120 66 C101 62 91 53 72 56 C52 59 38 71 20 68 C12 67 6 63 2 60 Z"/></svg>':'';
    const stereotype=(d.type==='istar'&&n.istar?.stereotypeId?d.istar?.stereotypes?.find(item=>item.id===n.istar.stereotypeId):null);
    if(d.type==='istar'){
      const actorType=n.istar?.actorType||({istarBoundary:'actor',istarAgent:'agent',istarRole:'role'}[n.kind]||'');
      const isActor=['istarBoundary','istarAgent','istarRole'].includes(n.kind),sd=isActor&&actorCollapsed(d,n);
      const actorLabel=({actor:'Ator',role:'Papel',agent:'Agente'})[actorType]||'Ator';
      const actorVisual=isActor?`<span class="istar-actor-symbol ${escapeHtml(actorType)}" title="${actorLabel}: ${escapeHtml(n.title)} · Arraste para mover o ator e seus elementos"><svg class="istar-actor-glyph" viewBox="0 0 112 112" aria-hidden="true"><circle cx="56" cy="56" r="53"/>${actorType==='agent'?'<path d="M12 27H100"/>':actorType==='role'?'<path d="M14 82Q56 105 98 82"/>':''}</svg><span class="istar-actor-name">${escapeHtml(n.title)}</span><span class="istar-actor-type">${actorLabel}</span></span>`:'';
      const toggle=isActor?`<button type="button" class="istar-actor-toggle" data-istar-toggle="${escapeHtml(n.id)}" aria-expanded="${!sd}" title="${sd?'Expandir conteúdo (SR)':'Recolher ator (SD)'}">${sd?'＋':'−'}</button>`:'';
      const custom=stereotype?`<span class="istar-stereotype-badge" title="${escapeHtml(stereotype.name)}">${stereotype.svg}</span>`:'';
      const symbol=!isActor?`<svg class="istar-intent-symbol" viewBox="0 0 170 60" preserveAspectRatio="none" aria-hidden="true">${iStarShapeMarkup(n.kind,170,60)}</svg>`:'';
      return `<div class="node istar-node ${escapeHtml(n.kind)} ${isActor?'istar-actor':''} ${sd&&isActor?'istar-sd-actor':''} ${selectedIds.has(n.id)||selectedId===n.id?'selected':''}" data-id="${escapeHtml(n.id)}" style="${style}">${isActor?(sd?`${actorVisual}${toggle}${custom}`:`<div class="istar-boundary-title">${actorVisual}${toggle}${custom}</div>`):`${symbol}${custom}<div class="istar-element-title">${escapeHtml(n.title)}</div>`}</div>`;
    }
    return `<div class="node ${escapeHtml(n.kind)} ${n.kind==='actor'&&n.representation==='rect'?'representation-rect':''} ${n.kind==='actor'&&n.stereotypes?.length?'has-stereotype':''} ${selectedIds.has(n.id) || selectedId === n.id ? 'selected' : ''} ${['decision','relationship'].includes(n.kind) ? 'diamond' : ''} ${n.kind === 'start' || n.kind === 'attribute' ? 'ellipse' : ''} ${conceptualClasses} ${n.kind==='specialization'?'isa-node':''}" data-id="${escapeHtml(n.id)}" style="${style}">${n.kind==='systemBoundary'?`<div class="system-boundary-title">${escapeHtml(n.title)}</div>${d.type==='usecase'?'<div class="system-boundary-grab system-boundary-grab-top" aria-hidden="true"></div><div class="system-boundary-grab system-boundary-grab-right" aria-hidden="true"></div><div class="system-boundary-grab system-boundary-grab-bottom" aria-hidden="true"></div><div class="system-boundary-grab system-boundary-grab-left" aria-hidden="true"></div><button type="button" class="usecase-resize-handle" aria-label="Redimensionar limite pelo canto inferior direito" title="Arraste para redimensionar altura e largura"></button><button type="button" class="usecase-resize-handle right-edge" data-resize-edge="right" aria-label="Redimensionar limite pela direita" title="Arraste para ampliar ou reduzir pela direita"></button><button type="button" class="usecase-resize-handle left-edge" data-resize-edge="left" aria-label="Redimensionar limite pela esquerda" title="Arraste para ampliar ou reduzir pela esquerda"></button>':''}`:`${quickActions}${n.kind==='actor'?actorVisual:''}${flowDocumentShape}${appliedStereotypes}<div class="node-title"><span class="mini">${icon}</span><span>${escapeHtml(n.title)}</span></div>${useCaseTitle}${n.kind==='useCase'?'<button type="button" class="usecase-resize-handle" aria-label="Redimensionar caso de uso" title="Arraste para redimensionar"></button>':''}`}${n.kind==='useCase'&&n.extensionPoints?.length?`<div class="usecase-points"><small>Pontos de extensão</small>${n.extensionPoints.map(point=>`<span>· ${escapeHtml(point.name)}</span>`).join('')}</div>`:''}${n.kind!=='systemBoundary'&&n.kind!=='actor'&&n.kind!=='useCase'?`${fields}`:''}</div>`;
  }).join('');
  if(d.type==='fluxo')$('#nodes').querySelectorAll('.node').forEach(el=>{const node=nodeAt(el.dataset.id);el.insertAdjacentHTML('beforeend',`<button type="button" class="flow-resize-handle" aria-label="Redimensionar ${escapeHtml(node?.title||'elemento')}" title="Arraste para redimensionar"></button>${['top','right','bottom','left'].map(side=>`<button type="button" class="flow-anchor flow-anchor-${side}" data-flow-anchor="${side}" aria-label="Conectar ${escapeHtml(node?.title||'elemento')} pela posição ${side}" title="Arraste para conectar"></button>`).join('')}`);el.classList.toggle('ellipse',['start','end'].includes(node?.kind));});
  const flowSim=d.type==='fluxo'&&flowSimulation?.diagramId===d.id?flowSimulation:null;
  $('#nodes').querySelectorAll('.node').forEach(el=>{
    const n=nodeAt(el.dataset.id);if(d.type!=='fluxo'||!n)return;
    el.classList.toggle('flow-sim-current',flowSim?.currentId===n.id);
    el.classList.toggle('flow-sim-visited',Boolean(flowSim?.history.includes(n.id)&&flowSim?.currentId!==n.id));
    if(n.fillColor)el.style.setProperty('--flow-fill',n.fillColor);
    if(n.strokeColor)el.style.setProperty('--flow-stroke',n.strokeColor);
    if(n.strokeWidth)el.style.setProperty('--flow-stroke-width',`${Math.max(1,Math.min(6,Number(n.strokeWidth)||2))}px`);
    if(n.textSize)el.style.setProperty('--flow-text-size',`${Math.max(10,Math.min(24,Number(n.textSize)||13))}px`);
    if(n.kind==='decision'){const size=flowDecisionSize(n);el.style.width=`${size}px`;el.style.height=`${size}px`;}
    else{if(n.width)el.style.width=`${Math.max(90,Math.min(600,Number(n.width)||180))}px`;if(n.height)el.style.height=`${Math.max(52,Math.min(360,Number(n.height)||70))}px`;}
  });
  updateFlowSimulationToolbar();
  $('#nodes').querySelectorAll('[data-istar-toggle]').forEach(button=>{
    button.addEventListener('pointerdown',event=>event.stopPropagation());
    button.addEventListener('dblclick',event=>event.stopPropagation());
    button.addEventListener('click',event=>{event.stopPropagation();snapshot();const actor=nodeAt(button.dataset.istarToggle);actor.istar.collapsed=!actorCollapsed(d,actor);selectedId=actor.id;selectedIds=new Set([actor.id]);selectedEdge=null;renderNodes();renderEdges();renderInspector();save();});
  });
  $('#nodes').querySelectorAll('.node').forEach(el => {
    el.addEventListener('pointerdown', onNodePointerDown);
    el.addEventListener('dblclick',event=>{const node=nodeAt(el.dataset.id);if(['fluxo','usecase'].includes(d.type)){event.preventDefault();event.stopPropagation();selectedId=node.id;selectedIds=new Set([node.id]);selectedEdge=null;const title=node.kind==='systemBoundary'?el.querySelector('.system-boundary-title'):el.querySelector('.node-title span:last-child');beginInlineFlowEdit(node,title);return;}selectedId = el.dataset.id; selectedEdge = null; renderInspector(); $('#inspectorTitle')?.focus(); $('#inspectorTitle')?.select(); });
  });
  $('#nodes').querySelectorAll('.flow-resize-handle').forEach(handle=>handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();const element=handle.closest('.node'),node=nodeAt(element.dataset.id);selectedId=node.id;selectedIds=new Set([node.id]);selectedEdge=null;renderInspector();drag={type:'flow-node-resize',id:node.id,x:event.clientX,y:event.clientY,width:element.offsetWidth,height:element.offsetHeight,moved:false};handle.setPointerCapture(event.pointerId);},true));
  $('#nodes').querySelectorAll('.flow-anchor').forEach(anchor=>anchor.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();const node=nodeAt(anchor.closest('.node').dataset.id);if(node.kind==='end')return toast('O elemento Fim não pode iniciar uma conexão.');drag={type:'flow-connect',from:node.id,side:anchor.dataset.flowAnchor,x:event.clientX,y:event.clientY,moved:false};viewport.setPointerCapture(event.pointerId);$('#nodes').querySelectorAll('.node').forEach(el=>{if(el.dataset.id!==node.id&&nodeAt(el.dataset.id)?.kind!=='start')el.classList.add('flow-connect-target');});const point=flowAnchorPoint(node,anchor.dataset.flowAnchor);$('#connections').insertAdjacentHTML('beforeend',`<path id="flowConnectionPreview" d="M ${point.x} ${point.y} L ${point.x} ${point.y}" class="flow-connection-preview"/>`);},true));
  $('#nodes').querySelectorAll('.table-resize-handle').forEach(handle=>handle.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;event.preventDefault();event.stopPropagation();
    const node=nodeAt(handle.closest('.node').dataset.id);selectedId=node.id;selectedIds=new Set([node.id]);selectedEdge=null;handle.closest('.node').classList.add('selected');renderInspector();
    drag={type:'table-resize',id:node.id,x:event.clientX,width:node.width||handle.closest('.node').offsetWidth,moved:false};handle.setPointerCapture(event.pointerId);
  },true));
  $('#nodes').querySelectorAll('.usecase-resize-handle').forEach(handle=>handle.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;event.preventDefault();event.stopPropagation();
    const element=handle.closest('.node'),node=nodeAt(element.dataset.id);selectedId=node.id;selectedIds=new Set([node.id]);selectedEdge=null;renderInspector();
    drag={type:'usecase-resize',id:node.id,x:event.clientX,y:event.clientY,nodeX:node.x,nodeY:node.y,width:element.offsetWidth,height:element.offsetHeight,edge:handle.dataset.resizeEdge||'right-bottom',moved:false};handle.setPointerCapture(event.pointerId);
  },true));
  $('#nodes').querySelectorAll('[data-quick-edit]').forEach(button => { button.addEventListener('pointerdown', e => e.stopPropagation()); button.addEventListener('click', e => { e.stopPropagation(); selectTable(button.dataset.quickEdit); $('#inspectorTitle')?.focus(); }); });
  $('#nodes').querySelectorAll('[data-quick-delete]').forEach(button => { button.addEventListener('pointerdown', e => e.stopPropagation()); button.addEventListener('click', e => { e.stopPropagation(); requestDeleteSelection(button.dataset.quickDelete); }); });
  $('#canvasEmpty').classList.toggle('hidden', d.nodes.length > 0);
  if(d.type==='usecase'){$('#canvasEmpty .empty-icon').textContent='◎';$('#canvasEmpty h3').textContent='Comece seu diagrama de casos de uso';$('#canvasEmpty p').textContent='Adicione atores, casos de uso e relacione seus comportamentos.';$('#quickAdd').textContent='＋ Adicionar ator';}else if(d.type==='istar'){$('#canvasEmpty .empty-icon').textContent='✳';$('#canvasEmpty h3').textContent='Comece seu modelo iStar';$('#canvasEmpty p').textContent='Adicione atores e seus objetivos, tarefas, qualidades e recursos.';$('#quickAdd').textContent='＋ Adicionar ator';}else{$('#canvasEmpty .empty-icon').textContent='▦';$('#canvasEmpty h3').textContent='Comece seu diagrama';$('#canvasEmpty p').textContent='Escolha um elemento à esquerda para dar forma às suas ideias.';$('#quickAdd').textContent='＋ Adicionar entidade';}
  $('#elementCount').textContent = `${d.nodes.length} ${d.nodes.length === 1 ? 'elemento' : 'elementos'}`;
  requestAnimationFrame(renderEdges);
}
function nodeCenter(n) { const el = $('#nodes').querySelector(`[data-id="${CSS.escape(n.id)}"]`); return {x: n.x + (el?.offsetWidth || 160) / 2, y: n.y + (el?.offsetHeight || 50) / 2}; }
function flowAnchorPoint(node,side){const element=$(`#nodes [data-id="${CSS.escape(node.id)}"]`),center=nodeCenter(node),halfW=(element?.offsetWidth||180)/2,halfH=(element?.offsetHeight||70)/2;return side==='top'?{x:center.x,y:center.y-halfH}:side==='right'?{x:center.x+halfW,y:center.y}:side==='bottom'?{x:center.x,y:center.y+halfH}:{x:center.x-halfW,y:center.y};}
// Use the rendered SVG outline as the geometry owner (including the quality curves).
function iStarSymbolGeometry(node) {
  const el=$('#nodes').querySelector(`[data-id="${CSS.escape(node.id)}"]`);
  const svg=el?.querySelector(isIStarActor(node)?'.istar-actor-glyph':'.istar-intent-symbol');
  if(!svg){const center=nodeCenter(node),w=el?.offsetWidth||160,h=el?.offsetHeight||52;return {center,anchor:t=>{const dx=t.x-center.x,dy=t.y-center.y,scale=1/Math.max(Math.abs(dx)/(w/2),Math.abs(dy)/(h/2),.001);return{x:center.x+dx*scale,y:center.y+dy*scale};}};}
  const rect=svg.getBoundingClientRect(),surfaceRect=surface.getBoundingClientRect();
  const x=(rect.left-surfaceRect.left)/zoom,y=(rect.top-surfaceRect.top)/zoom,w=rect.width/zoom,h=rect.height/zoom;
  const box=svg.viewBox.baseVal,shape=svg.querySelector('circle,rect,path,polygon,ellipse');
  const center={x:x+w/2,y:y+h/2};
  return {center,anchor(toward){
    const dx=(toward.x-center.x)*box.width/w,dy=(toward.y-center.y)*box.height/h,length=Math.hypot(dx,dy)||1;
    const ux=dx/length,uy=dy/length,cx=box.x+box.width/2,cy=box.y+box.height/2;
    let low=0,high=box.width+box.height;
    for(let i=0;i<24;i++){const r=(low+high)/2,point=new DOMPoint(cx+ux*r,cy+uy*r);if(shape.isPointInFill(point))low=r;else high=r;}
    return {x:x+(cx+ux*low-box.x)*w/box.width,y:y+(cy+uy*low-box.y)*h/box.height};
  }};
}
function edgeGeometry(node, other) {
  const a = nodeCenter(node), b = nodeCenter(other);
  let dx = b.x - a.x, dy = b.y - a.y;
  const length = Math.hypot(dx, dy); if (length) { dx /= length; dy /= length; } else { dx = 1; dy = 0; }
  const element = $('#nodes').querySelector(`[data-id="${CSS.escape(node.id)}"]`);
  const halfW = (element?.offsetWidth || 160) / 2, halfH = (element?.offsetHeight || 52) / 2;
  if(current().type==='usecase'&&node.kind==='actor'&&node.representation!=='rect'){
    const actorCenter={x:node.x+halfW,y:node.y+68},actorHalfW=25,actorHalfH=59,rx=dx,ry=dy,scale=Math.min(actorHalfW/Math.max(Math.abs(rx),.001),actorHalfH/Math.max(Math.abs(ry),.001));
    return{x:actorCenter.x+rx*scale,y:actorCenter.y+ry*scale};
  }
  let scale;
  if ((current().type==='usecase'&&node.kind==='useCase') || (current().type==='istar'&&actorCollapsed(current(),node)&&isIStarActor(node))) {
    scale=1/Math.sqrt((dx/halfW)**2+(dy/halfH)**2);
  } else if (current().type === 'fluxo' && node.kind === 'decision') {
    scale = 1 / (Math.abs(dx) / halfW + Math.abs(dy) / halfH);
  } else if (current().type === 'fluxo' && node.kind === 'start') {
    scale = 1 / Math.sqrt((dx / halfW) ** 2 + (dy / halfH) ** 2);
  } else if (current().type === 'fluxo') {
    const radius = Math.min(12, halfW, halfH);
    let low = 0, high = Math.min(halfW / Math.max(Math.abs(dx), .001), halfH / Math.max(Math.abs(dy), .001));
    for (let i = 0; i < 16; i++) {
      const distance = (low + high) / 2, x = Math.abs(dx * distance), y = Math.abs(dy * distance);
      const cornerX = Math.max(0, x - (halfW - radius)), cornerY = Math.max(0, y - (halfH - radius));
      if (cornerX ** 2 + cornerY ** 2 <= radius ** 2) low = distance;
      else high = distance;
    }
    scale = low;
  } else {
    scale = Math.min(halfW / Math.max(Math.abs(dx), .001), halfH / Math.max(Math.abs(dy), .001));
  }
  return {x: a.x + dx * scale, y: a.y + dy * scale, dx, dy};
}
function normalizeFlowRoute(edge) {
  const route = edge.route && typeof edge.route === 'object' ? edge.route : {};
  const validPoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const corners = Array.isArray(route.corners) ? route.corners.filter(validPoint).slice(0, 40).map(p => ({x:p.x,y:p.y})) : [];
  const curves = {};
  for (const [index, point] of Object.entries(route.curves || {})) {
    if (/^(0|[1-9]\d*)$/.test(index) && Number(index) <= corners.length && validPoint(point)) curves[index] = {x:point.x,y:point.y};
  }
  edge.route = {corners, curves};
  edge.comment = typeof edge.comment === 'string' ? edge.comment : '';
  return edge.route;
}
function flowShape(edge, start, end) {
  const route = edge.route || {corners:[],curves:{}};
  let corners=route.corners||[];
  if(!corners.length&&edge.lineType==='orthogonal'&&Math.abs(end.x-start.x)>1&&Math.abs(end.y-start.y)>1)corners=[{x:(start.x+end.x)/2,y:start.y},{x:(start.x+end.x)/2,y:end.y}];
  const points = [start, ...corners, end];
  const segments = [];
  let path = `M ${start.x} ${start.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i+1], control = route.curves[i] || (edge.lineType==='curved'&&!corners.length?{x:(a.x+b.x)/2,y:Math.min(a.y,b.y)-Math.max(30,Math.abs(a.x-b.x)*.12)}:null);
    path += control ? ` Q ${control.x} ${control.y} ${b.x} ${b.y}` : ` L ${b.x} ${b.y}`;
    segments.push({a,b,control});
  }
  const middle = segments[Math.floor(segments.length/2)] || {a:start,b:end,control:null};
  const label = middle.control ? {x:(middle.a.x+2*middle.control.x+middle.b.x)/4,y:(middle.a.y+2*middle.control.y+middle.b.y)/4} : {x:(middle.a.x+middle.b.x)/2,y:(middle.a.y+middle.b.y)/2};
  return {path,segments,label};
}
function editableConnectionShape(edge){
  const a=nodeAt(edge.from),b=nodeAt(edge.to);
  if(current().type==='istar')return iStarEditableRoute(normalizeFlowRoute(edge),iStarSymbolGeometry(a),iStarSymbolGeometry(b));
  return flowShape(edge,edgeGeometry(a,b),edgeGeometry(b,a));
}
function flowNearestSegment(segments, point) {
  let best = {index:0,distance:Infinity};
  segments.forEach(({a,b,control},index) => {
    let previous = a;
    const steps = control ? 20 : 1;
    for (let step = 1; step <= steps; step++) {
      const t = step/steps;
      const next = control ? {x:(1-t)**2*a.x+2*(1-t)*t*control.x+t*t*b.x,y:(1-t)**2*a.y+2*(1-t)*t*control.y+t*t*b.y} : b;
      const dx = next.x-previous.x, dy = next.y-previous.y;
      const amount = Math.max(0,Math.min(1,((point.x-previous.x)*dx+(point.y-previous.y)*dy)/(dx*dx+dy*dy || 1)));
      const distance = Math.hypot(point.x-(previous.x+amount*dx),point.y-(previous.y+amount*dy));
      if (distance < best.distance) best = {index,distance};
      previous = next;
    }
  });
  return best.index;
}
function endpointMark(point, min, max, key) {
  const {x, y, dx, dy} = point, px = -dy, py = dx;
  const at = distance => ({x: x + dx * distance, y: y + dy * distance});
  const line = (p1, p2) => `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"/>`;
  const across = (distance, half) => { const p = at(distance); return line({x:p.x-px*half,y:p.y-py*half},{x:p.x+px*half,y:p.y+py*half}); };
  let markup = '';
  if (max === 'N') {
    const tip = at(30), left = at(8);
    markup += line(left, tip);
    markup += line({x:left.x+px*9,y:left.y+py*9}, tip);
    markup += line({x:left.x-px*9,y:left.y-py*9}, tip);
  } else {
    across(min === '0' ? 17 : 8, 7);
    if (min === '1') across(15, 7);
  }
  if (min === '0') { const c = at(7); markup += `<circle cx="${c.x}" cy="${c.y}" r="4.5"/>`; }
  const end = at(max === 'N' ? 30 : (min === '0' ? 23 : 21));
  return {markup, end, key};
}
function renderEdges() {
  const d = current();
  const flow = d.type === 'fluxo';
  const visibleIds=new Set(d.type==='istar'?iStarVisibleNodes(d).map(n=>n.id):d.nodes.map(n=>n.id));
  const visibleEdges=d.edges.filter(edge=>visibleIds.has(edge.from)&&visibleIds.has(edge.to));
  const connectionDefs=flow ? '<defs><marker id="flowArrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#7d89a4" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>' : d.type==='usecase'?'<defs><marker id="useCaseArrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M 1 1 L 10 6 L 1 11" fill="none" stroke="#5e6880" stroke-width="1.6"/></marker><marker id="useCaseTriangle" markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto" markerUnits="userSpaceOnUse"><path d="M 1 1 L 12 7 L 1 13 Z" fill="#fbfcfe" stroke="#5e6880" stroke-width="1.5"/></marker></defs>' : d.type==='istar'?'<defs><marker id="istarArrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0 L8 4.5 L0 9 Z" fill="#63708a"/></marker></defs>':'';
  const useCaseBoundaryMarkup=d.type==='usecase'?d.nodes.filter(node=>node.kind==='systemBoundary').map(node=>`<rect class="usecase-boundary-outline ${selectedId===node.id||selectedIds.has(node.id)?'selected':''}" x="${node.x}" y="${node.y}" width="${Number(node.width)||480}" height="${Number(node.height)||360}" style="fill:${validTableColor(node.fillColor)?node.fillColor:'transparent'}"/>`).join(''):'';
  $('#connections').innerHTML = connectionDefs + useCaseBoundaryMarkup + visibleEdges.map(e => {
    const a = nodeAt(e.from), b = nodeAt(e.to); if (!a || !b) return '';
    let pa = edgeGeometry(a, b), pb = edgeGeometry(b, a);
    let path = `M ${pa.x} ${pa.y} L ${pb.x} ${pb.y}`;
    if(d.type==='istar'){
      const routed=editableConnectionShape(e);
      pa=routed.segments[0].a;pb=routed.segments.at(-1).b;path=routed.path;
      const midX=routed.label.x,midY=routed.label.y;
      const handles=selectedEdge===e.id?(e.route.corners.map((point,index)=>`<circle class="flow-handle" cx="${point.x}" cy="${point.y}" r="6" data-flow-corner="${index}"/>`).join('')+routed.segments.map((segment,index)=>{const point=iStarCurvePoint(segment.a,segment.control||{x:(segment.a.x+segment.b.x)/2,y:(segment.a.y+segment.b.y)/2},segment.b,.5);return `<circle class="flow-handle curve" cx="${point.x}" cy="${point.y}" r="5" data-flow-curve="${index}"/>`;}).join('')):'';
      const selected=selectedEdge===e.id?'selected':'';
      const base=`<path d="${path}" class="edge-hit" stroke="transparent" stroke-width="24" fill="none" data-edge-hit="${escapeHtml(e.id)}"/>`;
      let line=`<path d="${path}" class="connection-line ${selected}"/>`,decoration='',label='';
      if(e.type.startsWith('dependency')){
        const kind=({goal:'istarGoal',quality:'istarQuality',task:'istarTask',resource:'istarResource'})[e.type.slice(10).toLowerCase()]||'istarGoal';
        const left=iStarRoutePoint(routed.segments,.25),right=iStarRoutePoint(routed.segments,.75);
        const dependencyMark=p=>`M ${p.x-p.dy*7} ${p.y+p.dx*7} L ${p.x+p.dy*7} ${p.y-p.dx*7} Q ${p.x+p.dx*10} ${p.y+p.dy*10} ${p.x-p.dy*7} ${p.y+p.dx*7}`;
        const shape=iStarShapeMarkup(kind,104,38).replaceAll('var(--istar-stroke)','#376447');
        decoration=`<g class="istar-dependum" transform="translate(${midX-52} ${midY-19})" style="color:#ddf2e0">${shape}<text x="52" y="23" text-anchor="middle">${escapeHtml((e.dependum||'Dependência').slice(0,18))}</text></g><path d="${dependencyMark(left)} ${dependencyMark(right)}" class="istar-dependency-d"/>`;
      }else if(e.type==='refinementAnd'){
        const marker=iStarEndMarker(routed.segments),ux=marker.dx,uy=marker.dy;
        decoration=`<path d="M ${marker.x-uy*10} ${marker.y+ux*10} L ${marker.x+uy*10} ${marker.y-ux*10}" class="istar-edge-decoration"/>`;
      }else if(e.type==='neededBy'){
        const marker=iStarEndMarker(routed.segments);
        decoration=`<circle cx="${marker.x}" cy="${marker.y}" r="5" class="istar-needed-circle"/>`;
      }else if(['refinementOr','isA','participatesIn'].includes(e.type)||e.type.startsWith('contribution')){
        const isOr=e.type==='refinementOr',isHelp=e.type==='contributionHelp',marker=(isOr||isHelp)?iStarRoutePoint(routed.segments,1):iStarEndMarker(routed.segments);
        if(isHelp)decoration=`<path d="${iStarOpenArrow(marker,24,12)}" class="istar-help-arrow"/>`;
        else {const length=isOr?18:10,halfWidth=isOr?9:5,bx=marker.x-marker.dx*length,by=marker.y-marker.dy*length;decoration=`<path d="M ${marker.x} ${marker.y} L ${bx-marker.dy*halfWidth} ${by+marker.dx*halfWidth} L ${bx+marker.dy*halfWidth} ${by-marker.dx*halfWidth} Z" fill="${isOr?'#435570':'#63708a'}" ${isOr?'class="istar-or-arrow"':''} pointer-events="none"/>`;}
      }
      if(['isA','participatesIn'].includes(e.type))label=e.type==='isA'?'is-a':'participates-in';
      if(e.type.startsWith('contribution'))label=e.type.slice('contribution'.length).toLowerCase();
      if(label)decoration+=`<text class="edge-label istar-edge-label" x="${midX}" y="${midY-9}" text-anchor="middle">${escapeHtml(label)}</text>`;
      return `<g data-edge="${escapeHtml(e.id)}" class="edge-markers istar-edge ${escapeHtml(e.type)}">${line}${base}${decoration}${handles}</g>`;
    }
    if (flow) {
      const shape = flowShape(e,pa,pb);
      const comment = String(e.comment || '').replace(/\s+/g,' ').trim();
      const label=String(e.label||'').replace(/\s+/g,' ').trim();
      const handles = selectedEdge === e.id ? (e.route?.corners || []).map((point,index) => `<circle class="flow-handle" cx="${point.x}" cy="${point.y}" r="6" data-flow-corner="${index}" aria-label="Canto ${index+1}: arraste para mover ou clique duas vezes para remover"/>`).join('') + shape.segments.map((segment,index) => {
        if (!segment.control) return '';
        const point = {x:(segment.a.x+2*segment.control.x+segment.b.x)/4,y:(segment.a.y+2*segment.control.y+segment.b.y)/4};
        return `<circle class="flow-handle curve" cx="${point.x}" cy="${point.y}" r="6" data-flow-curve="${index}"/>`;
      }).join('') : '';
      const sim=flowSimulation?.diagramId===d.id?flowSimulation:null,simClass=sim?.edges.includes(e.id)?'flow-sim-traversed':'';
      const direction=e.direction||'forward',markerEnd=['forward','both'].includes(direction)?' marker-end="url(#flowArrow)"':'',markerStart=['backward','both'].includes(direction)?' marker-start="url(#flowArrow)"':'',stroke=/^#[\da-f]{6}$/i.test(e.color||'')?e.color:'';
      return `<g data-edge="${escapeHtml(e.id)}" class="edge-markers ${simClass}"><path d="${shape.path}" class="connection-line ${selectedEdge === e.id ? 'selected' : ''}"${markerStart}${markerEnd} ${stroke?`style="stroke:${stroke}"`:''}/><path d="${shape.path}" class="edge-hit" stroke="transparent" stroke-width="26" fill="none" data-edge-hit="${escapeHtml(e.id)}"/>${label?`<text class="flow-edge-label" x="${shape.label.x}" y="${shape.label.y-10}" text-anchor="middle">${escapeHtml(label.length>42?label.slice(0,41)+'…':label)}</text>`:''}${comment ? `<text class="flow-comment" x="${shape.label.x}" y="${shape.label.y+15}" text-anchor="middle" aria-label="${escapeHtml(comment)}">${escapeHtml(comment.length > 48 ? comment.slice(0,47) + '…' : comment)}</text>` : ''}${handles}</g>`;
    }
    if(d.type==='usecase'){
      const directed=['include','extend','generalization'].includes(e.type),label=useCaseRelationshipLabel(e.type),midX=(pa.x+pb.x)/2,midY=(pa.y+pb.y)/2;
      const marker=e.type==='generalization'?'useCaseTriangle':directed?'useCaseArrow':null;
      const dash=e.type==='include'||e.type==='extend'?'stroke-dasharray="8 6"':'';
      return `<g data-edge="${escapeHtml(e.id)}" class="edge-markers usecase-edge"><path d="${path}" class="connection-line ${selectedEdge===e.id?'selected':''}" ${dash} ${marker?`marker-end="url(#${marker})"`:''}/><path d="${path}" class="edge-hit" stroke="transparent" stroke-width="24" fill="none" data-edge-hit="${escapeHtml(e.id)}"/>${['include','extend'].includes(e.type)?`<text class="edge-label usecase-edge-label" x="${midX}" y="${midY-8}" text-anchor="middle">«${e.type}»</text>`:''}</g>`;
    }
    normalizeEdge(e);
    if (d.type === 'conceitual' && d.conceptual?.notation !== 'crows-foot') {
      const relationship=a.kind==='relationship'?a:b.kind==='relationship'?b:null;
      const entityEnd=a.kind==='relationship'?pb:b.kind==='relationship'?pa:pb;
      const dx=relationship?(relationship.id===a.id?pa.x-pb.x:pb.x-pa.x):pb.x-pa.x,dy=relationship?(relationship.id===a.id?pa.y-pb.y:pb.y-pa.y):pb.y-pa.y,len=Math.hypot(dx,dy)||1,offset=4,ux=dx/len,uy=dy/len,px=-uy*offset,py=ux*offset;
      const siblings=relationship?d.edges.filter(edge=>edge.id!==e.id&&((edge.from===a.id&&edge.to===b.id)||(edge.from===b.id&&edge.to===a.id))):[],allSiblings=[...siblings,e].sort((left,right)=>String(left.role||left.id).localeCompare(String(right.role||right.id))),parallelIndex=allSiblings.findIndex(edge=>edge.id===e.id),curveOffset=allSiblings.length>1?(parallelIndex-(allSiblings.length-1)/2)*18:0,midX=(pa.x+pb.x)/2-uy*curveOffset,midY=(pa.y+pb.y)/2+ux*curveOffset,chenPath=curveOffset?`M ${pa.x} ${pa.y} Q ${midX*2-(pa.x+pb.x)/2} ${midY*2-(pa.y+pb.y)/2} ${pb.x} ${pb.y}`:path;
      const card=relationship?`${e.from===relationship.id?e.toMin:e.fromMin}..${e.from===relationship.id?e.toMax:e.fromMax}`:'';
      const min=relationship?(e.from===relationship.id?e.toMin:e.fromMin):'1',participationClass=min==='0'?'chen-optional':'chen-mandatory';
      const participationLine=relationship&&e.totalParticipation?`<path d="M ${entityEnd.x+ux*20+px} ${entityEnd.y+uy*20+py} L ${entityEnd.x+px} ${entityEnd.y+py}" class="chen-total-line"/>`:'';
      return `<g data-edge="${escapeHtml(e.id)}" class="edge-markers chen-edge ${participationClass} ${e.totalParticipation?'chen-total':''}"><path d="${chenPath}" class="connection-line ${selectedEdge===e.id?'selected':''} ${participationClass}"/><path d="${chenPath}" class="edge-hit" stroke="transparent" stroke-width="26" fill="none" data-edge-hit="${escapeHtml(e.id)}"/>${participationLine}${card?`<text class="edge-label" x="${midX}" y="${midY-8}" text-anchor="middle">${card}</text>`:''}</g>`;
    }
    const ma = a.kind === 'relationship' ? {markup:'',end:pa} : endpointMark(pa, e.fromMin, e.fromMax, 'from');
    const mb = b.kind === 'relationship' ? {markup:'',end:pb} : endpointMark(pb, e.toMin, e.toMax, 'to');
    // Keep the connection path attached to both node borders. Markers sit over
    // this path, and the node layer masks the part drawn inside each shape.
    const relation = a.kind === 'relationship' ? `${e.toMin}..${e.toMax}` : `${e.fromMin}..${e.fromMax}`;
    const midX = (ma.end.x + mb.end.x) / 2, midY = (ma.end.y + mb.end.y) / 2;
    const identifyingClass=current().type==='logico'?(e.identifying?'identifying':'non-identifying'):'';
    return `<g data-edge="${escapeHtml(e.id)}" class="edge-markers"><g class="edge-symbol">${ma.markup}${mb.markup}</g><path d="${path}" class="connection-line ${selectedEdge === e.id ? 'selected' : ''} ${identifyingClass}"/><path d="${path}" class="edge-hit" stroke="transparent" stroke-width="26" fill="none" data-edge-hit="${escapeHtml(e.id)}"/><text class="edge-label" x="${midX}" y="${midY-9}" text-anchor="middle">${relation}</text></g>`;
  }).join('');
  $('#connectionCount').textContent = d.edges.length;
  updateFlowSimulationToolbar();
}
function selectConnection(id) {
  const connection=current().edges.find(edge => edge.id === id);
  if (!connection) return;
  selectedEdge = id; selectedId = null; selectedIds.clear();
  setTool('connect');
  if(current().type==='istar'&&connection.type){current().istar.selectedRelationship=connection.type;$('#istarRelationType').value=connection.type;renderIStarRelationshipPicker();save();}
  renderEdges(); renderInspector();
  // On narrow layouts the inspector is an off-canvas panel. Selecting a line
  // should reveal it just like choosing the same relation from the manager.
  $('.inspector').classList.add('is-open');
}
function openConnections() {
  const edges = current().edges;
  if (!edges.length) return toast('Crie uma conexão para editar suas propriedades');
  const options = edges.map(edge => {
    if (current().type !== 'fluxo') normalizeEdge(edge);
    const from = nodeAt(edge.from)?.title || 'Origem';
    const to = nodeAt(edge.to)?.title || 'Destino';
    const summary = current().type === 'fluxo' ? 'Fluxo' : current().type==='usecase'?useCaseRelationshipLabel(edge.type):`${edge.fromMin}..${edge.fromMax} : ${edge.toMin}..${edge.toMax}`;
    return `<button type="button" class="relation-choice" data-relation="${escapeHtml(edge.id)}"><span class="relation-choice-nodes"><strong>${escapeHtml(from)}</strong><i>→</i><strong>${escapeHtml(to)}</strong></span><span class="relation-choice-cardinality">${summary}</span></button>`;
  }).join('');
  showModal(current().type === 'fluxo' ? 'Conexões do fluxograma' : 'Relações do diagrama', `<p class="modal-copy">Escolha uma conexão para abrir suas propriedades.</p><div class="relation-list">${options}</div>`, 'Fechar', () => {});
  modal.querySelectorAll('[data-relation]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.relation;
    modal.close('cancel');
    selectConnection(id);
  }));
}
function tableFieldEditor(node) {
  const rows = (node.fields || []).map((field, i) => {
    const types = columnTypes.includes(field.type) || !field.type ? columnTypes : [field.type, ...columnTypes];
    const badges=tableFieldBadges(field,node);
    const fieldId=field.id||String(i),size=sizedTypes.has(field.type);
    return `<article class="table-field-row" data-field-row="${i}">
      <div class="table-field-main">
        <button type="button" class="field-drag-handle" draggable="true" data-field-drag aria-label="Mover campo ${escapeHtml(field.name)}" title="Arraste para reordenar; use as setas do teclado">⠿</button>
        <label class="field-name-control"><input class="inspector-input field-name-inline" data-field-name="${i}" aria-label="Nome do campo ${i+1}" placeholder="Nome do campo" value="${escapeHtml(field.name)}"><small class="field-validation" data-field-error="${i}" hidden>Nome duplicado</small></label>
        <select class="inspector-select field-type-inline" data-field-type="${i}" aria-label="Tipo do campo ${i+1}" title="${escapeHtml(field.type||'Tipo de dado')}">${types.map(type => `<option value="${escapeHtml(type)}" ${type === field.type ? 'selected' : ''}>${escapeHtml(type)}</option>`).join('')}</select>
        ${size?`<input class="inspector-input field-size-inline" type="number" min="1" max="65535" step="1" data-field-size="${i}" aria-label="Tamanho de ${escapeHtml(field.type)}" title="Tamanho do campo" placeholder="tam." value="${field.size||''}">`:'<span class="field-size-placeholder" aria-hidden="true"></span>'}
        <span class="table-field-badges" aria-label="Restrições do campo">${badges.map(([value,label])=>`<span class="field-badge" title="${label}">${value}</span>`).join('')}</span>
        <details class="table-field-actions"><summary aria-label="Ações do campo ${escapeHtml(field.name)}" title="Ações">⋯</summary><div class="table-field-actions-menu"><button type="button" data-open-field-config>Configurar</button><button type="button" data-duplicate-field="${i}">Duplicar</button><button type="button" data-move-field="up" data-field-index="${i}" ${i===0?'disabled':''}>Mover para cima</button><button type="button" data-move-field="down" data-field-index="${i}" ${i===node.fields.length-1?'disabled':''}>Mover para baixo</button><button type="button" data-remove-field="${i}">Excluir</button></div></details>
      </div>
      <details class="column-options" name="logical-field-config" data-field-config="${escapeHtml(fieldId)}" ${expandedLogicalFieldId===fieldId?'open':''}>
        <summary><span>Configurar campo</span><span class="field-config-chevron" aria-hidden="true">⌄</span></summary>
        <div class="column-option-grid"><label title="Identifica uma linha de forma exclusiva"><input type="checkbox" data-field-pk="${i}" ${field.key === 'PK' || node.primaryKey?.includes(field.id) ? 'checked' : ''}> Chave primária (PK)</label><label title="Referencia uma coluna de outra tabela"><input type="checkbox" data-field-fk="${i}" ${field.references || field.key === 'FK' ? 'checked' : ''}> Chave estrangeira (FK)</label><label title="Impede valores nulos"><input type="checkbox" data-field-nullable="${i}" ${field.nullable === false || field.key === 'PK' || node.primaryKey?.includes(field.id) ? 'checked' : ''}> NOT NULL</label><label><input type="checkbox" data-field-unique="${i}" ${field.unique ? 'checked' : ''}> UNIQUE</label><label><input type="checkbox" data-field-identity="${i}" ${field.identity ? 'checked' : ''}> AUTO_INCREMENT</label><label><input type="checkbox" data-field-multivalued="${i}" ${field.multivalued || field.repeatingGroup ? 'checked' : ''}> Multivalorado / grupo repetitivo</label></div>
        ${field.key==='FK'||field.references?logicalForeignKeyTargetEditor(node,field,i):''}
        ${field.type==='ENUM'?`<label class="field-label enum-values-label">Valores permitidos (um por linha)<textarea class="inspector-textarea enum-values-input" data-field-enum-values="${i}" placeholder="Ex.:\npendente\naprovado\ncancelado">${escapeHtml((field.enumValues||[]).join('\n'))}</textarea><small class="small-help">MySQL/MariaDB geram ENUM nativo. PostgreSQL/SQLite usam TEXT com CHECK.</small></label>`:''}
        <label class="field-label">DEFAULT<input class="inspector-input" data-field-default="${i}" value="${escapeHtml(field.defaultValue || '')}" placeholder="Ex.: CURRENT_TIMESTAMP"></label><label class="field-label">CHECK<input class="inspector-input" data-field-check="${i}" value="${escapeHtml(field.check || '')}" placeholder="Ex.: idade >= 18"></label><label class="field-label">Descrição<input class="inspector-input" data-field-description="${i}" value="${escapeHtml(field.description || '')}" placeholder="Documente esta coluna"></label>
      </details>
    </article>`;
  }).join('');
  const dependencies=(node.functionalDependencies||[]).map((fd,index)=>`<div class="functional-dependency"><span>${escapeHtml(fd.determinant.join(', '))} → ${escapeHtml(fd.dependent.join(', '))}</span><button type="button" data-remove-fd="${index}" aria-label="Excluir dependência funcional">×</button></div>`).join('');
  const indexes=(node.indexes||[]).map(index=>`<div class="functional-dependency"><span>${index.unique?'UNIQUE · ':''}${escapeHtml(index.name||'Índice')} (${escapeHtml((index.columns||[]).join(', '))})</span></div>`).join('');
  return `<div class="inspector-section table-fields-section"><div class="table-fields-section-heading"><div><h3>CAMPOS</h3><p>Edite direto na linha; expanda para configurar.</p></div><span class="table-field-count">${(node.fields || []).length}</span></div><div id="fieldList" class="table-field-list">${rows}</div><button class="inspector-action" id="addField">＋ Adicionar campo</button><button class="inspector-action secondary-action" id="addTableConstraint">＋ Restrição UNIQUE composta</button></div><details class="inspector-advanced" data-table-advanced="${escapeHtml(node.id)}" ${expandedAdvancedTables.has(node.id)?'open':''}><summary><span>Configurações avançadas</span><small>Schema, índices e dependências</small></summary><div class="inspector-advanced-body"><div class="inspector-section"><h3>SCHEMA LÓGICO</h3><label class="field-label" for="tableSchema">Schema</label><input class="inspector-input" id="tableSchema" value="${escapeHtml(node.schema || '')}" placeholder="Ex.: public"></div><div class="inspector-section"><h3>ÍNDICES</h3>${indexes||'<p class="small-help">Índices são gerados junto ao script SQL.</p>'}<button class="inspector-action" id="addTableIndex">＋ Planejar índice</button></div><div class="inspector-section"><h3>DEPENDÊNCIAS FUNCIONAIS</h3>${dependencies||'<p class="small-help">Cadastre dependências para analisar 2FN, 3FN e BCNF com evidências.</p>'}<button class="inspector-action" id="addFunctionalDependency">＋ Cadastrar dependência</button></div></div></details>`;
}
function logicalForeignKeyTargetEditor(source,field,index){
  const tables=current().nodes.filter(item=>item.kind==='table');
  const selectedTable=tables.find(item=>item.id===field.references?.tableId);
  const targets=selectedTable?.fields||[];
  const selectedColumn=targets.find(item=>(item.id||item.name)===field.references?.columnId||item.name===field.references?.columnName);
  return `<div class="logical-fk-target" data-fk-target-editor="${index}"><div><label class="field-label" for="fk-target-table-${index}">Tabela referenciada</label><select class="inspector-select" id="fk-target-table-${index}" data-fk-table="${index}"><option value="">Selecione uma tabela</option>${tables.map(table=>`<option value="${escapeHtml(table.id)}" ${table.id===selectedTable?.id?'selected':''}>${escapeHtml(table.title)}${table.id===source.id?' (esta tabela)':''}</option>`).join('')}</select></div><div><label class="field-label" for="fk-target-column-${index}">Campo referenciado</label><select class="inspector-select" id="fk-target-column-${index}" data-fk-column="${index}" ${!selectedTable?'disabled':''}><option value="">${selectedTable?'Selecione um campo':'Escolha primeiro a tabela'}</option>${targets.map(column=>`<option value="${escapeHtml(column.id||column.name)}" ${selectedColumn&&(column.id||column.name)===(selectedColumn.id||selectedColumn.name)?'selected':''}>${escapeHtml(column.name)}${column.key==='PK'||selectedTable.primaryKey?.includes(column.id||column.name)?' · PK':''}${column.unique?' · UNIQUE':''}</option>`).join('')}</select></div><p class="small-help">Escolha a coluna de destino desta chave estrangeira. O campo de origem precisa ter tipo compatível.</p></div>`;
}
function tableColorEditor(node) {
  return `<div class="inspector-section"><h3>COR DA TABELA</h3><div class="table-color-picker"><input type="color" id="tableColor" value="${node.color}" aria-label="Cor personalizada da tabela"><span>Escolha uma cor para destacar esta tabela.</span></div><div class="table-color-swatches">${tableColors.map(color => `<button type="button" class="table-color-swatch ${node.color === color ? 'active' : ''}" data-table-color="${color}" style="--swatch:${color}" aria-label="Escolher cor ${color}" aria-pressed="${node.color === color}"></button>`).join('')}</div></div>`;
}
function tableFieldBadges(field,node){return [[field.key==='PK'||node.primaryKey?.includes(field.id)?'PK':'','Chave primária'],[field.references||field.key==='FK'?'FK':'','Chave estrangeira'],[field.unique?'UQ':'','Valor único'],[field.nullable===false||field.key==='PK'?'NN':'','Não aceita valores nulos']].filter(([value])=>value);}
function refreshTableFieldBadges(node,container){node.fields.forEach((field,index)=>{const badges=tableFieldBadges(field,node),target=container.querySelector(`[data-field-row="${index}"] .table-field-badges`);if(!target)return;target.innerHTML=badges.map(([value,label])=>`<span class="field-badge" title="${label}">${value}</span>`).join('');target.hidden=!badges.length;});}
function reorderTableField(node,source,target){if(source===target||source<0||target<0||source>=node.fields.length||target>=node.fields.length)return;snapshot();const[field]=node.fields.splice(source,1);node.fields.splice(target,0,field);renderInspector();renderNodes();renderPalette();save();requestAnimationFrame(()=>document.querySelector(`[data-field-row="${target}"] [data-field-drag]`)?.focus());}
function updateTableFieldNameValidation(node,container){container.querySelectorAll('[data-field-name]').forEach(input=>{const index=Number(input.dataset.fieldName),name=input.value.trim().toLocaleLowerCase('pt-BR'),duplicate=Boolean(name)&&node.fields.some((field,fieldIndex)=>fieldIndex!==index&&field.name.trim().toLocaleLowerCase('pt-BR')===name);input.setAttribute('aria-invalid',String(duplicate));const message=container.querySelector(`[data-field-error="${index}"]`);if(message)message.hidden=!duplicate;});}
function conceptualAttributeEditor(node, title = 'ATRIBUTOS') {
  const rows=(node.fields||[]).map((field,index)=>`<article class="concept-field"><div class="concept-field-top"><label>Nome<input class="inspector-input" data-concept-attr-name="${index}" value="${escapeHtml(field.name)}" placeholder="Ex.: nome"></label><button type="button" class="concept-field-remove" data-remove-field="${index}" aria-label="Remover atributo ${escapeHtml(field.name)}">×</button></div><label class="field-label">Classificação<select class="inspector-select" data-concept-attr-kind="${index}"><option value="simple" ${field.kind==='simple'?'selected':''}>Simples</option><option value="composite" ${field.kind==='composite'?'selected':''}>Composto</option><option value="multivalued" ${field.kind==='multivalued'?'selected':''}>Multivalorado</option><option value="derived" ${field.kind==='derived'?'selected':''}>Derivado</option></select></label><label class="field-label">Domínio<input class="inspector-input" data-concept-attr-domain="${index}" value="${escapeHtml(field.domain||'')}" placeholder="Ex.: texto, data, moeda"></label><label class="field-label">Componente de<select class="inspector-select" data-concept-attr-parent="${index}"><option value="" ${!field.parentId?'selected':''}>Atributo raiz</option>${(node.fields||[]).filter(candidate=>candidate.id!==field.id&&candidate.kind==='composite').map(candidate=>`<option value="${escapeHtml(candidate.id)}" ${field.parentId===candidate.id?'selected':''}>${escapeHtml(candidate.name)}</option>`).join('')}</select></label><div class="concept-field-flags"><label><input type="checkbox" data-concept-attr-identifier="${index}" ${field.identifier?'checked':''}> Identificador</label><label><input type="checkbox" data-concept-attr-required="${index}" ${field.required?'checked':''}> Obrigatório</label></div>${field.kind==='derived'?`<label class="field-label">Regra de derivação<textarea class="inspector-textarea" data-concept-attr-derivation="${index}" placeholder="Descreva a regra">${escapeHtml(field.derivation||'')}</textarea></label>`:''}${field.kind==='composite'?`<p class="small-help">Defina os componentes nas opções “Componente de” dos outros atributos.</p>`:''}</article>`).join('');
  const rules=(current().conceptual?.constraints||[]).map((rule,index)=>rule.elementId===node.id?`<div class="functional-dependency"><span>${escapeHtml(rule.description)}</span><button type="button" data-remove-concept-rule="${index}" aria-label="Remover regra de negócio">×</button></div>`:'').join('');
  return `<div class="inspector-section"><div class="table-fields-section-heading"><div><h3>${title}</h3><p>Atributos conceituais independentes de tipos físicos.</p></div><span class="table-field-count">${(node.fields||[]).length}</span></div><div class="concept-field-list">${rows||'<p class="small-help">Nenhum atributo cadastrado.</p>'}</div><button class="inspector-action" data-add-concept-attribute="${escapeHtml(node.id)}">＋ Adicionar atributo</button><h3 class="concept-rule-heading">REGRAS DE NEGÓCIO</h3>${rules||'<p class="small-help">Descreva regras que ainda não podem ser validadas automaticamente.</p>'}<button class="inspector-action" data-add-concept-rule="${escapeHtml(node.id)}">＋ Adicionar regra</button></div>`;
}
function conceptualEntityAttributes(owner){
  return current().edges.filter(edge=>edge.from===owner.id||edge.to===owner.id).map(edge=>nodeAt(edge.from===owner.id?edge.to:edge.from)).filter(node=>node?.kind==='attribute');
}
function conceptualEntityAttributeEditor(owner){
  const attributes=conceptualEntityAttributes(owner);
  const rows=attributes.map(attribute=>{
    const kind=attribute.conceptual?.attributeKind||'simple',badges=[attribute.conceptual?.identifier?'Identificador':'',kind==='multivalued'?'Multivalorado':'',kind==='derived'?'Derivado':'',kind==='composite'?'Composto':''].filter(Boolean);
    return `<button type="button" class="owned-attribute-row" data-owned-attribute="${escapeHtml(attribute.id)}"><span class="owned-attribute-oval">${escapeHtml(attribute.title)}</span><small>${badges.join(' · ')||'Simples'}</small><span class="owned-attribute-open" aria-hidden="true">›</span></button>`;
  }).join('');
  return `<div class="inspector-section"><div class="table-fields-section-heading"><div><h3>ATRIBUTOS CONECTADOS</h3><p>Cada atributo aparece como oval ligado a esta entidade.</p></div><span class="table-field-count">${attributes.length}</span></div><div class="owned-attribute-list">${rows||'<p class="small-help">Nenhum atributo ligado. Adicione um ou arraste um atributo até a entidade.</p>'}</div><button class="inspector-action" id="addOwnedConceptualAttribute">＋ Adicionar atributo</button></div>`;
}
function addOwnedConceptualAttribute(ownerId){
  const owner=nodeAt(ownerId);if(!owner)return;
  const count=conceptualEntityAttributes(owner).length,id=uid('a');
  snapshot();
  current().nodes.push({id,kind:'attribute',title:'novo_atributo',x:owner.x-15+(count%3)*145,y:owner.y-100-Math.floor(count/3)*80,fields:[],conceptual:{attributeKind:'simple',identifier:false,required:false,domain:'',derivation:'',parentId:null}});
  current().edges.push({id:uid('e'),from:owner.id,to:id,fromMin:'1',fromMax:'1',toMin:'1',toMax:'1'});
  selectedId=id;selectedIds=new Set([id]);selectedEdge=null;render();save();$('#inspectorTitle')?.focus();$('#inspectorTitle')?.select();
}
function bindConceptualRules(node, body) {
  body.querySelectorAll('[data-add-concept-rule]').forEach(button=>button.addEventListener('click',()=>showModal('Regra de negócio',`<p class="modal-copy">Registre uma restrição conceitual que o validador ainda não verifica automaticamente.</p><label class="field-label">Descrição<textarea id="conceptRuleDescription" class="inspector-textarea" placeholder="Ex.: um pedido precisa ter ao menos um item"></textarea></label>`,'Salvar regra',()=>{const description=$('#conceptRuleDescription').value.trim();if(!description)return toast('Descreva a regra antes de salvar.');snapshot();current().conceptual.constraints.push({id:uid('rule'),elementId:node.id,description});renderInspector();save();})));
  body.querySelectorAll('[data-remove-concept-rule]').forEach(button=>button.addEventListener('click',()=>{snapshot();current().conceptual.constraints.splice(Number(button.dataset.removeConceptRule),1);renderInspector();save();}));
}
function renderInspector() {
  if(selectedIds.size>1){
    const body=$('#inspectorBody');
    $('.editor-grid').classList.remove('inspector-collapsed');
    $('.inspector').classList.add('is-open');
    updateInspectorControls();
    body.innerHTML=`<div class="inspector-section"><div class="eyebrow">SELEÇÃO MÚLTIPLA</div><h3>${selectedIds.size} elementos selecionados</h3><p class="small-help">Você pode arrastar os elementos juntos ou removê-los em uma única ação.</p><button class="inspector-action danger" id="deleteMultiSelection">Excluir seleção</button></div>`;
    $('#deleteMultiSelection').addEventListener('click',()=>requestDeleteSelection());
    return;
  }
  const node = selectedId && nodeAt(selectedId);
  const edge = selectedEdge && current().edges.find(e => e.id === selectedEdge);
  const body = $('#inspectorBody');
  if(node||edge){$('.editor-grid').classList.remove('inspector-collapsed');}
  $('.inspector').classList.toggle('is-open', Boolean(node || edge));
  updateInspectorControls();
  if (!node && !edge) { body.innerHTML = '<div class="inspector-placeholder"><span>✳</span><strong>Nada selecionado</strong>Selecione um elemento ou conexão para editar suas propriedades.</div>'; return; }
  if (node?.kind === 'relationship') { renderRelationshipInspector(node, body); return; }
  if (edge) {
    if(current().type==='istar'){
      const source=nodeAt(edge.from),target=nodeAt(edge.to),choices=iStarRelationshipOptions(edge.type);
      body.innerHTML=`<div class="inspector-section"><div class="eyebrow">RELAÇÃO iSTAR</div><h3>${escapeHtml(source?.title||'Origem')} → ${escapeHtml(target?.title||'Destino')}</h3><label class="field-label">Tipo<select class="inspector-select" id="istarEdgeType">${choices}</select></label>${edge.type.startsWith('dependency')?`<label class="field-label">Dependum<select class="inspector-select" id="istarDependumKind"><option value="goal" ${edge.dependumKind==='goal'?'selected':''}>Objetivo</option><option value="quality" ${edge.dependumKind==='quality'?'selected':''}>Qualidade</option><option value="task" ${edge.dependumKind==='task'?'selected':''}>Tarefa</option><option value="resource" ${edge.dependumKind==='resource'?'selected':''}>Recurso</option></select></label><label class="field-label">Nome do dependum<input class="inspector-input" id="istarDependum" value="${escapeHtml(edge.dependum||'')}" placeholder="Ex.: pagamento concluído"></label>`:''}<label class="field-label">Observação<textarea class="inspector-textarea" id="istarEdgeNote">${escapeHtml(edge.documentation||'')}</textarea></label></div><div class="inspector-section"><h3>TRAÇADO</h3><p class="small-help">Arraste a linha ou o ponto central para curvar. Dois cliques criam um canto. Arraste os cantos para deslocá-los; dois cliques em um canto removem-no.</p><button class="inspector-action" id="resetIStarRoute">Restaurar curva automática</button></div><button class="inspector-action danger" id="deleteSelection">Excluir relação</button>`;
      $('#resetIStarRoute').addEventListener('click',()=>{snapshot();delete edge.route;renderEdges();renderInspector();save();});
      $('#istarEdgeType').addEventListener('change',event=>{const next=event.target.value,issue=validateIStarDiagram({...current(),edges:[{...edge,type:next}]}).find(item=>item.severity==='error'&&item.elementId===edge.id);if(issue){event.target.value=edge.type;toast(issue.message);return;}snapshot();edge.type=next;if(next.startsWith('dependency'))edge.dependumKind=next.slice(10).toLowerCase();renderEdges();renderInspector();save();});$('#istarDependumKind')?.addEventListener('change',event=>{snapshot();edge.dependumKind=event.target.value;edge.type='dependency'+event.target.value[0].toUpperCase()+event.target.value.slice(1);renderEdges();renderInspector();save();});$('#istarDependum')?.addEventListener('input',event=>{edge.dependum=event.target.value;renderEdges();save();});$('#istarEdgeNote').addEventListener('input',event=>{edge.documentation=event.target.value;save();});$('#deleteSelection').addEventListener('click',()=>requestDeleteSelection());return;
    }
    if(current().type==='usecase'){
      const source=nodeAt(edge.from),target=nodeAt(edge.to),extensionPointOptions=(target?.extensionPoints||[]).map(point=>`<option value="${escapeHtml(point.name)}" ${edge.extensionPoint===point.name?'selected':''}>${escapeHtml(point.name)}</option>`).join('');
      body.innerHTML=`<div class="inspector-section"><h3>RELACIONAMENTO UML</h3><label class="field-label">Tipo<select class="inspector-select" id="useCaseEdgeType">${['association','include','extend','generalization'].map(type=>`<option value="${type}" ${edge.type===type?'selected':''}>${useCaseRelationshipLabel(type)}</option>`).join('')}</select></label><div class="relationship-pair"><span>${escapeHtml(source?.title||'Origem')}</span><b>${['include','extend','generalization'].includes(edge.type)?'→':'—'}</b><span>${escapeHtml(target?.title||'Destino')}</span></div><p class="small-help">«include» aponta para o comportamento incluído; «extend» aponta para o caso base.</p></div>${edge.type==='extend'?`<div class="inspector-section"><h3>EXTENSÃO</h3><label class="field-label">Condição<textarea class="inspector-textarea" id="useCaseCondition" placeholder="Ex.: [cliente elegível]">${escapeHtml(edge.condition||'')}</textarea></label><label class="field-label">Ponto de extensão<select class="inspector-select" id="useCaseExtensionPoint"><option value="">Não especificado</option>${extensionPointOptions}</select></label></div>`:''}<div class="inspector-section"><h3>DOCUMENTAÇÃO</h3><textarea class="inspector-textarea" id="useCaseEdgeDoc" placeholder="Observações sobre a relação">${escapeHtml(edge.documentation||'')}</textarea></div><button class="inspector-action danger" id="deleteSelection">Excluir relacionamento</button>`;
      $('#useCaseEdgeType').addEventListener('change',event=>{snapshot();edge.type=event.target.value;renderEdges();renderInspector();save();});$('#useCaseCondition')?.addEventListener('input',event=>{edge.condition=event.target.value;save();});$('#useCaseExtensionPoint')?.addEventListener('change',event=>{snapshot();edge.extensionPoint=event.target.value;save();});$('#useCaseEdgeDoc').addEventListener('input',event=>{edge.documentation=event.target.value;save();});$('#deleteSelection').addEventListener('click',()=>requestDeleteSelection());return;
    }
    if(current().type==='conceitual'&&(nodeAt(edge.from)?.kind==='specialization'||nodeAt(edge.to)?.kind==='specialization')){
      const specialization=nodeAt(edge.from)?.kind==='specialization'?nodeAt(edge.from):nodeAt(edge.to),participant=nodeAt(edge.from)?.id===specialization.id?nodeAt(edge.to):nodeAt(edge.from);
      body.innerHTML=`<div class="inspector-section"><div class="eyebrow">ESPECIALIZAÇÃO ISA</div><h3>${escapeHtml(specialization.title)}</h3><p class="small-help">Defina o papel de ${escapeHtml(participant?.title||'participante')} nesta hierarquia.</p><label class="field-label">Papel<select class="inspector-select" id="specializationRole"><option value="" ${!['supertype','subtype'].includes(edge.role)?'selected':''}>Ainda não definido</option><option value="supertype" ${edge.role==='supertype'?'selected':''}>Supertipo</option><option value="subtype" ${edge.role==='subtype'?'selected':''}>Subtipo</option></select></label><label class="concept-field-flag"><input id="specializationTotal" type="checkbox" ${specialization.conceptual?.completeness==='total'?'checked':''}> Especialização total</label></div><button class="inspector-action danger" id="deleteSelection">Excluir conexão</button>`;
      $('#specializationRole').addEventListener('change',event=>{snapshot();edge.role=event.target.value;renderEdges();save();});$('#specializationTotal').addEventListener('change',event=>{snapshot();specialization.conceptual.completeness=event.target.checked?'total':'partial';save();});$('#deleteSelection').addEventListener('click',()=>requestDeleteSelection());return;
    }
    if (current().type === 'fluxo') {
      const source = nodeAt(edge.from), target = nodeAt(edge.to);
      const shaped = Boolean(edge.route?.corners?.length || Object.keys(edge.route?.curves || {}).length);
      body.innerHTML = `<div class="inspector-section"><div class="eyebrow">FLUXOGRAMA</div><h3 class="relationship-name">Conexão</h3><div class="relationship-pair"><span>${escapeHtml(source?.title || 'Origem')}</span><b>→</b><span>${escapeHtml(target?.title || 'Destino')}</span></div><label class="field-label">Rótulo da conexão<input class="inspector-input" id="flowEdgeLabel" value="${escapeHtml(edge.label||'')}" placeholder="Ex.: Sim, Não, erro"></label><label class="field-label">Direção<select class="inspector-select" id="flowDirection"><option value="forward" ${!edge.direction||edge.direction==='forward'?'selected':''}>Origem → destino</option><option value="backward" ${edge.direction==='backward'?'selected':''}>Destino → origem</option><option value="both" ${edge.direction==='both'?'selected':''}>Duas direções</option><option value="none" ${edge.direction==='none'?'selected':''}>Sem seta</option></select></label><label class="field-label">Cor da linha<input class="inspector-input flow-color" type="color" id="flowEdgeColor" value="${/^#[\da-f]{6}$/i.test(edge.color||'')?edge.color:'#7d89a4'}"></label><label class="field-label">Estilo da linha<select class="inspector-select" id="flowLineType"><option value="straight" ${edge.lineType!=='orthogonal'&&edge.lineType!=='curved'?'selected':''}>Reta</option><option value="orthogonal" ${edge.lineType==='orthogonal'?'selected':''}>Ortogonal</option><option value="curved" ${edge.lineType==='curved'?'selected':''}>Curva</option></select></label></div><div class="inspector-section"><h3>COMENTÁRIO</h3><label class="field-label" for="flowComment">Anotação da conexão</label><textarea class="inspector-textarea" id="flowComment" placeholder="Descreva esta etapa do fluxo...">${escapeHtml(edge.comment || '')}</textarea></div><div class="inspector-section"><h3>TRAÇADO</h3><p class="small-help">Dois cliques na linha criam um canto; dois cliques no ponto removem esse canto. Arraste a linha para curvar ou os pontos para ajustar.</p>${shaped ? '<button class="inspector-action" id="resetFlowRoute">Restaurar traçado automático</button>' : ''}</div><button class="inspector-action danger" id="deleteSelection">Excluir conexão</button>`;
      const endpointOptions=(selected,role)=>current().nodes.filter(node=>node.kind!=='start'||role!=='to').map(node=>`<option value="${escapeHtml(node.id)}" ${node.id===selected?'selected':''}>${escapeHtml(node.title)}</option>`).join('');
      body.querySelector('.relationship-pair')?.insertAdjacentHTML('afterend',`<div class="inspector-row"><label class="field-label">Origem<select class="inspector-select" id="flowEdgeFrom">${endpointOptions(edge.from,'from')}</select></label><label class="field-label">Destino<select class="inspector-select" id="flowEdgeTo">${endpointOptions(edge.to,'to')}</select></label></div>`);
      const reconnect=side=>{const next=$(`#flowEdge${side==='from'?'From':'To'}`).value,from=side==='from'?next:edge.from,to=side==='to'?next:edge.to;if(from===to)return toast('Origem e destino precisam ser elementos diferentes.');if(nodeAt(from)?.kind==='end')return toast('Um elemento Fim não pode iniciar uma conexão.');if(nodeAt(to)?.kind==='start')return toast('Uma conexão não pode entrar no Início.');if(current().edges.some(item=>item.id!==edge.id&&item.from===from&&item.to===to))return toast('Essa conexão já existe.');snapshot();edge[side]=next;edge.route={corners:[],curves:{}};renderEdges();renderInspector();save();};
      $('#flowEdgeFrom').addEventListener('change',()=>reconnect('from'));$('#flowEdgeTo').addEventListener('change',()=>reconnect('to'));
      $('#flowEdgeLabel').addEventListener('input',event=>{edge.label=event.target.value;renderEdges();save();});$('#flowDirection').addEventListener('change',event=>{snapshot();edge.direction=event.target.value;renderEdges();renderInspector();save();});$('#flowEdgeColor').addEventListener('input',event=>{edge.color=event.target.value;renderEdges();save();});$('#flowLineType').addEventListener('change',event=>{snapshot();edge.lineType=event.target.value;renderEdges();renderInspector();save();});
      $('#flowComment').addEventListener('input', event => { edge.comment = event.target.value; renderEdges(); save(); });
      $('#resetFlowRoute')?.addEventListener('click', () => { snapshot(); edge.route = {corners:[],curves:{}}; renderEdges(); renderInspector(); save(); });
      $('#deleteSelection').addEventListener('click', () => requestDeleteSelection());
      return;
    }
    normalizeEdge(edge);
    const source = nodeAt(edge.from), target = nodeAt(edge.to);
    if (current().type === 'logico' && source?.kind === 'table' && target?.kind === 'table') {
      renderLogicalRelationshipInspector(edge, body);
      return;
    }
    const endpoint = (side, title, min, max) => `<div class="endpoint-card"><div class="endpoint-heading"><span class="endpoint-dot ${side}"></span><strong>${escapeHtml(title || (side === 'from' ? 'Origem' : 'Destino'))}</strong><span class="endpoint-caption">${min}..${max}</span></div><label class="field-label" for="${side}Participation">Participação</label><select class="inspector-select" id="${side}Participation" data-endpoint="${side}" data-prop="Min"><option value="1" ${min === '1' ? 'selected' : ''}>Obrigatória · pelo menos 1</option><option value="0" ${min === '0' ? 'selected' : ''}>Opcional · pode ser 0</option></select><label class="field-label" for="${side}Maximum">Cardinalidade máxima</label><select class="inspector-select" id="${side}Maximum" data-endpoint="${side}" data-prop="Max"><option value="1" ${max === '1' ? 'selected' : ''}>Um · 1</option><option value="N" ${max === 'N' ? 'selected' : ''}>Muitos · N (pé de galinha)</option></select></div>`;
    const presets = [['1:1','1','1'],['1:N','1','N'],['N:1','N','1'],['N:N','N','N']];
    const preset = `${edge.fromMax}:${edge.toMax}`;
    body.innerHTML = `<div class="inspector-section"><h3>CARDINALIDADE</h3><div class="cardinality-presets">${presets.map(([label, from, to]) => `<button class="cardinality-preset ${preset === label ? 'active' : ''}" data-preset="${label}" title="Aplicar ${label}">${label}</button>`).join('')}</div><p class="small-help">Escolha uma relação pronta ou personalize cada extremidade.</p></div><div class="inspector-section connection-endpoints"><h3>PARTICIPAÇÃO POR LADO</h3>${endpoint('from', source?.title, edge.fromMin, edge.fromMax)}${endpoint('to', target?.title, edge.toMin, edge.toMax)}</div><div class="crowfoot-legend"><span class="legend-mark">○</span><span>círculo = opcional</span><span class="legend-mark">⋔</span><span>pé = muitos</span></div><p class="small-help">As mudanças atualizam a notação diretamente no diagrama.</p><button class="inspector-action danger" id="deleteSelection">Excluir conexão</button>`;
    body.querySelectorAll('[data-endpoint]').forEach(control => control.addEventListener('change', () => {
      snapshot(); edge[`${control.dataset.endpoint}${control.dataset.prop}`] = control.value;
      body.querySelectorAll('.cardinality-preset').forEach(button => button.classList.toggle('active', button.dataset.preset === `${edge.fromMax}:${edge.toMax}`));
      body.querySelector(`#${control.dataset.endpoint}Participation`)?.closest('.endpoint-card')?.querySelector('.endpoint-caption')?.replaceChildren(document.createTextNode(`${edge[`${control.dataset.endpoint}Min`]}..${edge[`${control.dataset.endpoint}Max`]}`));
      renderEdges(); save();
    }));
    body.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
      snapshot(); const [from, to] = button.dataset.preset.split(':'); edge.fromMin = '1'; edge.fromMax = from; edge.toMin = '1'; edge.toMax = to; renderInspector(); renderEdges(); save();
    }));
    $('#deleteSelection').addEventListener('click', () => requestDeleteSelection());
    return;
  }
  const entityOptions=['entity','associative'].includes(node.kind)?`<label class="field-label">Categoria<select class="inspector-select" id="conceptEntityKind"><option value="strong" ${node.conceptual?.entityKind!=='weak'?'selected':''}>Entidade forte</option><option value="weak" ${node.conceptual?.entityKind==='weak'?'selected':''}>Entidade fraca</option></select></label>${node.conceptual?.entityKind==='weak'?`<label class="field-label">Chave parcial<input class="inspector-input" id="conceptPartialKey" value="${escapeHtml(node.conceptual.partialKey||'')}" placeholder="Ex.: número do item"></label>`:''}`:'';
  const attributeOptions=node.kind==='attribute'?`<div class="inspector-section"><h3>SEMÂNTICA DO ATRIBUTO</h3><label class="field-label">Classificação<select class="inspector-select" id="conceptAttributeKind"><option value="simple" ${node.conceptual?.attributeKind==='simple'?'selected':''}>Simples</option><option value="composite" ${node.conceptual?.attributeKind==='composite'?'selected':''}>Composto</option><option value="multivalued" ${node.conceptual?.attributeKind==='multivalued'?'selected':''}>Multivalorado</option><option value="derived" ${node.conceptual?.attributeKind==='derived'?'selected':''}>Derivado</option></select></label><label class="field-label">Domínio conceitual<input class="inspector-input" id="conceptAttributeDomain" value="${escapeHtml(node.conceptual?.domain||'')}" placeholder="Ex.: data, moeda, texto"></label><label class="concept-field-flag"><input type="checkbox" id="conceptAttributeIdentifier" ${node.conceptual?.identifier?'checked':''}> Identificador</label><label class="concept-field-flag"><input type="checkbox" id="conceptAttributeRequired" ${node.conceptual?.required?'checked':''}> Obrigatório</label>${node.conceptual?.attributeKind==='derived'?`<label class="field-label">Regra de derivação<textarea class="inspector-textarea" id="conceptAttributeDerivation">${escapeHtml(node.conceptual?.derivation||'')}</textarea></label>`:''}</div>`:'';
  const specializationOptions=node.kind==='specialization'?`<div class="inspector-section"><h3>ESPECIALIZAÇÃO ISA</h3><label class="field-label">Cobertura<select class="inspector-select" id="conceptCompleteness"><option value="partial" ${node.conceptual?.completeness!=='total'?'selected':''}>Parcial</option><option value="total" ${node.conceptual?.completeness==='total'?'selected':''}>Total</option></select></label><label class="field-label">Exclusividade<select class="inspector-select" id="conceptDisjointness"><option value="disjoint" ${node.conceptual?.disjointness!=='overlapping'?'selected':''}>Disjunta</option><option value="overlapping" ${node.conceptual?.disjointness==='overlapping'?'selected':''}>Sobreposta</option></select></label><p class="small-help">Conecte um supertipo e pelo menos dois subtipos a este elemento ISA. Configure os papéis nas propriedades das conexões.</p></div>`:'';
  const conceptFields=current().type==='conceitual'&&['entity','associative'].includes(node.kind)?conceptualEntityAttributeEditor(node):'';
  const useCaseOptions=current().type==='usecase'&&node.kind==='actor'?`<div class="inspector-section"><h3>REPRESENTAÇÃO</h3><label class="field-label">Forma<select id="actorRepresentation" class="inspector-select"><option value="stick" ${node.representation!=='rect'?'selected':''}>Ator UML (figura)</option><option value="rect" ${node.representation==='rect'?'selected':''}>Retângulo «actor»</option></select></label><label class="field-label">Estereótipos<input id="useCaseStereotypes" class="inspector-input" value="${escapeHtml((node.stereotypes||[]).join(', '))}" placeholder="ex.: externalSystem"></label><label class="concept-field-flag"><input type="checkbox" id="actorAbstract" ${node.isAbstract?'checked':''}> Ator abstrato</label><label class="field-label">Restrições<textarea class="inspector-textarea" data-usecase-prop="constraints">${escapeHtml((node.constraints||[]).join('\n'))}</textarea></label></div>`:current().type==='usecase'&&node.kind==='useCase'?`<div class="inspector-section"><h3>ESPECIFICAÇÃO DO CASO DE USO</h3><label class="field-label">Objetivo<textarea class="inspector-textarea" data-usecase-doc="objective">${escapeHtml(node.objective||'')}</textarea></label><label class="field-label">Pré-condições<textarea class="inspector-textarea" data-usecase-doc="preconditions">${escapeHtml(node.preconditions||'')}</textarea></label><label class="field-label">Pós-condições de sucesso<textarea class="inspector-textarea" data-usecase-doc="postconditions">${escapeHtml(node.postconditions||'')}</textarea></label><label class="field-label">Garantias mínimas<textarea class="inspector-textarea" data-usecase-doc="minimumGuarantees">${escapeHtml(node.minimumGuarantees||'')}</textarea></label><label class="field-label">Fluxo principal<textarea class="inspector-textarea" data-usecase-doc="mainFlow" placeholder="Descreva os passos principais">${escapeHtml(node.mainFlow||'')}</textarea></label><h3>PONTOS DE EXTENSÃO</h3><div class="extension-point-list">${(node.extensionPoints||[]).map((point,index)=>`<div class="field-chip extension-point-editor"><input class="inspector-input" data-extension-point="${index}" aria-label="Nome do ponto de extensão ${index+1}" placeholder="Nome" value="${escapeHtml(point.name)}"><input class="inspector-input" data-extension-description="${index}" aria-label="Descrição do ponto de extensão ${index+1}" placeholder="Descrição" value="${escapeHtml(point.description||'')}"><button type="button" data-remove-extension-point="${index}" aria-label="Remover ponto de extensão">×</button></div>`).join('')}</div><button type="button" class="inspector-action" id="addExtensionPoint">＋ Adicionar ponto de extensão</button><label class="field-label">Estereótipos<input class="inspector-input" data-usecase-prop="stereotypes" value="${escapeHtml((node.stereotypes||[]).join(', '))}" placeholder="ex.: critical"></label><label class="field-label">Restrições<textarea class="inspector-textarea" data-usecase-prop="constraints">${escapeHtml((node.constraints||[]).join('\n'))}</textarea></label></div>`:'';
  const useCaseAppearance=current().type==='usecase'?`<div class="inspector-section"><h3>APARÊNCIA</h3><label class="field-label" for="useCaseFillColor">Cor de fundo</label><div class="inspector-color-control"><input class="inspector-input inspector-color-input" id="useCaseFillColor" type="color" value="${validTableColor(node.fillColor)?node.fillColor:'#ffffff'}" aria-label="Cor de fundo do elemento"><button class="inspector-action" id="clearUseCaseFill" type="button" ${validTableColor(node.fillColor)?'':'disabled'}>Remover cor</button></div><p class="small-help">A cor é aplicada somente a este elemento.</p></div>`:'';
  const useCaseTrace=current().type==='usecase'&&node.kind==='useCase'?(()=>{const refs=node.traceability||[],activities=loadActivityProjects().flatMap(project=>project.diagrams.map(diagram=>({kind:'uml-activity',projectId:project.id,diagramId:diagram.id,name:diagram.name,project:project.title}))),classes=loadClassProjects().flatMap(project=>project.diagrams.map(diagram=>({kind:'uml-class',projectId:project.id,diagramId:diagram.id,name:diagram.name,project:project.title}))),all=[...activities,...classes];return `<div class="inspector-section"><h3>RASTREABILIDADE UML</h3><label class="field-label">Atividades e diagramas de classes<select id="useCaseTraceability" class="inspector-select" multiple size="5">${all.map(ref=>{const key=`${ref.kind}:${ref.projectId}:${ref.diagramId}`;return `<option value="${escapeHtml(key)}" ${refs.some(item=>`${item.kind}:${item.projectId}:${item.diagramId}`===key)?'selected':''}>${escapeHtml(ref.name)} · ${escapeHtml(ref.project||'Projeto UML')}</option>`}).join('')}</select></label><p class="small-help">As ligações registram rastreabilidade. Elas não criam relações UML automaticamente.</p><div class="trace-links">${refs.map(ref=>{const known=all.find(item=>item.kind===ref.kind&&item.projectId===ref.projectId&&item.diagramId===ref.diagramId);return known?`<button type="button" class="inspector-action" data-open-trace="${escapeHtml(`${ref.kind}:${ref.projectId}:${ref.diagramId}`)}">Abrir ${escapeHtml(known.name)} ↗</button>`:`<small>Referência indisponível: ${escapeHtml(ref.diagramId)}</small>`}).join('')}</div></div>`})():'';
  const iStarActorKinds=['istarBoundary','istarAgent','istarRole'].includes(node.kind),iStarDefs=current().istar?.stereotypes||[],iStarApplicable=iStarDefs.filter(item=>item.appliesTo==='all'||(item.appliesTo==='actor'&&iStarActorKinds)||item.appliesTo===node.kind);
  const iStarOptions=current().type==='istar'?`<div class="inspector-section"><h3>MODELO iSTAR</h3>${iStarActorKinds?`<label class="field-label">Visualização deste ator<select id="istarActorView" class="inspector-select"><option value="SR" ${!actorCollapsed(current(),node)?'selected':''}>Expandido · SR</option><option value="SD" ${actorCollapsed(current(),node)?'selected':''}>Recolhido · SD</option></select></label>`:''}${node.kind==='istarBoundary'?`<label class="field-label">Tipo de ator<select class="inspector-select" id="istarActorType">${[['actor','Ator'],['agent','Agente'],['role','Papel']].map(([value,label])=>`<option value="${value}" ${(node.istar?.actorType||'actor')===value?'selected':''}>${label}</option>`).join('')}</select></label>`:''}${['istarGoal','istarQuality','istarTask','istarResource'].includes(node.kind)?`<label class="field-label">Ator proprietário<select class="inspector-select" id="istarOwner"><option value="">Sem ator atribuído</option>${current().nodes.filter(item=>['istarBoundary','istarAgent','istarRole'].includes(item.kind)).map(item=>`<option value="${escapeHtml(item.id)}" ${node.istar?.ownerId===item.id?'selected':''}>${escapeHtml(item.title)}</option>`).join('')}</select></label>`:''}<label class="field-label">Estereótipo SVG<select class="inspector-select" id="istarAppliedStereotype"><option value="">Nenhum</option>${iStarApplicable.map(item=>`<option value="${escapeHtml(item.id)}" ${node.istar?.stereotypeId===item.id?'selected':''}>${escapeHtml(item.name)}</option>`).join('')}</select></label><p class="small-help">Os SVGs cadastrados aparecem aqui conforme o tipo do elemento.</p></div>`:'';
  body.innerHTML = `<div class="inspector-section"><h3>ELEMENTO</h3><label class="field-label" for="inspectorTitle">Nome</label><input class="inspector-input" id="inspectorTitle" value="${escapeHtml(node.title)}"><div class="inspector-row"><div><label class="field-label">Tipo</label><input class="inspector-input" value="${escapeHtml(labels[node.kind] || node.kind)}" disabled></div></div>${entityOptions}${node.kind==='systemBoundary'||node.kind==='useCase'?`<div class="inspector-row"><label class="field-label">Largura<input class="inspector-input" id="boundaryWidth" type="number" min="${node.kind==='useCase'?150:250}" value="${Number(node.width)||(node.kind==='useCase'?210:480)}"></label><label class="field-label">Altura<input class="inspector-input" id="boundaryHeight" type="number" min="${node.kind==='useCase'?70:180}" value="${Number(node.height)||(node.kind==='useCase'?86:360)}"></label></div>`:`<label class="field-label" for="inspectorDescription">Descrição</label><textarea class="inspector-textarea" id="inspectorDescription" placeholder="Adicione uma observação...">${escapeHtml(node.description || '')}</textarea>`}</div>${useCaseAppearance}${useCaseOptions}${current().type==='usecase'&&node.kind==='useCase'?`<div class="inspector-section"><h3>FLUXOS E RASTREABILIDADE</h3><label class="field-label">Gatilho<textarea class="inspector-textarea" data-usecase-doc="trigger">${escapeHtml(node.trigger||'')}</textarea></label><label class="field-label">Fluxos alternativos<textarea class="inspector-textarea" data-usecase-doc="alternateFlow">${escapeHtml(node.alternateFlow||'')}</textarea></label><label class="field-label">Exceções<textarea class="inspector-textarea" data-usecase-doc="exceptionFlow">${escapeHtml(node.exceptionFlow||'')}</textarea></label><label class="field-label">Regras de negócio<textarea class="inspector-textarea" data-usecase-doc="businessRules">${escapeHtml(node.businessRules||'')}</textarea></label><label class="field-label">Requisitos relacionados<textarea class="inspector-textarea" data-usecase-doc="requirementRefs">${escapeHtml(node.requirementRefs||'')}</textarea></label><label class="field-label">Prioridade<select class="inspector-select" data-usecase-doc="priority"><option value="" ${!node.priority?'selected':''}>Não definida</option>${['Baixa','Média','Alta','Crítica'].map(value=>`<option ${node.priority===value?'selected':''}>${value}</option>`).join('')}</select></label><label class="field-label">Status<select class="inspector-select" data-usecase-doc="status"><option value="" ${!node.status?'selected':''}>Não definido</option>${['Proposto','Aprovado','Em desenvolvimento','Validado','Obsoleto'].map(value=>`<option ${node.status===value?'selected':''}>${value}</option>`).join('')}</select></label></div>`:''}${useCaseTrace}${iStarOptions}${node.kind === 'table' ? tableFieldEditor(node) + tableColorEditor(node) : conceptFields || (['entity','associative'].includes(node.kind) ? `<div class="inspector-section"><h3>ATRIBUTOS</h3><div id="fieldList">${(node.fields || []).map((f, i) => `<div class="field-chip"><input class="inspector-input" data-field="${i}" aria-label="Atributo ${i+1}" value="${escapeHtml(f)}"><button data-remove-field="${i}" aria-label="Remover atributo">×</button></div>`).join('')}</div><button class="inspector-action" id="addField">＋ Adicionar atributo</button></div>` : '')}${attributeOptions}${specializationOptions}<div class="inspector-section"><h3>ORGANIZAÇÃO</h3><div class="inspector-row"><div><label class="field-label" for="positionX">Posição X</label><input class="inspector-input" id="positionX" type="number" value="${Math.round(node.x)}"></div><div><label class="field-label" for="positionY">Posição Y</label><input class="inspector-input" id="positionY" type="number" value="${Math.round(node.y)}"></div></div><button class="inspector-action danger" id="deleteSelection">Excluir elemento</button></div>`;
  if(current().type==='fluxo'){body.insertAdjacentHTML('beforeend',flowNodeInspectorMarkup(node));bindFlowNodeInspector(node,body);}
  body.querySelector('[data-table-advanced]')?.addEventListener('toggle',event=>{if(event.target.open)expandedAdvancedTables.add(node.id);else expandedAdvancedTables.delete(node.id);});
  body.querySelectorAll('[data-field-config]').forEach(details=>details.addEventListener('toggle',()=>{const id=details.dataset.fieldConfig;if(details.open)expandedLogicalFieldId=id;else if(expandedLogicalFieldId===id)expandedLogicalFieldId=null;}));
  updateTableFieldNameValidation(node,body);
  body.querySelectorAll('[data-duplicate-field]').forEach(button=>button.addEventListener('click',()=>{const index=Number(button.dataset.duplicateField),source=node.fields[index];if(!source)return;snapshot();let name=`${source.name}_copia`,suffix=2;while(node.fields.some(field=>field.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')))name=`${source.name}_copia_${suffix++}`;const clone={...source,id:uid('c'),name,key:'',nullable:true,unique:false,identity:false,references:undefined};delete clone.references;node.fields.splice(index+1,0,clone);renderInspector();renderNodes();renderPalette();save();$(`[data-field-name="${index+1}"]`)?.focus();}));
  let draggingField=null;
  body.querySelectorAll('[data-field-row]').forEach(row=>{row.addEventListener('dragstart',event=>{if(!event.target.closest('[data-field-drag]')){event.preventDefault();return;}draggingField=Number(row.dataset.fieldRow);row.classList.add('dragging');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(draggingField));});row.addEventListener('dragover',event=>{if(draggingField===null)return;event.preventDefault();row.classList.add('drop-target');});row.addEventListener('dragleave',()=>row.classList.remove('drop-target'));row.addEventListener('drop',event=>{if(draggingField===null)return;event.preventDefault();const source=draggingField,target=Number(row.dataset.fieldRow);draggingField=null;reorderTableField(node,source,target);});row.addEventListener('dragend',()=>{draggingField=null;body.querySelectorAll('.dragging,.drop-target').forEach(item=>item.classList.remove('dragging','drop-target'));});});
  body.querySelectorAll('[data-field-drag]').forEach(handle=>handle.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const source=Number(handle.closest('[data-field-row]').dataset.fieldRow),target=source+(event.key==='ArrowUp'?-1:1);reorderTableField(node,source,target);}));
  body.querySelectorAll('[data-move-field]').forEach(button=>button.addEventListener('click',()=>{const source=Number(button.dataset.fieldIndex),target=source+(button.dataset.moveField==='up'?-1:1);reorderTableField(node,source,target);}));
  body.querySelectorAll('[data-open-field-config]').forEach(button=>button.addEventListener('click',()=>{button.closest('.table-field-actions').open=false;const row=button.closest('[data-field-row]'),details=row?.querySelector('[data-field-config]');if(details){expandedLogicalFieldId=details.dataset.fieldConfig;details.open=true;details.scrollIntoView({block:'nearest',behavior:'smooth'});}}));
  $('#inspectorTitle').addEventListener('input', e => { node.title = e.target.value; renderNodes(); if (node.kind === 'table') renderPalette(); save(); });
  $('#istarActorView')?.addEventListener('change',e=>{snapshot();node.istar.collapsed=e.target.value==='SD';renderNodes();renderEdges();save();});
  $('#istarActorType')?.addEventListener('change',e=>{snapshot();node.istar.actorType=e.target.value;renderNodes();save();});
  $('#istarOwner')?.addEventListener('change',e=>{snapshot();node.istar.ownerId=e.target.value||null;if(node.istar.ownerId){const owner=nodeAt(node.istar.ownerId);node.x=owner.x+40;node.y=owner.y+100;placeIStarElement(current(),node,owner.id);}renderNodes();renderEdges();save();});
  $('#istarAppliedStereotype')?.addEventListener('change',e=>{snapshot();node.istar.stereotypeId=e.target.value||null;renderNodes();save();});
  $('#inspectorDescription')?.addEventListener('input', e => { node.description = e.target.value; renderNodes(); save(); });
  const setUseCaseFill=color=>{if(!validTableColor(color))return;snapshot();node.fillColor=color;renderNodes();renderEdges();renderInspector();save();};
  $('#useCaseFillColor')?.addEventListener('change',event=>setUseCaseFill(event.target.value));
  $('#clearUseCaseFill')?.addEventListener('click',()=>{if(!node.fillColor)return;snapshot();delete node.fillColor;renderNodes();renderEdges();renderInspector();save();});
  $('#actorRepresentation')?.addEventListener('change',event=>{snapshot();node.representation=event.target.value;renderNodes();save();});$('#useCaseStereotypes')?.addEventListener('input',event=>{node.stereotypes=event.target.value.split(',').map(value=>value.trim()).filter(Boolean);renderNodes();save();});
  $('#actorAbstract')?.addEventListener('change',event=>{snapshot();node.isAbstract=event.target.checked;renderNodes();save();});
  body.querySelectorAll('[data-usecase-doc]').forEach(control=>control.addEventListener(control.tagName==='SELECT'?'change':'input',event=>{node[event.target.dataset.usecaseDoc]=event.target.value;save();}));body.querySelectorAll('[data-usecase-prop]').forEach(control=>control.addEventListener('input',event=>{const key=event.target.dataset.usecaseProp;node[key]=key==='stereotypes'?event.target.value.split(',').map(value=>value.trim()).filter(Boolean):event.target.value.split('\n').filter(Boolean);save();}));
  $('#useCaseTraceability')?.addEventListener('change',event=>{snapshot();node.traceability=[...event.target.selectedOptions].map(option=>{const[kind,projectId,diagramId]=option.value.split(':');return{kind,projectId,diagramId};});renderInspector();save();});body.querySelectorAll('[data-open-trace]').forEach(button=>button.addEventListener('click',()=>{const[kind,projectId,diagramId]=button.dataset.openTrace.split(':');if(kind==='uml-activity')openActivityDiagram(projectId,diagramId);else openClassDiagram(projectId,diagramId);switchView('editor');}));
  $('#addExtensionPoint')?.addEventListener('click',()=>{snapshot();node.extensionPoints||=[];node.extensionPoints.push({id:uid('ep'),name:`ponto_${node.extensionPoints.length+1}`,description:''});renderNodes();renderInspector();save();});body.querySelectorAll('[data-extension-point]').forEach(control=>control.addEventListener('input',event=>{node.extensionPoints[Number(event.target.dataset.extensionPoint)].name=event.target.value;renderNodes();save();}));body.querySelectorAll('[data-extension-description]').forEach(control=>control.addEventListener('input',event=>{node.extensionPoints[Number(event.target.dataset.extensionDescription)].description=event.target.value;save();}));body.querySelectorAll('[data-remove-extension-point]').forEach(button=>button.addEventListener('click',()=>{snapshot();node.extensionPoints.splice(Number(button.dataset.removeExtensionPoint),1);renderNodes();renderInspector();save();}));
  for(const axis of ['Width','Height'])$(`#boundary${axis}`)?.addEventListener('change',event=>{snapshot();const min=node.kind==='useCase'?(axis==='Width'?150:70):(axis==='Width'?250:180);node[axis.toLowerCase()]=Math.max(min,Number(event.target.value)||0);renderNodes();renderEdges();save();});
  ['X','Y'].forEach(axis => $(`#position${axis}`).addEventListener('change', e => {
    snapshot();const key=axis.toLowerCase(),before=node[key];node[key]=Math.max(0,Number(e.target.value)||0);
    if(current().type==='istar'){
      if(isIStarActor(node)){if(node.istar?.layoutOrigin)node.istar.layoutOrigin[key]+=node[key]-before;for(const child of current().nodes.filter(n=>n.istar?.ownerId===node.id))child[key]+=node[key]-before;}
      else clampIStarElement(current(),node);
      e.target.value=node[key];
    }
    renderNodes();renderEdges();save();
  }));
  body.querySelectorAll('[data-field]').forEach(el => el.addEventListener('input', e => { node.fields[Number(el.dataset.field)] = e.target.value; renderNodes(); save(); }));
  body.querySelectorAll('[data-concept-attr-name],[data-concept-attr-domain],[data-concept-attr-derivation]').forEach(el=>el.addEventListener('change',()=>{const index=Number(el.dataset.conceptAttrName??el.dataset.conceptAttrDomain??el.dataset.conceptAttrDerivation),field=node.fields[index];if(!field)return;snapshot();if(el.hasAttribute('data-concept-attr-name'))field.name=el.value;else if(el.hasAttribute('data-concept-attr-domain'))field.domain=el.value;else field.derivation=el.value;renderNodes();save();}));
  body.querySelectorAll('[data-concept-attr-kind]').forEach(el=>el.addEventListener('change',()=>{const field=node.fields[Number(el.dataset.conceptAttrKind)];if(!field)return;snapshot();field.kind=el.value;renderInspector();renderNodes();save();}));
  body.querySelectorAll('[data-concept-attr-parent]').forEach(el=>el.addEventListener('change',()=>{const field=node.fields[Number(el.dataset.conceptAttrParent)];if(field){snapshot();field.parentId=el.value||null;renderNodes();save();}}));
  body.querySelectorAll('[data-concept-attr-identifier],[data-concept-attr-required]').forEach(el=>el.addEventListener('change',()=>{const index=Number(el.dataset.conceptAttrIdentifier??el.dataset.conceptAttrRequired),field=node.fields[index];if(!field)return;snapshot();if(el.hasAttribute('data-concept-attr-identifier'))field.identifier=el.checked;else field.required=el.checked;renderNodes();save();}));
  body.querySelectorAll('[data-add-concept-attribute]').forEach(button=>button.addEventListener('click',()=>{snapshot();node.fields||=[];node.fields.push({id:uid('a'),name:'novo_atributo',kind:'simple',domain:'',required:false,identifier:false,derivation:'',parentId:null});renderInspector();renderNodes();save();body.querySelector(`[data-concept-attr-name="${node.fields.length-1}"]`)?.focus();}));
  body.querySelectorAll('[data-owned-attribute]').forEach(button=>button.addEventListener('click',()=>{selectedId=button.dataset.ownedAttribute;selectedEdge=null;selectedIds=new Set([selectedId]);renderNodes();renderInspector();}));
  $('#addOwnedConceptualAttribute')?.addEventListener('click',()=>addOwnedConceptualAttribute(node.id));
  if(current().type==='conceitual')bindConceptualRules(node,body);
  $('#conceptEntityKind')?.addEventListener('change',event=>{snapshot();node.conceptual.entityKind=event.target.value;renderInspector();renderNodes();save();});
  $('#conceptPartialKey')?.addEventListener('change',event=>{snapshot();node.conceptual.partialKey=event.target.value.trim();save();});
  $('#conceptAttributeKind')?.addEventListener('change',event=>{snapshot();node.conceptual.attributeKind=event.target.value;renderInspector();renderNodes();save();});
  $('#conceptAttributeDomain')?.addEventListener('change',event=>{snapshot();node.conceptual.domain=event.target.value.trim();save();});
  $('#conceptAttributeDerivation')?.addEventListener('change',event=>{snapshot();node.conceptual.derivation=event.target.value.trim();save();});
  $('#conceptAttributeIdentifier')?.addEventListener('change',event=>{snapshot();node.conceptual.identifier=event.target.checked;renderNodes();save();});
  $('#conceptAttributeRequired')?.addEventListener('change',event=>{snapshot();node.conceptual.required=event.target.checked;save();});
  $('#conceptCompleteness')?.addEventListener('change',event=>{snapshot();node.conceptual.completeness=event.target.value;save();});
  $('#conceptDisjointness')?.addEventListener('change',event=>{snapshot();node.conceptual.disjointness=event.target.value;save();});
  body.querySelectorAll('[data-field-name]').forEach(el => {
    el.addEventListener('focus',()=>{el.dataset.originalValue=node.fields[Number(el.dataset.fieldName)].name;});
    el.addEventListener('blur',()=>{delete el.dataset.editSnapshot;delete el.dataset.originalValue;});
    el.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();el.blur();}else if(event.key==='Escape'){event.preventDefault();const index=Number(el.dataset.fieldName),field=node.fields[index];if(!field)return;field.name=el.dataset.originalValue??field.name;if(el.dataset.editSnapshot&&history.at(-1)===el.dataset.editSnapshot)history.pop();future=[];updateHistoryButtons();renderInspector();renderNodes();renderPalette();save();}});
    el.addEventListener('input', e => {if(!el.dataset.editSnapshot){el.dataset.editSnapshot=JSON.stringify(state);snapshot();}node.fields[Number(el.dataset.fieldName)].name=e.target.value;updateTableFieldNameValidation(node,body);renderNodes();save();});
  });
  body.querySelectorAll('[data-field-size],[data-field-default],[data-field-check],[data-field-description]').forEach(el=>{
    el.addEventListener('focus',()=>{el.dataset.originalValue=el.value;});
    el.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();el.blur();}else if(event.key==='Escape'){event.preventDefault();el.value=el.dataset.originalValue??el.value;el.blur();}});
    el.addEventListener('blur',()=>delete el.dataset.originalValue);
  });
  body.querySelectorAll('[data-field-type]').forEach(el => el.addEventListener('change', e => {
    const field = node.fields[Number(el.dataset.fieldType)];
    snapshot(); field.type = e.target.value;
    field.size = sizedTypes.has(field.type) ? (field.type === 'CHAR' ? 1 : field.type === 'TEXT' ? 255 : 45) : null;
    renderInspector(); renderNodes(); renderPalette(); save();
  }));
  body.querySelectorAll('[data-field-enum-values]').forEach(el=>{
    el.addEventListener('focus',()=>{if(!el.dataset.editSnapshot){el.dataset.editSnapshot=JSON.stringify(state);snapshot();}});
    el.addEventListener('blur',()=>delete el.dataset.editSnapshot);
    el.addEventListener('input',event=>{
      const field=node.fields[Number(el.dataset.fieldEnumValues)];if(!field)return;
      field.enumValues=event.target.value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
      renderNodes();save();
    });
  });
  body.querySelectorAll('[data-field-size]').forEach(el => el.addEventListener('change', e => {
    const size = Number(e.target.value);
    if (e.target.value && (!Number.isInteger(size) || size < 1 || size > 65535)) { toast('Informe um tamanho entre 1 e 65535'); e.target.value = node.fields[Number(el.dataset.fieldSize)].size || ''; return; }
    snapshot(); node.fields[Number(el.dataset.fieldSize)].size = e.target.value ? size : null;
    renderNodes(); renderPalette(); save();
  }));
  for (const [selector, prop] of [['[data-field-pk]', 'data-field-pk'], ['[data-field-fk]', 'data-field-fk'], ['[data-field-nullable]', 'data-field-nullable'], ['[data-field-unique]', 'data-field-unique'], ['[data-field-identity]', 'data-field-identity'], ['[data-field-multivalued]', 'data-field-multivalued'], ['[data-field-default]', 'data-field-default'], ['[data-field-check]', 'data-field-check'], ['[data-field-description]', 'data-field-description']]) {
    body.querySelectorAll(selector).forEach(el => el.addEventListener(el.type === 'checkbox' ? 'change' : 'change', event => {
      const index = Number(el.getAttribute(prop)); const field = node.fields[index]; if (!field) return;
      if (prop === 'data-field-pk') { snapshot(); field.key = event.target.checked ? 'PK' : (field.references ? 'FK' : ''); field.nullable = event.target.checked ? false : field.nullable; }
      else if (prop === 'data-field-fk') { snapshot(); if (event.target.checked) { field.key = field.key === 'PK' ? 'PK' : 'FK'; field.references ||= {}; expandedLogicalFieldId=field.id||String(index); } else { field.key = field.key === 'FK' ? '' : field.key; delete field.references; } }
      else if (prop === 'data-field-nullable') { const isPrimary=field.key==='PK'||node.primaryKey?.includes(field.id)||node.primaryKey?.includes(field.name);if(isPrimary&&!event.target.checked){event.target.checked=true;toast('Uma chave primária não pode aceitar NULL');return;}snapshot();field.nullable=!event.target.checked; }
      else { snapshot(); const name = prop.slice('data-field-'.length); field[name === 'default' ? 'defaultValue' : name === 'multivalued' ? 'multivalued' : name] = el.type === 'checkbox' ? event.target.checked : event.target.value; }
      if (prop === 'data-field-pk') node.primaryKey = node.fields.filter(item => item.key === 'PK').map(item => item.id || item.name);
      if(prop==='data-field-fk'){renderInspector();renderNodes();renderPalette();save();return;}
      refreshTableFieldBadges(node,body);renderNodes(); renderPalette(); save();
    }));
  }
  body.querySelectorAll('[data-fk-table]').forEach(select=>select.addEventListener('change',event=>{
    const field=node.fields[Number(select.dataset.fkTable)],table=current().nodes.find(item=>item.id===event.target.value&&item.kind==='table');if(!field)return;
    snapshot();field.references={...(field.references||{}),tableId:table?.id||null};delete field.references.columnId;delete field.references.columnName;
    expandedLogicalFieldId=field.id||String(Number(select.dataset.fkTable));renderInspector();renderNodes();renderPalette();save();
  }));
  body.querySelectorAll('[data-fk-column]').forEach(select=>select.addEventListener('change',event=>{
    const field=node.fields[Number(select.dataset.fkColumn)],table=current().nodes.find(item=>item.id===field?.references?.tableId&&item.kind==='table'),column=table?.fields.find(item=>(item.id||item.name)===event.target.value);if(!field||!table)return;
    snapshot();field.references={...(field.references||{}),tableId:table.id};
    if(column){field.references.columnId=column.id||column.name;field.references.columnName=column.name;}else{delete field.references.columnId;delete field.references.columnName;}
    expandedLogicalFieldId=field.id||String(Number(select.dataset.fkColumn));renderInspector();renderNodes();renderPalette();save();
  }));
  $('#tableSchema')?.addEventListener('change', event => { snapshot(); node.schema = event.target.value.trim(); save(); });
  $('#addFunctionalDependency')?.addEventListener('click',()=>{
    if(node.fields.length<2)return toast('Adicione ao menos duas colunas para descrever a dependência');
    const selector=(side)=>`<fieldset class="fd-fieldset"><legend>${side==='determinant'?'Determinante':'Atributos dependentes'}</legend>${node.fields.map(field=>`<label><input type="checkbox" data-fd-${side} value="${escapeHtml(field.id||field.name)}"> ${escapeHtml(field.name)}</label>`).join('')}</fieldset>`;
    showModal('Dependência funcional',`<p class="modal-copy">Informe quais atributos determinam outros. A análise usa apenas as dependências cadastradas.</p><div class="fd-columns">${selector('determinant')}${selector('dependent')}</div>`,'Salvar dependência',()=>{
      const determinant=[...modal.querySelectorAll('[data-fd-determinant]:checked')].map(input=>input.value),dependent=[...modal.querySelectorAll('[data-fd-dependent]:checked')].map(input=>input.value);
      if(!determinant.length||!dependent.length)return toast('Selecione colunas dos dois lados da dependência');
      snapshot();node.functionalDependencies||=[];node.functionalDependencies.push({determinant,dependent});renderInspector();save();
    });
  });
  body.querySelectorAll('[data-remove-fd]').forEach(button=>button.addEventListener('click',()=>{snapshot();node.functionalDependencies.splice(Number(button.dataset.removeFd),1);renderInspector();save();}));
  $('#addTableConstraint')?.addEventListener('click', () => {
    if (node.fields.length < 1) return toast('Adicione colunas antes da restrição');
    showModal('UNIQUE composta', `<p class="modal-copy">Escolha as colunas cuja combinação deve ser única.</p><div class="constraint-columns">${node.fields.map(field => `<label><input type="checkbox" value="${escapeHtml(field.id || field.name)}"> ${escapeHtml(field.name)}</label>`).join('')}</div><label class="field-label">Nome da restrição<input class="inspector-input" id="constraintName" placeholder="uq_${escapeHtml(node.title)}"></label>`, 'Adicionar UNIQUE', () => {
      const selected = [...modal.querySelectorAll('.constraint-columns input:checked')].map(input => input.value);
      if (!selected.length) return toast('Escolha ao menos uma coluna');
      snapshot(); node.constraints ||= []; node.constraints.push({type:'UNIQUE',name:$('#constraintName').value.trim(),columns:selected}); renderInspector(); save();
    });
  });
  $('#addTableIndex')?.addEventListener('click',()=>{
    if(!node.fields.length)return toast('Adicione colunas antes do índice');
    showModal('Planejar índice',`<p class="modal-copy">Escolha as colunas do índice e informe se a combinação deve ser única.</p><div class="constraint-columns">${node.fields.map(field=>`<label><input type="checkbox" value="${escapeHtml(field.id||field.name)}"> ${escapeHtml(field.name)}</label>`).join('')}</div><label class="field-label">Nome<input class="inspector-input" id="indexName" placeholder="idx_${escapeHtml(node.title)}"></label><label class="fd-fieldset"><span><input type="checkbox" id="indexUnique"> Índice único</span></label>`,'Criar índice',()=>{
      const columns=[...modal.querySelectorAll('.constraint-columns input:checked')].map(input=>input.value);if(!columns.length)return toast('Escolha ao menos uma coluna');
      snapshot();node.indexes||=[];node.indexes.push({name:$('#indexName').value.trim(),columns,unique:$('#indexUnique').checked});renderInspector();save();
    });
  });
  const setTableColor = color => { if (!validTableColor(color)) return; snapshot(); node.color = color; renderNodes(); renderInspector(); save(); };
  $('#tableColor')?.addEventListener('change', e => setTableColor(e.target.value));
  body.querySelectorAll('[data-table-color]').forEach(el => el.addEventListener('click', () => setTableColor(el.dataset.tableColor)));
  body.querySelectorAll('[data-remove-field]').forEach(el => el.addEventListener('click', () => {
    const index = Number(el.dataset.removeField);
    const field = node.fields[index];
    const name = node.kind === 'table' || (field&&typeof field==='object') ? field.name : String(field);
    const dependentCount=node.kind==='table'?current().nodes.reduce((count,table)=>count+(table.fields||[]).filter(item=>item.references?.tableId===node.id&&(item.references.columnId===(field.id||field.name)||item.references.columnName===field.name)).length,0):0;
    showModal('Excluir campo?', `<p class="modal-copy">Tem certeza de que deseja excluir <strong>${escapeHtml(name)}</strong>?${dependentCount?` A ação também removerá ${dependentCount} chave(s) estrangeira(s) que referenciam este campo.`:''}</p>`, 'Excluir', () => {
      snapshot(); if(node.kind==='table')cleanLogicalReferences(node,field);if(field&&typeof field==='object')node.fields.forEach(candidate=>{if(candidate.parentId===field.id)candidate.parentId=null;});node.fields.splice(index, 1);node.primaryKey=(node.primaryKey||[]).filter(id=>id!==(field.id||field.name)&&id!==field.name);node.constraints=(node.constraints||[]).filter(item=>!(item.columns||[]).includes(field.id||field.name)&&!(item.columns||[]).includes(field.name));node.indexes=(node.indexes||[]).filter(item=>!(item.columns||[]).includes(field.id||field.name)&&!(item.columns||[]).includes(field.name));node.functionalDependencies=(node.functionalDependencies||[]).filter(fd=>![...(fd.determinant||[]),...(fd.dependent||[])].includes(field.id||field.name)&&![...(fd.determinant||[]),...(fd.dependent||[])].includes(field.name));renderInspector(); renderNodes(); if (node.kind === 'table') renderPalette(); save();
    });
  }));
  $('#addField')?.addEventListener('click', () => { snapshot(); node.fields.push(node.kind === 'table' ? {id:uid('c'),name:'novo_campo', type:'VARCHAR', size:45, key:''} : current().type==='conceitual'?{id:uid('a'),name:'novo_atributo',kind:'simple',domain:'',required:false,identifier:false,derivation:'',parentId:null}:'novo_atributo'); renderInspector(); renderNodes(); if (node.kind === 'table') renderPalette(); save(); const inputs = body.querySelectorAll('[data-field-name], [data-field]'); inputs[inputs.length - 1]?.focus(); });
  $('#deleteSelection').addEventListener('click', () => requestDeleteSelection());
}
function relationshipEnds(relationship) {
  return current().edges.flatMap(edge => {
    normalizeEdge(edge);
    if (edge.from === relationship.id) {
      const other = nodeAt(edge.to);
      return other ? [{edge, side:'to', node:other}] : [];
    }
    if (edge.to === relationship.id) {
      const other = nodeAt(edge.from);
      return other ? [{edge, side:'from', node:other}] : [];
    }
    return [];
  }).sort((a,b) => a.node.x - b.node.x);
}
function renderRelationshipInspector(relationship, body) {
  const ends = relationshipEnds(relationship);
  const presets = [['1:1','1','1'],['1:N','1','N'],['N:1','N','1'],['N:N','N','N']];
  const endView = (entry,index) => {
    const min = entry.edge[`${entry.side}Min`], max = entry.edge[`${entry.side}Max`];
    const side = `relationEnd${index}`;
    return `<div class="endpoint-card"><div class="endpoint-heading"><span class="endpoint-dot ${index ? 'to' : 'from'}"></span><strong>${escapeHtml(entry.node.title)}</strong><span class="endpoint-caption">${min}..${max}</span><button type="button" class="endpoint-remove" data-remove-participant="${index}" aria-label="Remover participante">×</button></div><label class="field-label">Papel<input class="inspector-input" data-relation-role="${index}" value="${escapeHtml(entry.edge.role||'')}" placeholder="Ex.: supervisor"></label><label class="field-label" for="${side}Participation">Participação</label><select class="inspector-select" id="${side}Participation" data-relation-side="${index}" data-prop="Min"><option value="1" ${min === '1' ? 'selected' : ''}>Obrigatória · pelo menos 1</option><option value="0" ${min === '0' ? 'selected' : ''}>Opcional · pode ser 0</option></select><label class="field-label" for="${side}Maximum">Cardinalidade máxima</label><select class="inspector-select" id="${side}Maximum" data-relation-side="${index}" data-prop="Max"><option value="1" ${max === '1' ? 'selected' : ''}>Um · 1</option><option value="N" ${max === 'N' ? 'selected' : ''}>Muitos · N (pé de galinha)</option></select><label class="concept-field-flag"><input type="checkbox" data-relation-total="${index}" ${entry.edge.totalParticipation?'checked':''}> Participação total (Chen)</label></div>`;
  };
  const preset = ends.length >= 2 ? `${ends[0].edge[`${ends[0].side}Max`]}:${ends[1].edge[`${ends[1].side}Max`]}` : '';
  const pair = ends.length >= 2
    ? `<div class="relationship-pair"><span>${escapeHtml(ends[0].node.title)}</span><b>◇ ${escapeHtml(relationship.title)} ◇</b><span>${escapeHtml(ends[1].node.title)}</span></div>`
    : '<p class="small-help">Conecte este relacionamento a duas entidades ou tabelas para configurar as duas pontas.</p>';
  body.innerHTML = `<div class="inspector-section"><div class="eyebrow">RELACIONAMENTO · ${ends.length} PARTICIPANTES</div><label class="field-label">Nome<input class="inspector-input" id="relationshipTitle" value="${escapeHtml(relationship.title)}"></label><label class="field-label">Descrição<textarea class="inspector-textarea" id="relationshipDescription" placeholder="Documente a regra de associação">${escapeHtml(relationship.description||'')}</textarea></label>${pair}<label class="concept-field-flag"><input type="checkbox" id="identifyingRelationship" ${relationship.conceptual?.identifying?'checked':''}> Relacionamento identificador</label><button class="inspector-action" id="addRelationshipParticipant">＋ Adicionar participante</button></div>${ends.length >= 2 ? `${ends.length===2?`<div class="inspector-section"><h3>CARDINALIDADE ENTRE AS PONTAS</h3><div class="cardinality-presets">${presets.map(([label]) => `<button class="cardinality-preset ${preset === label ? 'active' : ''}" data-preset="${label}">${label}</button>`).join('')}</div></div>`:''}<div class="inspector-section connection-endpoints"><h3>PAPEL, CARDINALIDADE E PARTICIPAÇÃO</h3>${ends.map(endView).join('')}</div><div class="crowfoot-legend"><span class="legend-mark">○</span><span>opcional</span><span class="legend-mark">⋔</span><span>muitos</span></div>` : ''}${current().type==='conceitual'?conceptualAttributeEditor(relationship,'ATRIBUTOS DO RELACIONAMENTO'):''}<button class="inspector-action danger" id="deleteSelection">Excluir relacionamento</button>`;
  $('#relationshipTitle')?.addEventListener('input',event=>{relationship.title=event.target.value;renderNodes();save();});
  $('#relationshipDescription')?.addEventListener('change',event=>{snapshot();relationship.description=event.target.value;renderNodes();save();});
  $('#identifyingRelationship')?.addEventListener('change',event=>{snapshot();relationship.conceptual.identifying=event.target.checked;renderNodes();save();});
  $('#addRelationshipParticipant')?.addEventListener('click',()=>{const options=current().nodes.filter(item=>['entity','associative'].includes(item.kind)).map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`).join('');if(!options)return toast('Adicione uma entidade antes de incluir participantes.');showModal('Adicionar participante',`<label class="field-label">Entidade<select class="inspector-select" id="participantEntity">${options}</select></label><label class="field-label">Papel<input class="inspector-input" id="participantRole" placeholder="Ex.: supervisor"></label><div class="inspector-row"><div><label class="field-label">Participação mínima<select class="inspector-select" id="participantMin"><option value="0">Opcional · 0</option><option value="1">Obrigatória · 1</option></select></label></div><div><label class="field-label">Cardinalidade máxima<select class="inspector-select" id="participantMax"><option value="1">Um · 1</option><option value="N">Muitos · N</option></select></label></div></div>`, 'Adicionar',()=>{const entityId=$('#participantEntity').value; snapshot();current().edges.push({id:uid('e'),from:relationship.id,to:entityId,fromMin:'1',fromMax:'1',toMin:$('#participantMin').value,toMax:$('#participantMax').value,role:$('#participantRole').value.trim(),totalParticipation:$('#participantMin').value==='1'});renderInspector();renderNodes();renderEdges();save();} );});
  body.querySelectorAll('[data-remove-participant]').forEach(button=>button.addEventListener('click',()=>{const entry=ends[Number(button.dataset.removeParticipant)];if(!entry)return;showModal('Remover participante?',`<p class="modal-copy">Remover <strong>${escapeHtml(entry.node.title)}</strong>${entry.edge.role?` (${escapeHtml(entry.edge.role)})`:''} de ${escapeHtml(relationship.title)}?</p>`,'Remover',()=>{snapshot();current().edges=current().edges.filter(edge=>edge.id!==entry.edge.id);renderInspector();renderNodes();renderEdges();save();});}));
  body.querySelectorAll('[data-relation-role]').forEach(input=>input.addEventListener('change',()=>{const entry=ends[Number(input.dataset.relationRole)];if(!entry)return;snapshot();entry.edge.role=input.value.trim();save();}));
  body.querySelectorAll('[data-relation-total]').forEach(input=>input.addEventListener('change',()=>{const entry=ends[Number(input.dataset.relationTotal)];if(!entry)return;snapshot();entry.edge.totalParticipation=input.checked;const key=entry.side;entry.edge[`${key}Min`]=input.checked?'1':'0';renderRelationshipInspector(relationship,body);renderEdges();save();}));
  body.querySelectorAll('[data-concept-attr-name],[data-concept-attr-domain],[data-concept-attr-derivation]').forEach(el=>el.addEventListener('change',()=>{const index=Number(el.dataset.conceptAttrName??el.dataset.conceptAttrDomain??el.dataset.conceptAttrDerivation),field=relationship.fields[index];if(!field)return;snapshot();if(el.hasAttribute('data-concept-attr-name'))field.name=el.value;else if(el.hasAttribute('data-concept-attr-domain'))field.domain=el.value;else field.derivation=el.value;renderNodes();save();}));
  body.querySelectorAll('[data-concept-attr-kind]').forEach(el=>el.addEventListener('change',()=>{const field=relationship.fields[Number(el.dataset.conceptAttrKind)];if(field){snapshot();field.kind=el.value;renderInspector();save();}}));
  body.querySelectorAll('[data-concept-attr-parent]').forEach(el=>el.addEventListener('change',()=>{const field=relationship.fields[Number(el.dataset.conceptAttrParent)];if(field){snapshot();field.parentId=el.value||null;save();}}));
  body.querySelectorAll('[data-concept-attr-identifier],[data-concept-attr-required]').forEach(el=>el.addEventListener('change',()=>{const field=relationship.fields[Number(el.dataset.conceptAttrIdentifier??el.dataset.conceptAttrRequired)];if(field){snapshot();if(el.hasAttribute('data-concept-attr-identifier'))field.identifier=el.checked;else field.required=el.checked;save();}}));
  body.querySelectorAll('[data-add-concept-attribute]').forEach(button=>button.addEventListener('click',()=>{snapshot();relationship.fields||=[];relationship.fields.push({id:uid('a'),name:'novo_atributo',kind:'simple',domain:'',required:false,identifier:false,derivation:''});renderInspector();save();}));
  body.querySelectorAll('[data-remove-field]').forEach(button=>button.addEventListener('click',()=>{snapshot();const field=relationship.fields[Number(button.dataset.removeField)];relationship.fields.forEach(candidate=>{if(candidate.parentId===field?.id)candidate.parentId=null;});relationship.fields.splice(Number(button.dataset.removeField),1);renderInspector();save();}));
  if(current().type==='conceitual')bindConceptualRules(relationship,body);
  body.querySelectorAll('[data-relation-side]').forEach(control => control.addEventListener('change', () => {
    const entry = ends[Number(control.dataset.relationSide)];
    if (!entry) return;
    snapshot(); entry.edge[`${entry.side}${control.dataset.prop}`] = control.value;
    renderRelationshipInspector(relationship, body); renderEdges(); save();
  }));
  body.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
    if (ends.length < 2) return;
    snapshot(); const [left,right] = button.dataset.preset.split(':');
    [left,right].forEach((max,index) => { const entry=ends[index]; entry.edge[`${entry.side}Min`]='1'; entry.edge[`${entry.side}Max`]=max; });
    renderRelationshipInspector(relationship, body); renderEdges(); save();
  }));
  $('#deleteSelection').addEventListener('click', () => requestDeleteSelection());
}
function renderLogicalRelationshipInspector(edge, body) {
  normalizeEdge(edge);
  const ends = [
    {side:'from', node:nodeAt(edge.from)},
    {side:'to', node:nodeAt(edge.to)}
  ].filter(entry => entry.node).sort((a,b) => a.node.x - b.node.x);
  const presets = [['1:1','1','1'],['1:N','1','N'],['N:1','N','1'],['N:N','N','N']];
  const endView = (entry,index) => {
    const min = edge[`${entry.side}Min`], max = edge[`${entry.side}Max`];
    const controlId = `logicalEnd${index}`;
    return `<div class="endpoint-card"><div class="endpoint-heading"><span class="endpoint-dot ${index ? 'to' : 'from'}"></span><strong>${escapeHtml(entry.node.title)}</strong><span class="endpoint-caption">${min}..${max}</span></div><label class="field-label" for="${controlId}Participation">Participação</label><select class="inspector-select" id="${controlId}Participation" data-logical-end="${index}" data-prop="Min"><option value="1" ${min === '1' ? 'selected' : ''}>Obrigatória · pelo menos 1</option><option value="0" ${min === '0' ? 'selected' : ''}>Opcional · pode ser 0</option></select><label class="field-label" for="${controlId}Maximum">Cardinalidade máxima</label><select class="inspector-select" id="${controlId}Maximum" data-logical-end="${index}" data-prop="Max"><option value="1" ${max === '1' ? 'selected' : ''}>Um · 1</option><option value="N" ${max === 'N' ? 'selected' : ''}>Muitos · N (pé de galinha)</option></select></div>`;
  };
  const preset = ends.length === 2 ? `${edge[`${ends[0].side}Max`]}:${edge[`${ends[1].side}Max`]}` : '';
  const pair = ends.length === 2
    ? `<div class="relationship-pair"><span>${escapeHtml(ends[0].node.title)}</span><b>— RELAÇÃO —</b><span>${escapeHtml(ends[1].node.title)}</span></div>`
    : '<p class="small-help">Conecte duas tabelas para configurar as cardinalidades nas duas pontas.</p>';
  const many = ends.length === 2 && edge.fromMax === 'N' && edge.toMax === 'N';
  const integrity = `<div class="inspector-section"><h3>INTEGRIDADE REFERENCIAL</h3><label class="field-label">Tipo<select class="inspector-select" id="logicalIdentifying"><option value="non-identifying" ${edge.identifying ? '' : 'selected'}>Não identificadora</option><option value="identifying" ${edge.identifying ? 'selected' : ''}>Identificadora</option></select></label><div class="inspector-row"><div><label class="field-label">ON DELETE<select class="inspector-select" id="logicalOnDelete">${['NO ACTION','RESTRICT','CASCADE','SET NULL','SET DEFAULT'].map(value => `<option ${edge.onDelete === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label></div><div><label class="field-label">ON UPDATE<select class="inspector-select" id="logicalOnUpdate">${['NO ACTION','RESTRICT','CASCADE','SET NULL','SET DEFAULT'].map(value => `<option ${edge.onUpdate === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label></div></div><label class="field-label">Nome da coluna FK<input class="inspector-input" id="logicalFkName" value="${escapeHtml(edge.foreignKey?.columnName || '')}" placeholder="Preenchido ao implementar a FK"></label><button class="inspector-action" id="materializeRelationship">${many ? '＋ Criar tabela associativa' : '＋ Criar chave estrangeira'}</button><p class="small-help">A FK é criada no lado N. Para N:N, uma tabela associativa conecta as duas tabelas.</p></div>`;
  body.innerHTML = `<div class="inspector-section"><div class="eyebrow">MODELO LÓGICO</div><h3 class="relationship-name">Relação entre tabelas</h3>${pair}</div>${ends.length === 2 ? `<div class="inspector-section"><h3>CARDINALIDADE ENTRE AS PONTAS</h3><div class="cardinality-presets">${presets.map(([label]) => `<button class="cardinality-preset ${preset === label ? 'active' : ''}" data-logical-preset="${label}">${label}</button>`).join('')}</div><p class="small-help">Selecione uma opção para atualizar a notação no diagrama.</p></div><div class="inspector-section connection-endpoints"><h3>OPCIONALIDADE POR PONTA</h3>${ends.map(endView).join('')}</div><div class="crowfoot-legend"><span class="legend-mark">○</span><span>opcional</span><span class="legend-mark">⋔</span><span>muitos</span></div>${integrity}` : ''}<button class="inspector-action danger" id="deleteSelection">Excluir relação</button>`;
  body.querySelectorAll('[data-logical-end]').forEach(control => control.addEventListener('change', () => {
    const entry = ends[Number(control.dataset.logicalEnd)];
    if (!entry) return;
    snapshot(); edge[`${entry.side}${control.dataset.prop}`] = control.value;
    renderLogicalRelationshipInspector(edge, body); renderEdges(); save();
  }));
  body.querySelectorAll('[data-logical-preset]').forEach(button => button.addEventListener('click', () => {
    if (ends.length !== 2) return;
    snapshot();
    const [left,right] = button.dataset.logicalPreset.split(':');
    [left,right].forEach((max,index) => {
      const side = ends[index].side;
      edge[`${side}Min`] = '1'; edge[`${side}Max`] = max;
    });
    renderLogicalRelationshipInspector(edge, body); renderEdges(); save();
  }));
  $('#logicalIdentifying')?.addEventListener('change', event => { snapshot(); edge.identifying = event.target.value === 'identifying'; renderInspector(); save(); });
  $('#logicalOnDelete')?.addEventListener('change', event => { snapshot(); edge.onDelete = event.target.value; save(); });
  $('#logicalOnUpdate')?.addEventListener('change', event => { snapshot(); edge.onUpdate = event.target.value; save(); });
  $('#logicalFkName')?.addEventListener('change', event => { snapshot(); edge.foreignKey ||= {}; edge.foreignKey.columnName = event.target.value.trim(); save(); });
  $('#materializeRelationship')?.addEventListener('click', () => edge.fromMax === 'N' && edge.toMax === 'N' ? materializeAssociation(edge) : materializeForeignKey(edge));
  $('#deleteSelection').addEventListener('click', () => requestDeleteSelection());
}
function primaryKeyFields(table) {
  const ids = table.primaryKey?.length ? table.primaryKey : (table.fields || []).filter(field => field.key === 'PK').map(field => field.id || field.name);
  return ids.map(id => (table.fields || []).find(field => field.id === id || field.name === id)).filter(Boolean);
}
function materializeForeignKey(edge) {
  const from = nodeAt(edge.from), to = nodeAt(edge.to);
  if (!from || !to) return toast('A relação perdeu uma de suas tabelas');
  const child = edge.fromMax === 'N' ? from : to, parent = child === from ? to : from;
  if (edge.fromMax === 'N' && edge.toMax === 'N') return materializeAssociation(edge);
  const parentKey = primaryKeyFields(parent)[0];
  if (!parentKey) return toast(`Defina uma chave primária em ${parent.title} primeiro`);
  const name = edge.foreignKey?.columnName || `${parent.title}_${parentKey.name}`;
  if (child.fields.some(field => field.name === name || field.references?.relationshipId === edge.id)) return toast(`A chave estrangeira ${name} já existe em ${child.title}`);
  snapshot();
  const field = {id:uid('c'),name,type:parentKey.type,size:parentKey.size,precision:parentKey.precision,scale:parentKey.scale,key:edge.identifying?'PK':'FK',nullable:(child===from?edge.fromMin:edge.toMin)==='0'&&!edge.identifying,unique:edge.fromMax==='1'&&edge.toMax==='1',references:{relationshipId:edge.id,tableId:parent.id,columnId:parentKey.id||parentKey.name,columnName:parentKey.name,onDelete:edge.onDelete||'NO ACTION',onUpdate:edge.onUpdate||'NO ACTION'}};
  child.fields.push(field); edge.foreignKey={...(edge.foreignKey||{}),columnName:name,materialized:true};
  if (edge.identifying) { child.primaryKey ||= []; child.primaryKey.push(field.id); }
  selectedId=child.id; selectedEdge=null; render(); save(); toast(`Chave estrangeira criada em ${child.title}`);
}
function materializeAssociation(edge) {
  const left=nodeAt(edge.from),right=nodeAt(edge.to); if(!left||!right)return toast('A relação perdeu uma de suas tabelas');
  const leftKey=primaryKeyFields(left)[0],rightKey=primaryKeyFields(right)[0];
  if(!leftKey||!rightKey)return toast('Defina uma chave primária nas duas tabelas primeiro');
  const base=`${left.title}_${right.title}`, name=(()=>{let value=base,n=2;while(current().nodes.some(node=>node.kind==='table'&&node.title.toLowerCase()===value.toLowerCase()))value=`${base}_${n++}`;return value;})();
  snapshot();
  const leftColumn=`${left.title}_${leftKey.name}`, rightColumn=left.id===right.id?`${right.title}_${rightKey.name}_2`:`${right.title}_${rightKey.name}`;
  const associative={id:uid('n'),kind:'table',title:name,x:Math.round((left.x+right.x)/2+30),y:Math.round((left.y+right.y)/2+130),color:tableColors[1],description:`Tabela associativa para ${left.title} ↔ ${right.title}.`,fields:[
    {id:uid('c'),name:leftColumn,type:leftKey.type,size:leftKey.size,key:'PK',nullable:false,references:{tableId:left.id,columnId:leftKey.id||leftKey.name,columnName:leftKey.name,relationshipId:`${edge.id}:left`}},
    {id:uid('c'),name:rightColumn,type:rightKey.type,size:rightKey.size,key:'PK',nullable:false,references:{tableId:right.id,columnId:rightKey.id||rightKey.name,columnName:rightKey.name,relationshipId:`${edge.id}:right`}}
  ]};
  associative.primaryKey=associative.fields.map(field=>field.id);
  current().nodes.push(associative);
  current().edges=current().edges.filter(item=>item.id!==edge.id);
  for(const [parent,child] of [[left,associative],[right,associative]]) current().edges.push({id:uid('e'),from:parent.id,to:child.id,fromMin:'1',fromMax:'1',toMin:'0',toMax:'N',onDelete:edge.onDelete||'CASCADE',onUpdate:edge.onUpdate||'CASCADE',identifying:true});
  selectedId=associative.id;selectedEdge=null;render();save();toast(`Tabela associativa ${name} criada`);
}
function requestDeleteSelection(nodeId = selectedId, edgeId = selectedEdge) {
  if(!edgeId&&selectedIds.size>1&&selectedIds.has(nodeId)){
    showModal('Excluir seleção?',`<p class="modal-copy">Tem certeza de que deseja excluir estes ${selectedIds.size} elementos e suas conexões? Você poderá desfazer essa ação.</p>`,'Excluir',deleteSelection);
    return;
  }
  const node = nodeId && nodeAt(nodeId);
  const edge = edgeId && current().edges.find(item => item.id === edgeId);
  if (!node && !edge) return;
  const kind = node?.kind === 'table' ? 'a tabela' : node ? 'o elemento' : 'a relação';
  const title = node?.title || (edge ? `${nodeAt(edge.from)?.title || 'Origem'} — ${nodeAt(edge.to)?.title || 'Destino'}` : '');
  const fkCount=node?.kind==='table'?current().nodes.reduce((count,table)=>count+(table.fields||[]).filter(field=>field.references?.tableId===node.id).length,0):0;
  showModal(`Excluir ${kind}?`, `<p class="modal-copy">Tem certeza de que deseja excluir ${kind} <strong>${escapeHtml(title)}</strong>${node ? ' e suas conexões' : ''}?${fkCount?` ${fkCount} chave(s) estrangeira(s) em outras tabelas também serão removidas.`:''} Você poderá desfazer essa ação.</p>`, 'Excluir', () => {
    selectedId = node?.id || null; selectedEdge = edge?.id || null;
    deleteSelection();
  });
}
function cleanLogicalReferences(targetTable,targetField=null){
  const targetColumnId=targetField&&(targetField.id||targetField.name),targetColumnName=targetField?.name;
  for(const table of current().nodes.filter(item=>item.kind==='table')){
    const groups=new Set();
    for(const field of table.fields||[]){const ref=field.references;if(ref?.tableId===targetTable.id&&(!targetField||ref.columnId===targetColumnId||ref.columnName===targetColumnName)){if(ref.constraintId)groups.add(ref.constraintId);else{delete field.references;if(field.key==='FK')field.key='';}}}
    if(groups.size)for(const field of table.fields||[])if(groups.has(field.references?.constraintId)){delete field.references;if(field.key==='FK')field.key='';}
    table.constraints=(table.constraints||[]).filter(constraint=>!(constraint.type==='FOREIGN_KEY'&&String(constraint.table).toLowerCase()===targetTable.title.toLowerCase()&&(!targetField||(constraint.targetColumns||[]).includes(targetColumnName))));
    table.primaryKey=(table.primaryKey||[]).filter(id=>(table.fields||[]).some(field=>(field.id||field.name)===id||field.name===id));
  }
}
function deleteSelection() {
  if (selectedIds.size > 1) {
    snapshot();
    const d=current(), ids=new Set(selectedIds);
    for(const node of d.nodes.filter(item=>ids.has(item.id)&&item.kind==='table')) cleanLogicalReferences(node);
    d.nodes=d.nodes.filter(node=>!ids.has(node.id)); d.edges=d.edges.filter(edge=>!ids.has(edge.from)&&!ids.has(edge.to));
    selectedIds.clear();selectedId=null;selectedEdge=null;render();save();toast('Elementos excluídos');return;
  }
  snapshot();
  const d = current();
  if (selectedId) { const node=nodeAt(selectedId);if(node?.kind==='table')cleanLogicalReferences(node);d.nodes = d.nodes.filter(n => n.id !== selectedId); d.edges = d.edges.filter(e => e.from !== selectedId && e.to !== selectedId); selectedId = null; selectedIds.clear(); }
  else if (selectedEdge) { d.edges = d.edges.filter(e => e.id !== selectedEdge); selectedEdge = null; }
  render(); save(); toast('Elemento excluído');
}
function setTool(next) { tool = next; connectFrom = null; $('#editTools').querySelectorAll('[data-tool]').forEach(el => el.classList.toggle('active', el.dataset.tool === next)); viewport.style.cursor = next === 'pan' ? 'grab' : next === 'connect' ? 'crosshair' : 'default'; }
function applyLayoutPositions(positions){
  for(const [id,next] of positions){const node=nodeAt(id);if(!node)continue;const dx=next.x-node.x,dy=next.y-node.y;if(current().type==='istar'&&isIStarActor(node)){node.istar.layoutOrigin||={x:node.x,y:node.y};node.istar.layoutOrigin.x+=dx;node.istar.layoutOrigin.y+=dy;for(const child of current().nodes.filter(item=>item.istar?.ownerId===node.id)){child.x+=dx;child.y+=dy;}}node.x=next.x;node.y=next.y;if(current().type==='istar'&&node.istar?.ownerId)clampIStarElement(current(),node);}
}
function runLayoutAction(action){
  if(action==='auto'&&current().type==='fluxo')action='flow-vertical';
  if(['flow-vertical','flow-horizontal'].includes(action)&&current().type!=='fluxo')return toast('Use Fluxo vertical ou horizontal em um diagrama de fluxograma.');
  let nodes=current().nodes.filter(node=>current().type!=='istar'||isIStarActor(node)||!node.istar?.ownerId);
  if(!['auto','flow-vertical','flow-horizontal'].includes(action)){const chosen=new Set(selectedIds.size?selectedIds:selectedId?[selectedId]:[]);nodes=nodes.filter(node=>chosen.has(node.id));if(nodes.length<2)return toast('Selecione pelo menos dois elementos.');}
  if(!nodes.length)return toast('Adicione elementos antes de organizar.');
  snapshot();const positions=new Map();
  if(['flow-vertical','flow-horizontal'].includes(action)&&current().type==='fluxo'){
    const byId=new Map(nodes.map((node,index)=>[node.id,index])),levels=new Map(),queue=nodes.filter(node=>node.kind==='start').map(node=>node.id);for(const id of queue)levels.set(id,0);
    for(let cursor=0;cursor<queue.length;cursor++){const id=queue[cursor],next=(levels.get(id)||0)+1;for(const edge of current().edges.filter(item=>item.from===id&&byId.has(item.to))){if(!levels.has(edge.to)){levels.set(edge.to,next);queue.push(edge.to);}}}
    let fallback=Math.max(0,...levels.values())+1;for(const node of nodes)if(!levels.has(node.id))levels.set(node.id,fallback++);
    const groups=new Map();for(const node of nodes){const level=levels.get(node.id);if(!groups.has(level))groups.set(level,[]);groups.get(level).push(node);}const ordered=[...groups.keys()].sort((a,b)=>a-b),left=Math.min(...nodes.map(node=>node.x)),top=Math.min(...nodes.map(node=>node.y));let cursor=action==='flow-vertical'?top:left;
    for(const level of ordered){const group=groups.get(level),sizes=group.map(node=>{const el=$(`#nodes [data-id="${CSS.escape(node.id)}"]`);return{w:el?.offsetWidth||180,h:el?.offsetHeight||70};});if(action==='flow-vertical'){const rowHeight=Math.max(...sizes.map(size=>size.h));let x=left;group.forEach((node,index)=>{positions.set(node.id,{x,y:cursor});x+=sizes[index].w+80;});cursor+=rowHeight+100;}else{const columnWidth=Math.max(...sizes.map(size=>size.w));let y=top;group.forEach((node,index)=>{positions.set(node.id,{x:cursor,y});y+=sizes[index].h+64;});cursor+=columnWidth+130;}}
  }else if(action==='auto'){
    const columns=Math.max(1,Math.ceil(Math.sqrt(nodes.length))),left=Math.min(...nodes.map(node=>node.x)),top=Math.min(...nodes.map(node=>node.y)),rowCount=Math.ceil(nodes.length/columns),rowHeights=Array(rowCount).fill(150);
    nodes.forEach((node,index)=>{const element=$(`#nodes [data-id="${CSS.escape(node.id)}"]`),row=Math.floor(index/columns);rowHeights[row]=Math.max(rowHeights[row],element?.offsetHeight||120);});
    const rowTop=[];for(let row=0,y=top;row<rowCount;row++){rowTop[row]=y;y+=rowHeights[row]+54;}
    nodes.forEach((node,index)=>{const col=index%columns,row=Math.floor(index/columns);positions.set(node.id,{x:left+col*360,y:rowTop[row]});});
  }else if(action==='align-x')nodes.forEach(node=>positions.set(node.id,{x:node.x,y:nodes[0].y}));
  else if(action==='align-y')nodes.forEach(node=>positions.set(node.id,{x:nodes[0].x,y:node.y}));
  else{
    const horizontal=action==='distribute-x',ordered=[...nodes].sort((a,b)=>horizontal?a.x-b.x:a.y-b.y),first=ordered[0],last=ordered.at(-1),start=horizontal?first.x:first.y,end=horizontal?last.x:last.y,step=(end-start)/(ordered.length-1);
    ordered.forEach((node,index)=>positions.set(node.id,horizontal?{x:Math.round(start+index*step),y:node.y}:{x:node.x,y:Math.round(start+index*step)}));
  }
  applyLayoutPositions(positions);render();save();if(['auto','flow-vertical','flow-horizontal'].includes(action))$('#fitButton').click();toast(['auto','flow-vertical','flow-horizontal'].includes(action)?'Elementos organizados':'Alinhamento atualizado');
}
function onNodePointerDown(e) {
  if (e.button !== 0) return;
  e.stopPropagation();
  const id = e.currentTarget.dataset.id;
  if (tool === 'connect') {
    if (!connectFrom) { connectFrom = id; selectedId = id; selectedEdge = null; renderNodes(); renderInspector(); toast('Agora selecione o elemento de destino'); }
    else if (connectFrom !== id) { if(current().type==='usecase'){const source=nodeAt(connectFrom),target=nodeAt(id),type=$('#useCaseRelationType').value,valid=source.kind!=='systemBoundary'&&target.kind!=='systemBoundary'&&(type==='association'?new Set([source.kind,target.kind]).size===2&&[source.kind,target.kind].includes('actor')&&[source.kind,target.kind].includes('useCase'):type==='generalization'?source.kind===target.kind&&['actor','useCase'].includes(source.kind):source.kind==='useCase'&&target.kind==='useCase');if(!valid){toast('Esta relação exige extremos compatíveis; confira a origem e o destino.');return;}snapshot();current().edges.push({id:uid('e'),from:connectFrom,to:id,type,condition:'',extensionPoint:'',documentation:''});}
      else if(current().type==='istar') {const edge={id:uid('e'),from:connectFrom,to:id,type:$('#istarRelationType').value,dependumKind:$('#istarRelationType').value.startsWith('dependency')?$('#istarRelationType').value.slice(10).toLowerCase():null,dependum:'',documentation:''},issue=validateIStarDiagram({...current(),edges:[edge]}).find(item=>item.severity==='error');if(issue){toast(issue.message);return;}snapshot();current().edges.push(edge);selectedEdge=edge.id;}
      else if (!current().edges.some(edge => edge.from === connectFrom && edge.to === id)) { snapshot(); current().edges.push(current().type === 'fluxo' ? createFlowEdge(connectFrom,id) : {id: uid('e'), from: connectFrom, to: id, label: ''}); }
      connectFrom = null; selectedId = null; setTool('select'); render(); save(); toast('Conexão criada'); }
    return;
  }
  if (e.shiftKey) {
    if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
    selectedId = selectedIds.has(id) ? id : [...selectedIds].at(-1) || null;
  } else if (!selectedIds.has(id)) {
    selectedIds = new Set([id]); selectedId = id;
  } else selectedId = id;
  selectedEdge = null; renderInspector(); $('#nodes').querySelectorAll('.node').forEach(el => el.classList.toggle('selected', selectedIds.has(el.dataset.id))); renderEdges();
  if (tool === 'pan') return;
  const idsSet = new Set(selectedIds.has(id) ? [...selectedIds] : [id]);
  if(current().type==='istar')for(const actorId of [...idsSet])if(isIStarActor(nodeAt(actorId)))for(const child of current().nodes)if(child.istar?.ownerId===actorId)idsSet.add(child.id);
  const ids = [...idsSet];
  const origins = Object.fromEntries(ids.map(nodeId => { const n = nodeAt(nodeId); return [nodeId, {x:n.x,y:n.y}]; }));
  drag = {type: 'nodes', ids, x: e.clientX, y: e.clientY, origins, moved: false};
  e.currentTarget.setPointerCapture(e.pointerId);
}
function renderTransform() { surface.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`; $('#zoomLabel').textContent = `${Math.round(zoom * 100)}%`; }
const iStarRelationshipGroups=[
  ['Vínculos entre atores',['isA','participatesIn']],
  ['Dependências',['dependencyGoal','dependencyQuality','dependencyTask','dependencyResource']],
  ['Refinamentos',['refinementAnd','refinementOr']],
  ['Contribuições',['contributionMake','contributionHelp','contributionHurt','contributionBreak']],
  ['Relações entre elementos',['qualification','neededBy']]
];
const iStarRelationIcons={isA:'↗',participatesIn:'↔',dependencyGoal:'◇',dependencyQuality:'☁',dependencyTask:'⬡',dependencyResource:'▭',refinementAnd:'⊥',refinementOr:'➤',contributionMake:'↑',contributionHelp:'↗',contributionHurt:'↘',contributionBreak:'↓',qualification:'┄',neededBy:'⊙'};
function iStarRelationshipOptions(selected=''){
 return iStarRelationshipGroups.map(([group,types])=>`<optgroup label="${group}">${types.map(type=>`<option value="${type}" ${selected===type?'selected':''}>${iStarRelationIcons[type]}　${escapeHtml(iStarRelationships[type])}</option>`).join('')}</optgroup>`).join('');
}
function renderIStarRelationshipPicker(){
 const diagram=current();if(diagram.type!=='istar')return;
 const selected=diagram.istar?.selectedRelationship||'participatesIn';
 const stateSelect=$('#istarRelationType');stateSelect.innerHTML=iStarRelationshipOptions(selected);stateSelect.value=selected;
 $('#istarRelationCategories').innerHTML=iStarRelationshipGroups.map(([group,types],index)=>{
   const active=types.includes(selected),currentType=active?selected:null,selectId=`istarRelationCategory${index}`;
   return `<div class="istar-category-select"><span>${escapeHtml(group)}</span><div class="istar-select-wrap"><button type="button" class="istar-select-trigger" data-istar-picker="${index}" aria-haspopup="listbox" aria-expanded="false" aria-label="${escapeHtml(group)}: ${currentType?escapeHtml(iStarRelationships[currentType]):'Selecione'}"><span class="istar-trigger-icon">${currentType?iStarRelationIcons[currentType]:'⌄'}</span><span class="istar-trigger-label">${currentType?escapeHtml(iStarRelationships[currentType]):'Selecione'}</span><span class="istar-trigger-caret">▾</span></button><div class="istar-select-menu" role="listbox" aria-label="${escapeHtml(group)}" hidden>${types.map(type=>`<button type="button" role="option" aria-selected="${selected===type}" data-istar-option="${type}" class="istar-select-option ${selected===type?'active':''}"><span class="istar-option-icon">${iStarRelationIcons[type]}</span><span>${escapeHtml(iStarRelationships[type])}</span></button>`).join('')}</div></div><select class="istar-category-native" id="${selectId}" data-istar-category="${index}" aria-label="${escapeHtml(group)}" tabindex="-1" aria-hidden="true"><option value="" ${active?'':'selected'}>Selecione</option>${types.map(type=>`<option value="${type}" ${selected===type?'selected':''}>${escapeHtml(iStarRelationships[type])}</option>`).join('')}</select></div>`;
 }).join('');
 $('#istarRelationCategories').querySelectorAll('[data-istar-picker]').forEach(trigger=>trigger.addEventListener('click',event=>{event.stopPropagation();const menu=trigger.nextElementSibling;$('#istarRelationCategories').querySelectorAll('.istar-select-menu').forEach(item=>{if(item!==menu)item.hidden=true;});const open=menu.hidden;menu.hidden=!open;trigger.setAttribute('aria-expanded',String(open));}));
 $('#istarRelationCategories').querySelectorAll('[data-istar-option]').forEach(option=>option.addEventListener('click',event=>{event.stopPropagation();stateSelect.value=option.dataset.istarOption;stateSelect.dispatchEvent(new Event('change',{bubbles:true}));}));
}
document.addEventListener('pointerdown',event=>{if(event.target.closest('.istar-select-wrap'))return;document.querySelectorAll('.istar-select-menu:not([hidden])').forEach(menu=>{menu.hidden=true;menu.previousElementSibling?.setAttribute('aria-expanded','false');});});
function render() { if(current().type==='istar')normalizeIStarDiagram(current()); $('#projectTitle').textContent = state.title; $('#crumbProject').textContent = state.title; $('#canvasHint').textContent = current().type === 'fluxo' ? 'Dois cliques na linha: criar canto · No ponto: remover · Arraste: curva' : current().type === 'logico' ? 'Modelo relacional · selecione tabelas ou relações para editar propriedades' : current().type==='conceitual'?'MER · entidades, atributos, relações n-árias · Shift+clique seleciona vários':current().type==='usecase'?'Casos de uso UML · escolha a relação e conecte os elementos':current().type==='istar'?'iStar · Arraste a relação para curvar · Dois cliques: criar/remover canto':'Selecione uma linha para editar propriedades · Arraste para organizar'; $('.editor-grid').classList.toggle('logical-editor',current().type==='logico'); $('#logicalTools').classList.toggle('hidden', current().type !== 'logico'); $('#useCaseTools').classList.toggle('hidden',current().type!=='usecase');$('#istarTools').classList.toggle('hidden',current().type!=='istar');$('.canvas-toolbar').classList.toggle('istar-active',current().type==='istar');$('#istarSelectControls').classList.toggle('hidden',current().type!=='istar');$('#istarRelationType').innerHTML=iStarRelationshipOptions(current().istar?.selectedRelationship||'participatesIn');renderIStarRelationshipPicker();$('#istarView').value=current().istar?.view||'SR';$('#conceptualTools').classList.toggle('hidden',current().type!=='conceitual');$('#conceptualNotation span').textContent=current().conceptual?.notation==="crows-foot"?"Crow's Foot":'Chen';$('#manageConnections').classList.toggle('hidden', ['logico','usecase'].includes(current().type)); renderTabs(); renderPalette(); renderNodes(); renderInspector(); renderTransform(); updateHistoryButtons(); }
function showModal(title, html, confirmText, onConfirm) {
  $('#modal').classList.remove('diagram-picker-modal'); $('#modal .modal-actions').hidden=false;
  $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html; $('#modalConfirm').textContent = confirmText;
  modal.onclose = () => { if (modal.returnValue === 'confirm') onConfirm(); };
  modal.showModal();
}
function logicalReport(title, issues) {
  const severityLabel = {error:'Erro',warning:'Aviso',suggestion:'Sugestão'};
  const content = issues.length ? `<div class="logical-issues">${issues.map((issue,index)=>`<button type="button" class="logical-issue severity-${issue.severity}" data-issue-index="${index}"><span>${severityLabel[issue.severity] || 'Info'}</span><strong>${escapeHtml(issue.message)}</strong><small>${escapeHtml(issue.code)}</small></button>`).join('')}</div>` : '<div class="logical-empty-result"><span>✓</span><strong>Nenhum problema encontrado</strong><p>O modelo passou pelas verificações disponíveis.</p></div>';
  showModal(title, `<p class="modal-copy">${issues.length ? `${issues.length} resultado(s) encontrado(s). Clique em um item para localizar seu elemento.` : 'As regras disponíveis não encontraram inconsistências.'}</p>${content}`, 'Fechar', () => {});
  modal.querySelectorAll('[data-issue-index]').forEach(button=>button.addEventListener('click',()=>{
    const issue=issues[Number(button.dataset.issueIndex)];modal.close('cancel');
    if(current().nodes.some(node=>node.id===issue.elementId)){selectedId=issue.elementId;selectedEdge=null;renderInspector();renderNodes();}
    else if(current().edges.some(edge=>edge.id===issue.elementId))selectConnection(issue.elementId);
  }));
}
function validateCurrentLogicalModel() {
  if(current().type!=='logico')return toast('Selecione um diagrama lógico');
  const issues=validateLogicalDiagram(current());
  logicalReport('Validação do modelo lógico',issues);
}
function updateFlowSimulationToolbar(){
  const simulation=flowSimulation?.diagramId===current().id?flowSimulation:null;
  const set=(id,disabled)=>{const control=$(`#${id}`);if(control)control.disabled=Boolean(disabled);};
  set('flowSimNext',!simulation||simulation.paused||simulation.finished);
  set('flowSimPause',!simulation||simulation.finished);
  set('flowSimReset',!simulation);
  const pause=$('#flowSimPause');if(pause){pause.innerHTML=simulation?.paused?'▶ <span>Continuar</span>':'Ⅱ <span>Pausar</span>';pause.title=simulation?.paused?'Continuar simulação':'Pausar simulação';}
  const start=$('#flowSimStart');if(start){start.disabled=Boolean(simulation&&!simulation.finished);start.innerHTML=simulation&&!simulation.finished?'● <span>Em simulação</span>':'▶ <span>Simular</span>';}
}
function validateCurrentFlow(){
  const issues=validateFlowDiagram(current(),{diagrams:state.diagrams}),labels={error:'Erro',warning:'Aviso',info:'Informação'};
  const content=issues.length?`<div class="logical-issues">${issues.map((issue,index)=>`<button type="button" class="logical-issue severity-${issue.severity==='info'?'suggestion':issue.severity}" data-flow-issue="${index}"><span>${labels[issue.severity]||'Info'}</span><strong>${escapeHtml(issue.message)}</strong><small>${escapeHtml(issue.suggestion||issue.code)}</small></button>`).join('')}</div>`:'<div class="logical-empty-result"><span>✓</span><strong>Nenhum problema encontrado</strong><p>As verificações disponíveis não encontraram inconsistências.</p></div>';
  showModal('Validação do fluxograma',`<p class="modal-copy">${issues.length?`${issues.length} resultado(s). Selecione um para localizar o elemento.`:'O fluxo passou pelas verificações disponíveis.'}</p>${content}`,'Fechar',()=>{});
  modal.querySelectorAll('[data-flow-issue]').forEach(button=>button.addEventListener('click',()=>{const issue=issues[Number(button.dataset.flowIssue)];modal.close('cancel');if(!issue?.elementId)return;if(current().nodes.some(node=>node.id===issue.elementId)){selectedId=issue.elementId;selectedIds=new Set([selectedId]);selectedEdge=null;renderNodes();renderInspector();centerCanvasOnNode(selectedId);}else if(current().edges.some(edge=>edge.id===issue.elementId)){selectConnection(issue.elementId);const edge=current().edges.find(item=>item.id===issue.elementId);if(edge)centerCanvasOnNode(edge.from);}}));
}
function startFlowSimulation(){
  if(current().type!=='fluxo')return;
  const start=initialFlowNode(current());if(!start){toast('Adicione um elemento Início antes de simular.');return;}
  flowSimulation={diagramId:current().id,currentId:start.id,history:[start.id],edges:[],steps:1,paused:false,finished:false,maxSteps:1000};
  renderNodes();renderEdges();centerCanvasOnNode(start.id);toast('Simulação iniciada. Avance passo a passo.');
}
function resetFlowSimulation(){const start=initialFlowNode(current());if(!start)return toast('Não há elemento Início para reiniciar.');flowSimulation={diagramId:current().id,currentId:start.id,history:[start.id],edges:[],steps:1,paused:false,finished:false,maxSteps:1000};renderNodes();renderEdges();centerCanvasOnNode(start.id);}
function advanceFlowSimulation(edgeId=null){
  const simulation=flowSimulation?.diagramId===current().id?flowSimulation:null;if(!simulation||simulation.paused||simulation.finished)return;
  if(simulation.steps>=simulation.maxSteps){simulation.finished=true;renderNodes();renderEdges();toast('Simulação interrompida após 1.000 passos para evitar execução indefinida.');return;}
  const result=flowNextOptions(current(),simulation.currentId);
  if(result.status==='complete'){simulation.finished=true;renderNodes();renderEdges();toast('Fluxo concluído.');return;}
  if(result.status==='dead-end'){simulation.finished=true;renderNodes();renderEdges();toast('A etapa atual não possui uma próxima conexão.');return;}
  if(result.status==='invalid'){simulation.finished=true;return toast('O elemento atual não existe mais.');}
  if(result.status==='choice'&&!edgeId){const options=result.options.map(({edge,node},index)=>`<label class="flow-choice"><input type="radio" name="flowChoice" value="${escapeHtml(edge.id)}" ${index===0?'checked':''}><span><strong>${escapeHtml(edge.label||`Saída ${index+1}`)}</strong><small>${escapeHtml(node?.title||'Destino')}</small></span></label>`).join('');showModal('Escolha o resultado',`<p class="modal-copy">Selecione a saída da decisão ${escapeHtml(nodeAt(simulation.currentId)?.title||'')}. A simulação é apenas visual e não executa operações externas.</p><div class="flow-choice-list">${options}</div>`,'Avançar',()=>advanceFlowSimulation($('input[name="flowChoice"]:checked')?.value));return;}
  const option=result.options.find(item=>item.edge.id===edgeId)||result.options[0];if(!option)return;
  simulation.edges.push(option.edge.id);simulation.currentId=option.node.id;simulation.history.push(option.node.id);simulation.steps++;
  if(option.node.kind==='end')simulation.finished=true;
  renderNodes();renderEdges();centerCanvasOnNode(option.node.id);if(simulation.finished)toast('Fluxo concluído.');
}
function pauseFlowSimulation(){if(!flowSimulation||flowSimulation.diagramId!==current().id||flowSimulation.finished)return;flowSimulation.paused=!flowSimulation.paused;updateFlowSimulationToolbar();toast(flowSimulation.paused?'Simulação pausada.':'Simulação retomada.');}
function openLogicalSql() {
  if(current().type!=='logico')return toast('Selecione um diagrama lógico');
  showModal('Gerar SQL DDL', `<p class="modal-copy">Escolha o dialeto para mapear os tipos lógicos. O script é gerado localmente e não é executado.</p><label class="field-label">SGBD<select id="sqlDialect" class="inspector-select"><option value="postgresql">PostgreSQL</option><option value="mysql">MySQL</option><option value="mariadb">MariaDB</option><option value="sqlite">SQLite</option></select></label><div class="sql-preview-actions"><button type="button" class="button outline" id="buildSql">Gerar prévia</button><button type="button" class="button subtle" id="downloadSql" disabled>Baixar .sql</button></div><textarea id="sqlPreview" class="sql-preview" aria-label="Prévia do SQL gerado" readonly placeholder="A prévia aparece aqui"></textarea><p class="small-help" id="sqlStatus">A geração verifica o modelo antes de produzir o script.</p>`, 'Fechar', () => {});
  let content='';
  $('#buildSql').addEventListener('click',()=>{try{content=generateLogicalSql(current(),$('#sqlDialect').value);$('#sqlPreview').value=content;$('#downloadSql').disabled=false;$('#sqlStatus').textContent='Prévia pronta. Revise o script antes de executá-lo.';}catch(error){$('#sqlPreview').value='';$('#downloadSql').disabled=true;$('#sqlStatus').textContent=error.message;}});
  $('#downloadSql').addEventListener('click',()=>{if(content)download(`${slug(current().title)}-${$('#sqlDialect').value}.sql`,'text/sql;charset=utf-8',content);});
}
function openDdlImport() {
  showModal('Importar SQL', `<p class="modal-copy">Cole um script SQL ou selecione um arquivo .sql. A importação cria um novo diagrama lógico e não executa o script. Limite: 2 MB.</p><div class="sql-preview-actions"><button type="button" class="button outline" id="chooseDdlFile">↥ Selecionar arquivo .sql</button><span class="small-help" id="ddlFileName">Nenhum arquivo selecionado</span></div><label class="field-label" for="ddlSource">SQL DDL</label><textarea id="ddlSource" class="sql-preview sql-import-source" aria-label="Cole o SQL para importar" placeholder="CREATE TABLE ..."></textarea>`, 'Criar modelo lógico', () => importDdlSource($('#ddlSource')?.value||'', $('#ddlFileName')?.dataset.name||'SQL colado'));
  $('#chooseDdlFile').addEventListener('click',()=>$('#ddlInput').click());
}
function importDdlFile(file) {
  if(!file)return;
  if(file.size>2_000_000)return toast('O arquivo SQL excede o limite de 2 MB');
  file.text().then(text=>{
    const source=$('#ddlSource'),label=$('#ddlFileName');
    if(source&&label){source.value=text;label.textContent=file.name;label.dataset.name=file.name;}
    else importDdlSource(text,file.name);
  }).catch(error=>toast(`Não foi possível ler o arquivo SQL: ${error.message}`));
}
async function importDdlSource(text, sourceName='SQL colado') {
  if(!text.trim())return toast('Cole o SQL ou selecione um arquivo antes de importar');
  if(new Blob([text]).size>2_000_000)return toast('O SQL excede o limite de 2 MB');
  try{
      const diagram=importLogicalDiagramFromDdl(text,`Importado · ${sourceName.replace(/\.sql$/i,'').trim()||'DDL'}`);
      snapshot();diagram.id=uid('d');state.diagrams.push(diagram);state.openDiagramIds||=[];if(!state.openDiagramIds.includes(diagram.id))state.openDiagramIds.push(diagram.id);state.active=diagram.id;rememberActiveTab('studio',state.id,state.active);selectedId=null;selectedEdge=null;render();save();
      try{await persistNativeDocument(diagram.id);toast('DDL importado e salvo como um novo diagrama lógico');}
      catch(error){toast(`DDL importado, mas não foi possível salvar no armazenamento de documentos: ${error.message}`);}
  }catch(error){showModal('Não foi possível importar o SQL',`<p class="modal-copy">${escapeHtml(error.message)} A importação lê um subconjunto conservador de CREATE TABLE e ALTER TABLE com FOREIGN KEY. O SQL nunca é executado.</p>`,'Fechar',()=>{});}
}
function showNormalization() {
  if(current().type!=='logico')return toast('Selecione um diagrama lógico');
  const issues=analyzeNormalization(current());logicalReport('Análise de normalização',issues);
}
const diagramDescriptions={conceitual:'Entidades, atributos e relacionamentos.',logico:'Tabelas, colunas, chaves e relações.',fluxo:'Etapas, decisões e caminhos de um processo.',atividade:'Ações, decisões e fluxos UML.',classes:'Classes, atributos e associações UML.',usecase:'Atores, casos de uso e fronteiras do sistema.',sequencia:'Participantes e mensagens ao longo do tempo.',istar:'Atores, objetivos e dependências estratégicas.'};
const diagramArtwork={
  conceitual:'<rect x="13" y="23" width="39" height="29" rx="3"/><path d="M52 37h21m14 0h20"/><path d="m80 26 12 11-12 11-12-11 12-11Z"/><rect x="107" y="23" width="39" height="29" rx="3"/><ellipse cx="24" cy="12" rx="10" ry="6"/><path d="M24 18v5m102-11a10 6 0 1 0 20 0 10 6 0 1 0-20 0Z"/>',
  logico:'<rect x="18" y="10" width="52" height="57" rx="4"/><path d="M18 25h52M18 39h52M18 53h52M34 25v42"/><rect x="91" y="17" width="52" height="50" rx="4"/><path d="M91 32h52M91 46h52M107 32v35M70 43h21"/>',
  fluxo:'<rect x="60" y="7" width="40" height="18" rx="8"/><path d="M80 25v9m0 0-25 12m25-12 25 12"/><path d="m55 37 17 9-17 9-17-9 17-9Zm50 0 17 9-17 9-17-9 17-9Z"/><path d="M55 55v10h50V55"/>',
  atividade:'<circle cx="80" cy="10" r="6" fill="currentColor"/><path d="M80 16v11"/><rect x="52" y="27" width="56" height="19" rx="9"/><path d="M80 46v7m0 0-20 11m20-11 20 11"/><path d="m60 55 13 8-13 8-13-8 13-8Zm40 0 13 8-13 8-13-8 13-8Z"/>',
  classes:'<rect x="15" y="10" width="52" height="55" rx="3"/><path d="M15 25h52M15 42h52m-35-17v40"/><rect x="94" y="10" width="52" height="55" rx="3"/><path d="M94 25h52M94 42h52m17-17v40M67 38h27"/>',
  usecase:'<path d="M47 8h98v58H47z"/><circle cx="20" cy="21" r="7"/><path d="M20 28v21m-12-13 12 3 12-3m-12 13L9 62m11-13 11 13m16-32h18m-18 20h18"/><ellipse cx="105" cy="30" rx="24" ry="10"/><ellipse cx="105" cy="50" rx="24" ry="9"/>',
  sequencia:'<rect x="13" y="8" width="34" height="15" rx="4"/><rect x="64" y="8" width="34" height="15" rx="4"/><rect x="115" y="8" width="34" height="15" rx="4"/><path d="M30 23v45m51-45v45m51-45v45M30 34h51m-7-6 7 6-7 6m0 12h51m-7-6 7 6-7 6"/>',
  istar:'<rect x="13" y="12" width="134" height="53" rx="22" stroke-dasharray="4 4"/><circle cx="37" cy="38" r="15"/><path d="M52 38h16"/><rect x="68" y="29" width="62" height="18" rx="9"/><path d="M81 35h36"/>'
};
const diagramDefaultTitles={conceitual:'Modelo conceitual',logico:'Modelo lógico',fluxo:'Modelo fluxograma',atividade:'Diagrama de atividades UML',classes:'Diagrama de classes UML',usecase:'Diagrama de casos de uso UML',sequencia:'Diagrama de sequência UML',istar:'Modelo iStar 2.0'};
function diagramIllustration(type){return `<svg viewBox="0 0 160 76" aria-hidden="true" focusable="false">${diagramArtwork[type]||diagramArtwork.fluxo}</svg>`;}
function resetFirstRunWorkspace(){if(!firstRunDiagramPicker)return;let projects={};try{projects=JSON.parse(localStorage.getItem(PROJECTS_KEY)||'{}')}catch{}if(Object.keys(projects).length)localStorage.setItem(PROJECTS_KEY,JSON.stringify(projects));else localStorage.removeItem(PROJECTS_KEY);localStorage.removeItem(STORAGE_KEY);state={id:uid('project'),createdAt:new Date().toISOString(),title:'Meu projeto',active:'',openDiagramIds:[],diagrams:[]};history=[];future=[];selectedId=null;selectedEdge=null;selectedIds.clear();connectFrom=null;activeActivity=null;activeClassDiagram=null;activeSequenceDiagram=null;firstRunDiagramPicker=false;}
function openDiagramPicker(welcome=false){showModal(welcome?'Vamos criar seu primeiro diagrama':'Novo diagrama',`<p class="diagram-picker-intro">Escolha um modelo para começar. Você pode combinar vários tipos no mesmo projeto.</p><div class="diagram-create-grid">${Object.entries(diagramKinds).map(([key,[label]])=>`<button type="button" class="diagram-create-card kind-${key}" data-create-diagram="${key}"><span class="diagram-create-art">${diagramIllustration(key)}</span><span class="diagram-create-copy"><strong>${escapeHtml(label)}</strong><small>${diagramDescriptions[key]}</small></span><span class="diagram-create-arrow" aria-hidden="true">↗</span></button>`).join('')}</div>`,'',()=>{});$('#modal').classList.add('diagram-picker-modal');$('#modal .modal-actions').hidden=true;$('#modalBody').querySelectorAll('[data-create-diagram]').forEach(card=>card.addEventListener('click',()=>{const type=card.dataset.createDiagram;modal.close('cancel');createDiagramType(type);}));}
function newDiagram(){openDiagramPicker(false);}
function createDiagramType(type){
  const title=diagramDefaultTitles[type]||`Modelo ${diagramKinds[type]?.[0]?.toLowerCase()||'novo'}`;
  resetFirstRunWorkspace();
  if(type==='atividade'){createActivityInWorkspace(title);return;}
  if(type==='classes'){createClassDiagramInWorkspace(title);return;}
  if(type==='sequencia'){createSequenceDiagramInWorkspace(title);return;}
  activeActivity=null;activeClassDiagram=null;activeSequenceDiagram=null;$('#activityEditorView').classList.add('hidden');$('#classEditorView').classList.add('hidden');$('#sequenceEditorView').classList.add('hidden');$('#standardEditor').classList.remove('hidden');
  snapshot();const id=uid('d');state.diagrams.push({id,type,title,nodes:[],edges:[],...(type==='conceitual'?{conceptual:{version:1,notation:'chen',specializations:[],constraints:[]}}:{}),...(type==='usecase'?{subject:{id:uid('subject'),name:title}}:{}),...(type==='istar'?{istar:{version:'2.0',view:'SR',stereotypes:[]}}:{})});state.openDiagramIds.push(id);state.active=id;rememberActiveTab('studio',state.id,state.active);selectedId=null;selectedIds.clear();selectedEdge=null;pan={x:55,y:50};zoom=1;render();save();toast('Diagrama criado');
}
async function requestCloseDocument(kind,projectId,diagramId){if(kind==='studio')return closeNativeDocument(diagramId);const key=moduleDocumentId(kind,projectId,diagramId),status=documentStatuses.get(key)||'saved',prefix=kind==='uml-activity'?'activity':kind==='uml-class'?'class':'sequence',projectData=kind==='uml-activity'?'activityProject':kind==='uml-class'?'classProject':'sequenceProject',tab=[...document.querySelectorAll(`[data-${prefix}-diagram="${CSS.escape(diagramId)}"]`)].find(item=>item.dataset[projectData]===projectId),name=tab?.querySelector('span:nth-child(2)')?.textContent||'Documento UML';if(status!=='saved'){const choice=await askUnsaved(name);if(choice==='cancel'||!choice)return false;if(choice==='save'){try{await requestModuleSave(kind,projectId,diagramId)}catch(error){toast(`Não foi possível salvar: ${error.message}`);return false}}else{try{const result=await requestModuleCommand(kind,projectId,diagramId,'discard');if(!result.success)throw new Error(result.error||'O descarte não foi confirmado.')}catch(error){toast(`Não foi possível descartar as alterações: ${error.message}`);return false}}}closedDocumentIds.add(key);localStorage.setItem(OPEN_DOCUMENTS_KEY,JSON.stringify([...closedDocumentIds]));if(kind==='uml-activity'&&activeActivity?.projectId===projectId&&activeActivity?.diagramId===diagramId)activeActivity=null;if(kind==='uml-class'&&activeClassDiagram?.projectId===projectId&&activeClassDiagram?.diagramId===diagramId)activeClassDiagram=null;if(kind==='uml-sequence'&&activeSequenceDiagram?.projectId===projectId&&activeSequenceDiagram?.diagramId===diagramId)activeSequenceDiagram=null;documentStatuses.delete(key);const other=[...document.querySelectorAll('[data-native-tab],[data-activity-diagram],[data-class-diagram],[data-sequence-diagram]')].find(item=>{const id=item.dataset.nativeTab||item.dataset.activityDiagram||item.dataset.classDiagram||item.dataset.sequenceDiagram;const pk=item.dataset.activityProject||item.dataset.classProject||item.dataset.sequenceProject;return id!==diagramId||pk!==projectId});if(other)other.click();else switchView('projects');renderTabs();updateSaveStatus();return true;}
function askUnsaved(name){return new Promise(resolve=>{const dialog=$('#unsavedDialog');$('#unsavedMessage').innerHTML=`O documento <strong>“${escapeHtml(name)}”</strong> possui alterações que ainda não foram salvas. Deseja salvar antes de fechar?`;dialog.returnValue='cancel';dialog.onclose=()=>resolve(dialog.returnValue||'cancel');dialog.showModal();dialog.querySelector('[value="save"]').focus()})}
async function closeNativeDocument(diagramId){const diagram=state.diagrams.find(item=>item.id===diagramId);if(!diagram)return false;const key=nativeDocumentId(state.id,diagramId),status=nativeIsDirty(diagram)?'dirty':documentStatuses.get(key)||'saved';if(status!=='saved'){const choice=await askUnsaved(diagram.title);if(choice==='cancel'||!choice)return false;if(choice==='save'){try{await persistNativeDocument(diagramId)}catch(error){toast(`Erro ao salvar “${diagram.title}”: ${error.message}`);return false}}else{const baseline=savedDocumentSnapshots.get(key);if(baseline)state.diagrams=state.diagrams.map(item=>item.id===diagramId?JSON.parse(JSON.stringify(baseline.content.diagram)):item);else{state.diagrams=state.diagrams.filter(item=>item.id!==diagramId);await deleteStoredDocument(key).catch(()=>{})}}}state.openDiagramIds=state.openDiagramIds.filter(id=>id!==diagramId);if(state.active===diagramId){state.active=state.openDiagramIds[0]||'';selectedId=null;selectedIds.clear();selectedEdge=null}if(state.active)rememberActiveTab('studio',state.id,state.active);else if(JSON.parse(localStorage.getItem(ACTIVE_TAB_KEY)||'null')?.kind==='studio')localStorage.removeItem(ACTIVE_TAB_KEY);if(!state.openDiagramIds.length){save();switchView('projects');return true}render();save();return true;}
async function closeAllDocuments(){const open=[...state.openDiagramIds.map(id=>({kind:'studio',id})),...loadActivityProjects().flatMap(p=>p.diagrams.filter(d=>!closedDocumentIds.has(moduleDocumentId('uml-activity',p.id,d.id))).map(d=>({kind:'uml-activity',projectId:p.id,id:d.id}))),...loadClassProjects().flatMap(p=>p.diagrams.filter(d=>!closedDocumentIds.has(moduleDocumentId('uml-class',p.id,d.id))).map(d=>({kind:'uml-class',projectId:p.id,id:d.id}))),...loadSequenceProjects().flatMap(p=>p.diagrams.filter(d=>!closedDocumentIds.has(moduleDocumentId('uml-sequence',p.id,d.id))).map(d=>({kind:'uml-sequence',projectId:p.id,id:d.id})))];for(const item of open){const closed=await requestCloseDocument(item.kind,item.projectId,item.id);if(closed===false)return false}switchView('projects');return true}
function download(name, mime, content) { const blob = new Blob([content], {type: mime}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function requestModuleCommand(kind,projectId,diagramId,command,extra={}){const frame=$(kind==='uml-activity'?'#activityEditorFrame':kind==='uml-class'?'#classEditorFrame':'#sequenceEditorFrame'),expected=`${kind}:${projectId}:${diagramId}`;if(frame.dataset.documentKey!==expected){if(kind==='uml-activity')openActivityDiagram(projectId,diagramId);else if(kind==='uml-class')openClassDiagram(projectId,diagramId);else openSequenceDiagram(projectId,diagramId);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('O editor não respondeu ao abrir o documento.')),12000);frame.addEventListener('load',()=>{clearTimeout(timer);resolve()},{once:true})})}const requestId=uid('cmd');return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{pendingDocumentCommands.delete(requestId);reject(new Error('O editor não respondeu ao comando.'))},12000);pendingDocumentCommands.set(requestId,{resolve,reject,timeout});frame.contentWindow.postMessage({type:'brmodelo-document-command',command,requestId,projectId,diagramId,...extra},location.origin)})}
async function requestModuleSave(kind,projectId,diagramId){const id=moduleDocumentId(kind,projectId,diagramId);documentStatuses.set(id,'saving');renderTabs();updateSaveStatus();try{const result=await requestModuleCommand(kind,projectId,diagramId,'save');if(!result.success)throw new Error(result.error||'Falha ao salvar documento.');return result}catch(error){documentStatuses.set(id,'error');renderTabs();updateSaveStatus();throw error}}
function activeDocument(){if(activeActivity)return{kind:'uml-activity',projectId:activeActivity.projectId,diagramId:activeActivity.diagramId,title:diagramName('uml-activity',activeActivity.projectId,activeActivity.diagramId)};if(activeClassDiagram)return{kind:'uml-class',projectId:activeClassDiagram.projectId,diagramId:activeClassDiagram.diagramId,title:diagramName('uml-class',activeClassDiagram.projectId,activeClassDiagram.diagramId)};if(activeSequenceDiagram)return{kind:'uml-sequence',projectId:activeSequenceDiagram.projectId,diagramId:activeSequenceDiagram.diagramId,title:diagramName('uml-sequence',activeSequenceDiagram.projectId,activeSequenceDiagram.diagramId)};const d=state.diagrams.find(item=>item.id===state.active);return d?{kind:'studio',projectId:state.id,diagramId:d.id,title:d.title}:null}
function diagramName(kind,projectId,diagramId){if(kind==='studio')return state.diagrams.find(d=>d.id===diagramId)?.title||'Diagrama';const projects=kind==='uml-activity'?loadActivityProjects():kind==='uml-class'?loadClassProjects():loadSequenceProjects();return projects.find(p=>p.id===projectId)?.diagrams.find(d=>d.id===diagramId)?.name||'Diagrama UML'}
async function saveActiveDocument(){if(desktopRuntime)return saveDesktopProject(false);const doc=activeDocument();if(!doc)throw new Error('Nenhum documento está ativo.');if(doc.kind==='studio'){const key=nativeDocumentId(state.id,doc.diagramId);if(!savedDocumentSnapshots.has(key))return new Promise(resolve=>{showModal('Salvar documento',`<label class="field-label" for="firstSaveName">Nome do documento</label><input id="firstSaveName" class="inspector-input modal-input" maxlength="80" value="${escapeHtml(doc.title)}">`,'Salvar',async()=>{const name=$('#firstSaveName').value.trim();if(!name){resolve(false);return}const diagram=state.diagrams.find(item=>item.id===doc.diagramId);if(diagram)diagram.title=name;save();try{await persistNativeDocument(doc.diagramId);toast('Documento salvo.');resolve(true)}catch(error){toast(`Erro ao salvar: ${error.message}`);resolve(false)}});modal.addEventListener('close',()=>{if(modal.returnValue!=='confirm')resolve(false)},{once:true})});return persistNativeDocument(doc.diagramId)}return requestModuleSave(doc.kind,doc.projectId,doc.diagramId)}
async function saveAsActiveDocument(){if(desktopRuntime)return saveDesktopProject(true);const doc=activeDocument();if(!doc)throw new Error('Nenhum documento está ativo.');if(doc.kind!=='studio'){const result=await requestModuleCommand(doc.kind,doc.projectId,doc.diagramId,'saveAs');if(!result.success)throw new Error(result.error||'Falha ao salvar cópia.');return}const original=state.diagrams.find(d=>d.id===doc.diagramId);showModal('Salvar como',`<label class="field-label" for="saveAsName">Nome do novo documento</label><input id="saveAsName" class="inspector-input modal-input" maxlength="80" value="${escapeHtml(original.title)} — cópia">`,'Salvar cópia',async()=>{const title=$('#saveAsName').value.trim();if(!title)return;const copy=JSON.parse(JSON.stringify(original));copy.id=uid('d');copy.title=title;state.diagrams.push(copy);state.openDiagramIds.push(copy.id);state.active=copy.id;rememberActiveTab('studio',state.id,state.active);activeActivity=null;activeClassDiagram=null;render();try{await persistNativeDocument(copy.id);save();toast('Cópia salva.')}catch(error){toast(`Erro ao salvar cópia: ${error.message}`)}})}
async function exportActiveDocument(){const doc=activeDocument();if(!doc)return toast('Nenhum documento está ativo.');try{if(doc.kind!=='studio'){const result=await requestModuleCommand(doc.kind,doc.projectId,doc.diagramId,'export');if(!result.success)throw new Error(result.error||'Falha ao exportar.');download(result.name||`${slug(doc.title)}.json`,'application/json',result.content);return}download(`${slug(doc.title)}.json`,'application/json',JSON.stringify({format:'brmodelo-studio-document',version:1,project:state,diagramId:doc.diagramId},null,2));}catch(error){toast(`Não foi possível exportar: ${error.message}`)}}
function openJsonImportDialog(){
  showModal('Importar JSON',`<p class="modal-copy">Cole abaixo o JSON exportado ou escolha um arquivo .json. Os dois formatos são verificados antes de abrir.</p><div class="import-json-file-row"><button type="button" class="button outline" id="chooseImportJsonFile">Selecionar arquivo JSON</button><span id="importJsonFileName" class="small-help">Nenhum arquivo selecionado</span></div><label class="field-label" for="importJsonText">Conteúdo JSON</label><textarea id="importJsonText" class="inspector-textarea import-json-text" spellcheck="false" placeholder="Cole aqui o conteúdo do arquivo .json"></textarea>`,'Importar',()=>{
    const text=$('#importJsonText').value.trim();
    if(!text){toast('Cole o JSON ou selecione um arquivo para importar.');return}
    const blob=new Blob([text],{type:'application/json'});
    openImportedDocument({size:blob.size,text:()=>Promise.resolve(text),name:'json-colado.json'});
  });
  $('#chooseImportJsonFile').onclick=()=>$('#fileInput').click();
}
async function openImportedDocument(file){
  if(!file)return false;if(file.size>5_000_000){toast('O arquivo excede o limite de 5 MB.');return false}
  return file.text().then(async text=>{
    try{
      const value=JSON.parse(text);
      if(value?.format==='brmodelo-studio-document'&&value.project){
        if(!validateImport(value.project))throw new Error('O arquivo não contém um projeto de dados válido.');
        const parsed=normalizeProjectTables(value.project);parsed.id=uid('project');state=parsed;state.openDiagramIds||=state.diagrams.map(d=>d.id);state.active=state.diagrams.some(d=>d.id===value.diagramId)?value.diagramId:state.diagrams[0].id;render();save();await persistNativeDocument(state.active);switchView('editor');toast('Documento importado e salvo.');return true;
      }
      if(value?.format==='brmodelo.uml-activity'){
        const parsed=parseActivityProject(value),projectId=uid('project'),project={...parsed,id:projectId},diagramId=project.activeDiagramId,diagram=project.diagrams.find(item=>item.id===diagramId);
        if(!diagram)throw new Error('O projeto de atividades não possui uma atividade ativa válida.');
        const record={id:`uml-activity:${projectId}:${diagramId}`,kind:'uml-activity',version:1,projectId,name:diagram.name,updatedAt:new Date().toISOString(),content:{project,diagramId}};
        await saveStoredDocument(record);savedDocumentSnapshots.set(record.id,record);await openSavedDocument(record.id);toast('Projeto de atividades UML importado.');return true;
      }
      if(value?.format==='brmodelo-uml-activity-document'||value?.format==='brmodelo-uml-class-document'||value?.format==='brmodelo-uml-sequence-document'){
        const kind=value.format==='brmodelo-uml-activity-document'?'uml-activity':value.format==='brmodelo-uml-class-document'?'uml-class':'uml-sequence',project=value.project,diagramId=value.diagramId;
        if(!project||!Array.isArray(project.diagrams)||!project.diagrams.some(item=>item.id===diagramId))throw new Error('O arquivo UML não contém o diagrama indicado.');
        const projectId=uid('project'),imported=JSON.parse(JSON.stringify(project));imported.id=projectId;const diagram=imported.diagrams.find(item=>item.id===diagramId),record={id:`${kind}:${projectId}:${diagramId}`,kind,version:1,projectId,name:diagram.name||diagram.title||'Diagrama UML',updatedAt:new Date().toISOString(),content:{project:imported,diagramId}};
        await saveStoredDocument(record);savedDocumentSnapshots.set(record.id,record);await openSavedDocument(record.id);toast('Documento UML importado.');return true;
      }
      if(value?.kind==='studio-diagram'&&value.content?.diagram){
        const projectId=uid('project'),diagram=JSON.parse(JSON.stringify(value.content.diagram)),record={id:nativeDocumentId(projectId,diagram.id),kind:'studio-diagram',version:1,projectId,name:value.name||diagram.title,updatedAt:new Date().toISOString(),content:{project:{...(value.content.project||{}),id:projectId,title:value.content.project?.title||'Projeto importado'},diagram}};
        await saveStoredDocument(record);savedDocumentSnapshots.set(record.id,record);await openSavedNativeDocument(record.id);toast('Documento importado.');return true;
      }
      if(validateImport(value)){snapshot();state=normalizeProjectTables(value);state.id=uid('project');state.active=state.diagrams.some(d=>d.id===state.active)?state.active:state.diagrams[0].id;rememberActiveTab('studio',state.id,state.active);selectedId=null;selectedEdge=null;render();save();await persistNativeDocument(state.active);switchView('editor');toast('Projeto importado.');return true}
      throw new Error('O JSON é válido, mas seu formato não corresponde a um documento suportado pelo brModelo Studio.');
    }catch(error){toast(`Não foi possível importar: ${error.message||'o arquivo JSON está malformado.'}`);return false}
  }).catch(error=>{toast(`Não foi possível ler o arquivo: ${error.message}`);return false});
}
async function executeFileAction(action){$('#fileMenu').open=false;try{if(action==='save'){const saved=await saveActiveDocument();if(saved!==false)toast('Documento salvo.')}else if(action==='saveAs')await saveAsActiveDocument();else if(action==='export')await exportActiveDocument();else if(action==='open')await (desktopRuntime?openDesktopProject():openDocumentDialog());else if(action==='close'){const doc=activeDocument();if(doc)await requestCloseDocument(doc.kind,doc.projectId,doc.diagramId)}else if(action==='closeAll')await closeAllDocuments()}catch(error){toast(`Não foi possível salvar: ${error.message}`)}}
function desktopProjectKey(doc){return `${doc.kind}:${doc.projectId}`}
async function saveDesktopProject(saveAs){
  const doc=activeDocument();if(!doc)throw new Error('Nenhum documento está ativo.');
  let content;
  if(doc.kind==='studio')content=JSON.stringify(state,null,2);
  else{const result=await requestModuleCommand(doc.kind,doc.projectId,doc.diagramId,'export');if(!result.success)throw new Error(result.error||'Falha ao obter projeto UML.');content=result.content}
  const saved=await desktopRuntime.invoke('save_project',{projectKey:desktopProjectKey(doc),content,suggestedName:`${slug(doc.kind==='studio'?state.title:doc.title)}.json`,saveAs});
  if(!saved)return false;
  if(doc.kind==='studio')await persistNativeDocument(doc.diagramId);
  else await requestModuleSave(doc.kind,doc.projectId,doc.diagramId);
  toast(`Projeto salvo em ${saved.name}.`);return true;
}
async function importOpenedDesktopProject(opened){
  if(!opened)return false;
  const file={name:opened.name,size:new Blob([opened.content]).size,text:async()=>opened.content};
  const imported=await openImportedDocument(file);
  if(imported){const doc=activeDocument();if(doc)await desktopRuntime.invoke('attach_opened_project',{token:opened.token,projectKey:desktopProjectKey(doc)});}
  return imported;
}
async function openDesktopProject(){return importOpenedDesktopProject(await desktopRuntime.invoke('open_project'))}
async function showDesktopRecentProjects(){
  const projects=await desktopRuntime.invoke('list_recent_projects');
  const rows=projects.map(item=>`<button type="button" class="saved-document-choice" data-recent-index="${item.index}"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.path)}</small></button>`).join('');
  showModal('Projetos recentes',rows?`<div class="saved-document-list">${rows}</div>`:'<p class="modal-copy">Nenhum arquivo recente.</p>','Fechar',()=>{});
  modal.querySelectorAll('[data-recent-index]').forEach(button=>button.onclick=async()=>{modal.close('cancel');try{await importOpenedDesktopProject(await desktopRuntime.invoke('open_recent_project',{index:Number(button.dataset.recentIndex)}))}catch(error){toast(`Não foi possível abrir: ${error.message}`)}});
}
let desktopQuitInProgress=false;
async function quitDesktop(){
  if(desktopQuitInProgress)return;
  desktopQuitInProgress=true;
  try{
  if(hasUnsavedDocuments()){
    const choice=await askUnsaved('espaço de trabalho');
    if(choice==='cancel'||!choice)return;
    if(choice==='save'){
      const saved=await saveActiveDocument();
      if(saved===false)return;
      if(hasUnsavedDocuments()){toast('Salve os demais documentos antes de sair.');return}
    }
  }
  await desktopRuntime.invoke('quit_desktop');
  }finally{desktopQuitInProgress=false}
}
if(desktopRuntime){
  const menu=$('#fileMenu .file-menu-items');
  const recentButton=document.createElement('button');recentButton.type='button';recentButton.setAttribute('role','menuitem');recentButton.textContent='Projetos recentes…';recentButton.onclick=()=>{$('#fileMenu').open=false;showDesktopRecentProjects().catch(error=>toast(error.message))};menu.append(recentButton);
  desktopRuntime.listen('brmodelo-menu',event=>{const action=event.payload;if(action==='new')$('#newProject').click();else if(action==='quit')quitDesktop().catch(error=>toast(error.message));else if(action==='recent')showDesktopRecentProjects().catch(error=>toast(error.message));else executeFileAction(action)});
  desktopRuntime.listen('brmodelo-close-requested',()=>quitDesktop().catch(error=>toast(error.message)));
  document.addEventListener('dragover',event=>{if([...(event.dataTransfer?.types||[])].includes('Files'))event.preventDefault()});
  document.addEventListener('drop',event=>{const file=event.dataTransfer?.files?.[0];if(!file)return;event.preventDefault();event.stopPropagation();openImportedDocument(file)},true);
}
function hasUnsavedDocuments(){for(const diagram of state.diagrams)if(nativeIsDirty(diagram))return true;return [...documentStatuses.values()].some(status=>status==='dirty'||status==='saving'||status==='error')}
function slug(value) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'diagrama'; }
function flowSvgNode(node){
  const decisionSize=node.kind==='decision'?flowDecisionSize(node):null,width=decisionSize||Math.max(90,Math.min(600,Number(node.width)||(['start','end'].includes(node.kind)?160:node.kind==='connector'?66:180))),height=decisionSize||Math.max(52,Math.min(360,Number(node.height)||(['start','end'].includes(node.kind)?70:node.kind==='connector'?66:70))),x=node.x,y=node.y;
  const fill=/^#[\da-f]{6}$/i.test(node.fillColor||'')?node.fillColor:'#ffffff',stroke=/^#[\da-f]{6}$/i.test(node.strokeColor||'')?node.strokeColor:'#91a7c4',strokeWidth=Math.max(1,Math.min(6,Number(node.strokeWidth)||2));
  const title=String(node.title||''),maxChars=Math.max(8,Math.floor(width/9)),words=title.split(/\s+/),lines=[];let line='';for(const word of words){if(line&&`${line} ${word}`.length>maxChars){lines.push(line);line=word;}else line=line?`${line} ${word}`:word;}if(line)lines.push(line);const shown=lines.slice(0,4);if(lines.length>4)shown[3]=`${shown[3].slice(0,Math.max(0,maxChars-1))}…`;
  const text=shown.map((value,index)=>`<tspan x="${x+width/2}" dy="${index===0?-(shown.length-1)*7:14}">${escapeHtml(value)}</tspan>`).join(''),common=`fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"`,inner=`<text x="${x+width/2}" y="${y+height/2+4}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${Math.max(10,Math.min(24,Number(node.textSize)||13))}" fill="#263454">${text}</text>`;
  let shape='';
  switch(node.kind){
    case 'start':shape=`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height/2}" ${common}/>`;break;
    case 'end':shape=`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height/2}" ${common}/><rect x="${x+5}" y="${y+5}" width="${width-10}" height="${height-10}" rx="${(height-10)/2}" fill="none" stroke="${stroke}" stroke-width="1.5"/>`;break;
    case 'decision':shape=`<polygon points="${x+width/2},${y} ${x+width},${y+height/2} ${x+width/2},${y+height} ${x},${y+height/2}" ${common}/>`;break;
    case 'inputOutput':shape=`<polygon points="${x+width*.13},${y} ${x+width},${y} ${x+width*.87},${y+height} ${x},${y+height}" ${common}/>`;break;
    case 'subprocess':shape=`<rect x="${x}" y="${y}" width="${width}" height="${height}" ${common}/><path d="M${x+12} ${y}V${y+height}M${x+width-12} ${y}V${y+height}" stroke="${stroke}" stroke-width="1.5"/>`;break;
    case 'document':shape=`<path d="M${x} ${y}H${x+width}V${y+height*.72}C${x+width*.83} ${y+height*.69} ${x+width*.79} ${y+height*.98} ${x+width*.59} ${y+height*.9}C${x+width*.39} ${y+height*.82} ${x+width*.31} ${y+height*.72} ${x} ${y+height*.9}Z" ${common}/>`;break;
    case 'documents':shape=`<path d="M${x+10} ${y-4}H${x+width}V${y+height*.64}C${x+width*.84} ${y+height*.61} ${x+width*.79} ${y+height*.89} ${x+width*.6} ${y+height*.82}C${x+width*.4} ${y+height*.74} ${x+width*.32} ${y+height*.65} ${x+10} ${y+height*.82}Z" ${common}/><path d="M${x} ${y+5}H${x+width-10}V${y+height*.77}C${x+width*.78} ${y+height*.73} ${x+width*.74} ${y+height+2} ${x+width*.55} ${y+height*.92}C${x+width*.36} ${y+height*.84} ${x+width*.29} ${y+height*.76} ${x} ${y+height*.92}Z" ${common}/>`;break;
    case 'database':shape=`<path d="M${x} ${y+height*.15}C${x} ${y-height*.08} ${x+width} ${y-height*.08} ${x+width} ${y+height*.15}V${y+height*.85}C${x+width} ${y+height+height*.08} ${x} ${y+height+height*.08} ${x} ${y+height*.85}Z" ${common}/><path d="M${x} ${y+height*.15}C${x} ${y+height*.42} ${x+width} ${y+height*.42} ${x+width} ${y+height*.15}M${x} ${y+height*.5}C${x} ${y+height*.77} ${x+width} ${y+height*.77} ${x+width} ${y+height*.5}" fill="none" stroke="${stroke}"/>`;break;
    case 'connector':shape=`<circle cx="${x+width/2}" cy="${y+height/2}" r="${Math.min(width,height)/2}" ${common}/>`;break;
    case 'pageConnector':shape=`<path d="M${x+width*.07} ${y}H${x+width*.93}V${y+height*.68}L${x+width/2} ${y+height}L${x+width*.07} ${y+height*.68}Z" ${common}/>`;break;
    case 'preparation':shape=`<polygon points="${x+width*.14},${y} ${x+width*.86},${y} ${x+width},${y+height/2} ${x+width*.86},${y+height} ${x+width*.14},${y+height} ${x},${y+height/2}" ${common}/>`;break;
    case 'manualInput':shape=`<polygon points="${x},${y+height*.2} ${x+width},${y} ${x+width},${y+height} ${x},${y+height}" ${common}/>`;break;
    case 'display':shape=`<path d="M${x+width*.12} ${y}H${x+width*.88}L${x+width} ${y+height*.8}H${x}Z M${x+width/2} ${y+height*.8}V${y+height}M${x+width*.3} ${y+height}H${x+width*.7}" ${common}/>`;break;
    case 'delay':shape=`<path d="M${x+width*.3} ${y}V${y+height}H${x+width*.62}A${width*.32} ${height/2} 0 0 0 ${x+width*.62} ${y}Z" ${common}/>`;break;
    case 'note':shape=`<path d="M${x} ${y}H${x+width*.72}L${x+width} ${y+height*.28}V${y+height}H${x}Z M${x+width*.72} ${y}V${y+height*.28}H${x+width}" ${common}/>`;break;
    default:shape=`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" ${common}/>`;
  }
  return `<g class="flow-node-export">${shape}${inner}</g>`;
}
function exportSvg() {
  const d = current();
  const flowDiagram = d.type === 'fluxo';
  const maxX = Math.max(900, ...d.nodes.map(n => n.x + (flowDiagram ? Math.max(180,Number(n.width)||0) + 60 : 270))); const maxY = Math.max(560, ...d.nodes.map(n => n.y + (flowDiagram ? Math.max(70,Number(n.height)||0) + 60 : 170)));
  if(d.type==='istar'){
    const actorKinds=['istarBoundary','istarAgent','istarRole'];
    const visible=iStarVisibleNodes(d);
    const exportLeft=Math.min(0,...visible.filter(node=>isIStarActor(node)&&!actorCollapsed(d,node)).map(node=>node.x-36));
    const exportTop=Math.min(0,...visible.filter(node=>isIStarActor(node)&&!actorCollapsed(d,node)).map(node=>node.y-36));
    const extentX=Math.max(900,...visible.map(node=>node.x+(actorKinds.includes(node.kind)?(actorCollapsed(d,node)?112:Number(node.width)||300):170)+40));
    const extentY=Math.max(560,...visible.map(node=>node.y+(actorKinds.includes(node.kind)?(actorCollapsed(d,node)?112:Number(node.height)||200):60)+40));
    const actorType=node=>node.istar?.actorType||({istarBoundary:'actor',istarAgent:'agent',istarRole:'role'})[node.kind];
    const actorMarker=(type,cx,cy,r)=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#d5eed9" stroke="#376447" stroke-width="1.6"/>${type==='agent'?`<path d="M ${cx-r} ${cy-r*.48} L ${cx+r} ${cy-r*.48}" stroke="#376447" stroke-width="1.6"/>`:type==='role'?`<path d="M ${cx-r*.75} ${cy+r*.62} Q ${cx} ${cy+r*1.05} ${cx+r*.75} ${cy+r*.62}" fill="none" stroke="#376447" stroke-width="1.6"/>`:''}`;
    const nodes=[...visible].sort((a,b)=>Number(isIStarActor(b))-Number(isIStarActor(a))).map(node=>{
      const sd=actorCollapsed(d,node),title=escapeHtml(node.title),icon=d.istar?.stereotypes?.find(item=>item.id===node.istar?.stereotypeId)?.svg||'';
      if(actorKinds.includes(node.kind)){
        const w=sd?112:Number(node.width)||420,h=sd?112:Number(node.height)||300;
        const cx=node.x+(sd?56:28),cy=node.y+(sd?56:28);
        return `<g>${sd?'':`<rect x="${node.x}" y="${node.y}" width="${w}" height="${h}" rx="32" fill="#e8f0e9" fill-opacity=".22" stroke="#78a884" stroke-dasharray="9 5" stroke-width="2"/>`}${actorMarker(actorType(node),cx,cy,54)}<text x="${cx}" y="${cy+4}" text-anchor="middle" font-family="Arial" font-size="12" fill="#21452b">${title}</text><text x="${cx}" y="${cy+22}" text-anchor="middle" font-family="Arial" font-size="9" fill="#315b3a">${({actor:'Ator',agent:'Agente',role:'Papel'})[actorType(node)]||'Ator'}</text></g>`;
      }
      const shape=iStarShapeMarkup(node.kind,170,60).replaceAll('currentColor','#ddf2e0').replaceAll('var(--istar-stroke)','#376447');
      return `<g transform="translate(${node.x} ${node.y})">${shape}<text x="85" y="34" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="#163b25">${title}</text>${icon?`<g transform="translate(145 4) scale(.2)">${icon.replace(/<\/?svg[^>]*>/g,'')}</g>`:''}</g>`;
    }).join('');
    const connections=$('#connections').innerHTML.replace(/<circle[^>]*data-flow-(?:corner|curve)[^>]*><\/circle>/g,'').replace(/<path[^>]*class="edge-hit"[^>]*><\/path>/g,'');
    const styles='<style>.connection-line{fill:none;stroke:#63708a;stroke-width:2}.istar-edge-decoration{fill:none;stroke:#63708a;stroke-width:2.4}.istar-needed-circle{fill:#fff;stroke:#63708a;stroke-width:2}.istar-dependency-d{fill:#d7efdb;stroke:#426d4d;stroke-width:1.8}.istar-dependum text{font:700 10px Arial;fill:#1e4129}.istar-edge-label{font:700 11px Arial;fill:#34435d;paint-order:stroke;stroke:#fff;stroke-width:4}.istar-edge.qualification .connection-line{stroke-dasharray:2 5}</style>';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${extentX-exportLeft}" height="${extentY-exportTop}" viewBox="${exportLeft} ${exportTop} ${extentX-exportLeft} ${extentY-exportTop}"><rect x="${exportLeft}" y="${exportTop}" width="100%" height="100%" fill="#fbfcfe"/>${styles}${connections}${nodes}</svg>`;
  }
  if(d.type==='usecase'){
    const byId=new Map(d.nodes.map(node=>[node.id,node])),dimensions=node=>node.kind==='systemBoundary'?{w:Number(node.width)||480,h:Number(node.height)||360}:node.kind==='actor'?{w:90,h:132}:node.kind==='useCase'?{w:210,h:86}:{w:180,h:52};
    const bound=(node,other)=>{const a=dimensions(node),b=dimensions(other);let dx=other.x+b.w/2-(node.x+a.w/2),dy=other.y+b.h/2-(node.y+a.h/2),len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;const scale=node.kind==='useCase'?1/Math.sqrt((dx/(a.w/2))**2+(dy/(a.h/2))**2):Math.min(a.w/2/Math.max(Math.abs(dx),.001),a.h/2/Math.max(Math.abs(dy),.001));return{x:node.x+a.w/2+dx*scale,y:node.y+a.h/2+dy*scale,dx,dy};};
    const defs='<defs><marker id="uc-arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M1 1 L10 6 L1 11" fill="none" stroke="#46536d" stroke-width="1.5"/></marker><marker id="uc-triangle" markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto"><path d="M1 1 L12 7 L1 13 Z" fill="white" stroke="#46536d" stroke-width="1.5"/></marker></defs>';
    const edges=d.edges.map(edge=>{const a=byId.get(edge.from),b=byId.get(edge.to);if(!a||!b)return'';const p=bound(a,b),q=bound(b,a),x=(p.x+q.x)/2,y=(p.y+q.y)/2,marker=edge.type==='generalization'?'uc-triangle':['include','extend'].includes(edge.type)?'uc-arrow':'';return `<g><path d="M${p.x} ${p.y} L${q.x} ${q.y}" fill="none" stroke="#58647c" stroke-width="1.8" ${['include','extend'].includes(edge.type)?'stroke-dasharray="8 6"':''} ${marker?`marker-end="url(#${marker})"`:''}/>${['include','extend'].includes(edge.type)?`<text x="${x}" y="${y-8}" text-anchor="middle" font-family="Arial" font-size="11" fill="#46536d">«${edge.type}»</text>`:''}</g>`;}).join('');
    const actor=(n)=>{if(n.representation==='rect')return `<rect x="${n.x}" y="${n.y}" width="140" height="62" fill="white" stroke="#46536d" stroke-width="2"/><text x="${n.x+70}" y="${n.y+22}" text-anchor="middle" font-family="Arial" font-size="10">«actor»</text><text x="${n.x+70}" y="${n.y+44}" text-anchor="middle" font-family="Arial" font-size="13">${escapeHtml(n.title)}</text>`;const cx=n.x+45;return `<circle cx="${cx}" cy="${n.y+13}" r="8" fill="white" stroke="#46536d" stroke-width="2"/><path d="M${cx} ${n.y+21}V${n.y+58} M${cx-22} ${n.y+35}L${cx+22} ${n.y+35} M${cx} ${n.y+58}L${cx-17} ${n.y+80} M${cx} ${n.y+58}L${cx+17} ${n.y+80}" fill="none" stroke="#46536d" stroke-width="2"/><text x="${cx}" y="${n.y+105}" text-anchor="middle" font-family="Arial" font-size="13">${escapeHtml(n.title)}</text>`;};
    const nodes=[...d.nodes].sort((a,b)=>(a.kind==='systemBoundary'?-1:0)-(b.kind==='systemBoundary'?-1:0)).map(n=>n.kind==='systemBoundary'?`<rect x="${n.x}" y="${n.y}" width="${Number(n.width)||480}" height="${Number(n.height)||360}" fill="none" stroke="#39475f" stroke-width="2"/><text x="${n.x+(Number(n.width)||480)/2}" y="${n.y+26}" text-anchor="middle" font-family="Arial" font-size="16">${escapeHtml(n.title)}</text>`:n.kind==='actor'?actor(n):n.kind==='useCase'?`<ellipse cx="${n.x+105}" cy="${n.y+43}" rx="105" ry="43" fill="white" stroke="#46536d" stroke-width="2"/><text x="${n.x+105}" y="${n.y+48}" text-anchor="middle" font-family="Arial" font-size="13">${escapeHtml(n.title)}</text>`:`<text x="${n.x}" y="${n.y+18}" font-family="Arial" font-size="12">${escapeHtml(n.title)}</text>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" viewBox="0 0 ${maxX} ${maxY}"><rect width="100%" height="100%" fill="#fbfcfe"/>${defs}${edges}${nodes}</svg>`;
  }
  const defs = `<style>text{font-family:Arial,sans-serif;fill:#263454}.title{font-size:14px;font-weight:bold}.field{font-size:11px;fill:#64718a}.edge{stroke:#aeb7cf;stroke-width:2;fill:none}.edge-symbol line{stroke:#7d89a4;stroke-width:2.4;stroke-linecap:round}.edge-symbol circle{fill:#fbfcfe;stroke:#7d89a4;stroke-width:2.4}${d.type === 'fluxo' ? '.flow-comment{font-size:11px;font-weight:bold;fill:#53627f;paint-order:stroke;stroke:#fbfcfe;stroke-width:5px}' : '.edge-label{font-size:10px;font-weight:bold;fill:#76829c}'}</style>`;
  const flow = d.type === 'fluxo';
  const layouts = Object.fromEntries(d.nodes.map(n => { const diamond=['relationship','decision'].includes(n.kind),flowWidth=n.kind==='decision'?flowDecisionSize(n):Number(n.width)||(n.kind==='decision'?110:['start','end'].includes(n.kind)?160:n.kind==='connector'?66:180),flowHeight=n.kind==='decision'?flowDecisionSize(n):Number(n.height)||(n.kind==='decision'?110:['start','end'].includes(n.kind)?70:n.kind==='connector'?66:70); const width=flow?flowWidth:diamond?100:180; const height=flow?flowHeight:diamond?100:Math.max(52,37+(n.fields?.length||0)*19+(n.description?25:0)); return [n.id,{x:n.x+width/2,y:n.y+height/2,w:width,h:height}]; }));
  const exportBoundary = (node, other) => { const a=layouts[node.id], b=layouts[other.id]; let dx=b.x-a.x,dy=b.y-a.y; const len=Math.hypot(dx,dy)||1; dx/=len;dy/=len;let scale;if(flow&&node.kind==='decision')scale=1/(Math.abs(dx)/(a.w/2)+Math.abs(dy)/(a.h/2));else if(flow&&['start','end','connector'].includes(node.kind))scale=1/Math.sqrt((dx/(a.w/2))**2+(dy/(a.h/2))**2);else scale=Math.min(a.w/2/Math.max(Math.abs(dx),.001),a.h/2/Math.max(Math.abs(dy),.001));return {x:a.x+dx*scale,y:a.y+dy*scale,dx,dy}; };
  const edges = d.edges.map(e => {
    const a = d.nodes.find(n => n.id === e.from), b = d.nodes.find(n => n.id === e.to);
    if (!a || !b) return '';
    const pa = exportBoundary(a,b), pb = exportBoundary(b,a);
    if (flow) {
      const shape = flowShape(e,pa,pb);
      const comment = String(e.comment || '').replace(/\s+/g,' ').trim();
      const label=String(e.label||'').replace(/\s+/g,' ').trim(),direction=e.direction||'forward',endMarker=['forward','both'].includes(direction)?' marker-end="url(#flowExportArrow)"':'',startMarker=['backward','both'].includes(direction)?' marker-start="url(#flowExportArrow)"':'',stroke=/^#[\da-f]{6}$/i.test(e.color||'')?e.color:'#aeb7cf';
      return `<g><path class="edge" d="${shape.path}" style="stroke:${stroke}"${startMarker}${endMarker}/>${label?`<text class="flow-edge-label" x="${shape.label.x}" y="${shape.label.y-10}" text-anchor="middle">${escapeHtml(label)}</text>`:''}${comment ? `<text class="flow-comment" x="${shape.label.x}" y="${shape.label.y+15}" text-anchor="middle">${escapeHtml(comment)}</text>` : ''}</g>`;
    }
    normalizeEdge(e);
    const ma = endpointMark(pa,e.fromMin,e.fromMax,'from'), mb = endpointMark(pb,e.toMin,e.toMax,'to');
    const midX = (ma.end.x+mb.end.x)/2, midY = (ma.end.y+mb.end.y)/2;
    return `<g class="edge-symbol">${ma.markup}${mb.markup}<path class="edge" d="M ${ma.end.x} ${ma.end.y} L ${mb.end.x} ${mb.end.y}"/><text class="edge-label" x="${midX}" y="${midY-8}" text-anchor="middle">${e.fromMax}:${e.toMax}</text></g>`;
  }).join('');
  const flowDefs = flow ? '<defs><marker id="flowExportArrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#7d89a4" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>' : '';
  const nodes = flow?d.nodes.map(flowSvgNode).join(''):d.nodes.map(n => { const diamond = ['relationship','decision'].includes(n.kind); const height = Math.max(52, 37 + (n.fields?.length || 0) * 19 + (n.description ? 25 : 0)); const shape = diamond ? `<polygon points="${n.x+50},${n.y} ${n.x+100},${n.y+50} ${n.x+50},${n.y+100} ${n.x},${n.y+50}" fill="#fff9ee" stroke="#e7c889" stroke-width="2"/>` : `<rect x="${n.x}" y="${n.y}" width="180" height="${height}" rx="11" fill="${n.kind === 'note' ? '#fffdf1' : '#fff'}" stroke="${n.kind === 'table' ? n.color : '#cdd2eb'}" stroke-width="2"/>`; const tx = n.x + (diamond ? 50 : 13), ty = n.y + (diamond ? 54 : 24); return `${shape}<text class="title" x="${tx}" y="${ty}" ${diamond ? 'text-anchor="middle"' : ''}>${escapeHtml(n.title)}</text>${!diamond ? (n.fields || []).map((f,i) => `<text class="field" x="${n.x+13}" y="${n.y+48+i*19}">${escapeHtml(n.kind === 'table' ? tableFieldLabel(f) : f)}</text>`).join('') : ''}`; }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" viewBox="0 0 ${maxX} ${maxY}"><rect width="100%" height="100%" fill="#fbfcfe"/>${defs}${flowDefs}${edges}${nodes}</svg>`;
}
function exportFlowPng(){const svg=exportSvg(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),image=new Image();image.onload=()=>{try{const canvas=document.createElement('canvas'),viewBox=svg.match(/viewBox="[^"]*?([\d.]+) ([\d.]+)"/),width=Math.max(1,Number(viewBox?.[1])||image.naturalWidth),height=Math.max(1,Number(viewBox?.[2])||image.naturalHeight);canvas.width=Math.min(12000,width);canvas.height=Math.min(12000,height);const context=canvas.getContext('2d');context.fillStyle='#fbfcfe';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>{if(blob){const pngUrl=URL.createObjectURL(blob),link=document.createElement('a');link.href=pngUrl;link.download=`${slug(current().title)}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(pngUrl),1000);toast('Imagem PNG exportada.');}else toast('Não foi possível gerar o PNG.');},'image/png');}catch(error){toast(`Não foi possível exportar PNG: ${error.message}`);}finally{URL.revokeObjectURL(url);}};image.onerror=()=>{URL.revokeObjectURL(url);toast('Não foi possível renderizar o SVG para PNG.');};image.src=url;}
function printDiagramPdf(){const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;width:0;height:0;border:0;right:0;bottom:0';frame.srcdoc=`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(current().title)}</title><style>@page{margin:12mm}html,body{margin:0;background:#fff}img{display:block;max-width:100%;max-height:96vh;margin:auto;object-fit:contain}@media print{img{width:100%;max-height:96vh}}</style></head><body><img alt="${escapeHtml(current().title)}" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(exportSvg())}"><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),150));window.addEventListener('afterprint',()=>parent.postMessage('brmodelo-print-finished','*'))<\/script></body></html>`;document.body.append(frame);const cleanup=event=>{if(event.data==='brmodelo-print-finished'){frame.remove();window.removeEventListener('message',cleanup);toast('Janela de impressão aberta. Escolha Salvar como PDF.');}};window.addEventListener('message',cleanup);setTimeout(()=>{if(frame.isConnected)frame.remove();window.removeEventListener('message',cleanup);},120000);}
function showExport() { const flow=current().type==='fluxo';showModal('Exportar projeto', `<p class="modal-copy">Escolha o formato que deseja baixar.</p><div class="modal-options"><label class="modal-option"><input type="radio" name="exportType" value="json" checked><span class="shape-icon">{ }</span><div><strong>Projeto JSON</strong><br><span>Para salvar e continuar editando depois</span></div></label><label class="modal-option"><input type="radio" name="exportType" value="svg"><span class="shape-icon">▧</span><div><strong>Diagrama SVG</strong><br><span>Imagem vetorial do diagrama atual</span></div></label>${flow?`<label class="modal-option"><input type="radio" name="exportType" value="png"><span class="shape-icon">▧</span><div><strong>Imagem PNG</strong><br><span>Imagem rasterizada do fluxograma</span></div></label><label class="modal-option"><input type="radio" name="exportType" value="pdf"><span class="shape-icon">▤</span><div><strong>PDF</strong><br><span>Abrir impressão e escolher Salvar como PDF</span></div></label>`:''}</div>`, 'Exportar', () => { const type = modal.querySelector('[name="exportType"]:checked')?.value; if(type==='png')return exportFlowPng();if(type==='pdf')return printDiagramPdf();if (type === 'svg') download(`${slug(current().title)}.svg`, 'image/svg+xml', exportSvg()); else download(`${slug(state.title)}.json`, 'application/json', JSON.stringify(state, null, 2)); toast('Arquivo exportado'); }); }
function validateImport(value) { if (!value || typeof value.title !== 'string' || !Array.isArray(value.diagrams) || !value.diagrams.length) return false; return value.diagrams.every(d => typeof d.id === 'string' && typeof d.type === 'string' && Array.isArray(d.nodes) && Array.isArray(d.edges) && d.nodes.every(n => typeof n.id === 'string' && typeof n.kind === 'string' && typeof n.title === 'string' && Number.isFinite(n.x) && Number.isFinite(n.y) && Array.isArray(n.fields)) && d.edges.every(e => typeof e.id === 'string' && typeof e.from === 'string' && typeof e.to === 'string')); }
function importFile(file) { if (!file) return; if (file.size > 5_000_000) return toast('O arquivo é grande demais (máximo 5 MB)'); file.text().then(text => { try { const parsed = JSON.parse(text); if(parsed?.format==='brmodelo.uml-activity'){const project=parseActivityProject(parsed),key='brmodelo.uml-activity.projects.v1',projects=JSON.parse(localStorage.getItem(key)||'{}');projects[project.id]=project;localStorage.setItem(key,JSON.stringify(projects));localStorage.setItem('brmodelo.uml-activity.project.v1',JSON.stringify(project));openActivityDiagram(project.id,project.activeDiagramId);switchView('editor');toast('Projeto de atividades UML importado');return;} if (!validateImport(parsed)) throw new Error(); snapshot(); state = normalizeProjectTables(parsed); state.active = state.diagrams.some(d => d.id === state.active) ? state.active : state.diagrams[0].id; rememberActiveTab('studio',state.id,state.active); selectedId = null; selectedEdge = null; render(); save(); toast('Projeto importado'); } catch (error) { toast(error?.message||'Arquivo JSON inválido para este editor'); } }); }

viewport.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('application/brmodelo-kind')) e.preventDefault(); });
viewport.addEventListener('drop', e => { const kind = e.dataTransfer.getData('application/brmodelo-kind'); if (!kind || !labels[kind]) return; e.preventDefault(); const p = screenToCanvas(e.clientX, e.clientY); const owner=current().type==='istar'?[...current().nodes].reverse().find(n=>isIStarActor(n)&&!actorCollapsed(current(),n)&&p.x>=n.x&&p.x<=n.x+n.width&&p.y>=n.y&&p.y<=n.y+n.height):null;addNode(kind, p.x - 60, p.y - 20,owner?.id); });
function addFlowCorner(edge, point) {
  const route = normalizeFlowRoute(edge);
  const a = nodeAt(edge.from), b = nodeAt(edge.to);
  if (!a || !b) return;
  const segment = flowNearestSegment(editableConnectionShape(edge).segments,point);
  snapshot();
  route.corners.splice(segment,0,{x:Math.round(point.x),y:Math.round(point.y)});
  const shifted = {};
  for (const [index,control] of Object.entries(route.curves)) {
    const number = Number(index);
    if (number < segment) shifted[number] = control;
    else if (number > segment) shifted[number+1] = control;
  }
  route.curves = shifted;
  renderEdges(); renderInspector(); save();
}
function removeFlowCorner(edge, index) {
  const route = normalizeFlowRoute(edge);
  if (!route.corners[index]) return;
  snapshot();
  route.corners.splice(index,1);
  const shifted = {};
  for (const [segment,control] of Object.entries(route.curves)) {
    const number = Number(segment);
    if (number < index) shifted[number] = control;
    else if (number > index+1) shifted[number-1] = control;
  }
  route.curves = shifted;
  renderEdges(); renderInspector(); save();
}
function startFlowPointer(event, edgeId) {
  if(current().type==='istar')selectConnection(edgeId);
  if (event.button !== 0 || (tool !== 'select' && selectedEdge !== edgeId)) { selectConnection(edgeId); return; }
  const edge = current().edges.find(item => item.id === edgeId);
  if (!edge) return;
  const point = screenToCanvas(event.clientX,event.clientY);
  const cornerHandle = event.target.closest('[data-flow-corner]');
  const curveHandle = event.target.closest('[data-flow-curve]');
  const kind = cornerHandle ? 'corner' : curveHandle ? 'curve' : 'line';
  if ((kind === 'line' || kind === 'curve' || kind === 'corner') && lastFlowClick?.edgeId === edgeId && lastFlowClick.kind === kind && (kind !== 'corner' || lastFlowClick.index === Number(cornerHandle.dataset.flowCorner)) && Date.now()-lastFlowClick.time < 400 && Math.hypot(event.clientX-lastFlowClick.x,event.clientY-lastFlowClick.y) < 18) {
    lastFlowClick = null;
    if (kind === 'corner') removeFlowCorner(edge,Number(cornerHandle.dataset.flowCorner));
    else addFlowCorner(edge,point);
    return;
  }
  const route = normalizeFlowRoute(edge);
  const a = nodeAt(edge.from), b = nodeAt(edge.to);
  const shape = editableConnectionShape(edge);
  const index = kind === 'corner' ? Number(cornerHandle.dataset.flowCorner) : kind === 'curve' ? Number(curveHandle.dataset.flowCurve) : flowNearestSegment(shape.segments,point);
  const segment = shape.segments[kind === 'corner' ? Math.min(index,shape.segments.length-1) : index];
  if (!segment) return;
  const initial = kind === 'corner' ? {...route.corners[index]} : {...(segment.control || {x:(segment.a.x+segment.b.x)/2,y:(segment.a.y+segment.b.y)/2})};
  flowDrag = {edge,kind,index,x:event.clientX,y:event.clientY,initial,moved:false};
  viewport.setPointerCapture(event.pointerId);
  selectConnection(edgeId);
}
viewport.addEventListener('pointerdown', event => {
  // Give connection selection priority over canvas pan. Otherwise an edge
  // click while the Move tool is active is consumed here and never reaches
  // selectConnection(), which also activates the Connect tool.
  const edgeId = event.target.closest('[data-edge]')?.dataset.edge;
  if (event.button === 0 && edgeId) {
    if (['fluxo','istar'].includes(current().type)) startFlowPointer(event,edgeId);
    else selectConnection(edgeId);
    return;
  }
  if (tool === 'pan' || event.button === 1 || spacePanActive) { drag = {type:'pan',x:event.clientX,y:event.clientY,px:pan.x,py:pan.y}; viewport.setPointerCapture(event.pointerId); return; }
  if (event.target.closest('.node')) return;
  lastFlowClick = null;
  if (tool !== 'select' || event.button !== 0) return;
  if (!event.shiftKey) { selectedIds.clear(); selectedId = null; selectedEdge = null; renderInspector(); $('#nodes').querySelectorAll('.node').forEach(el => el.classList.remove('selected')); renderEdges(); }
  const point = screenToCanvas(event.clientX,event.clientY);
  drag = {type:'selection-box',x:event.clientX,y:event.clientY,point,additive:event.shiftKey,base:new Set(selectedIds)};
  viewport.setPointerCapture(event.pointerId);
});
document.addEventListener('pointermove', event => {
  if(drag?.type==='flow-connect'){
    event.preventDefault();if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>4)drag.moved=true;
    const start=flowAnchorPoint(nodeAt(drag.from),drag.side),point=screenToCanvas(event.clientX,event.clientY),preview=$('#flowConnectionPreview');if(preview)preview.setAttribute('d',`M ${start.x} ${start.y} L ${point.x} ${point.y}`);
    const over=document.elementFromPoint(event.clientX,event.clientY)?.closest('.node');$('#nodes').querySelectorAll('.flow-connect-hover').forEach(el=>el.classList.remove('flow-connect-hover'));if(over&&over.dataset.id!==drag.from&&nodeAt(over.dataset.id)?.kind!=='start')over.classList.add('flow-connect-hover');return;
  }
  if (flowDrag) {
    const dx = (event.clientX-flowDrag.x)/zoom, dy = (event.clientY-flowDrag.y)/zoom;
    if (!flowDrag.moved && Math.hypot(event.clientX-flowDrag.x,event.clientY-flowDrag.y) < 5) return;
    if (!flowDrag.moved) { snapshot(); flowDrag.moved = true; lastFlowClick = null; }
    const route = flowDrag.edge.route;
    if (flowDrag.kind === 'corner') route.corners[flowDrag.index] = {x:Math.round(flowDrag.initial.x+dx),y:Math.round(flowDrag.initial.y+dy)};
    else route.curves[flowDrag.index] = {x:Math.round(flowDrag.initial.x+dx*2),y:Math.round(flowDrag.initial.y+dy*2)};
    renderEdges();
    if(current().type==='fluxo')renderNodes();
    return;
  }
  if (!drag) return;
  if (drag.type === 'node' || drag.type === 'nodes' || drag.type === 'selection-box' || drag.type === 'table-resize' || drag.type==='flow-node-resize'||drag.type==='usecase-resize') event.preventDefault();
  if (drag.type === 'selection-box') {
    const currentPoint = screenToCanvas(event.clientX,event.clientY), left = Math.min(drag.point.x,currentPoint.x), top = Math.min(drag.point.y,currentPoint.y), right = Math.max(drag.point.x,currentPoint.x), bottom = Math.max(drag.point.y,currentPoint.y);
    if (Math.hypot(event.clientX-drag.x,event.clientY-drag.y) < 4) return;
    selectedIds = new Set(drag.base);
    for (const n of current().nodes) {
      const el = $('#nodes').querySelector(`[data-id="${CSS.escape(n.id)}"]`); if (!el) continue;
      const w = el.offsetWidth, h = el.offsetHeight;
      if (n.x < right && n.x+w > left && n.y < bottom && n.y+h > top) selectedIds.add(n.id);
    }
    selectedId = [...selectedIds].at(-1) || null;
    $('#nodes').querySelectorAll('.node').forEach(el => el.classList.toggle('selected', selectedIds.has(el.dataset.id)));
    let box = viewport.querySelector('.canvas-selection-box'); if (!box) { box = document.createElement('div'); box.className='canvas-selection-box'; viewport.append(box); }
    const bounds = viewport.getBoundingClientRect(); box.style.left=`${Math.min(drag.x,event.clientX)-bounds.left}px`; box.style.top=`${Math.min(drag.y,event.clientY)-bounds.top}px`; box.style.width=`${Math.abs(event.clientX-drag.x)}px`; box.style.height=`${Math.abs(event.clientY-drag.y)}px`;
    return;
  }
  if (drag.type === 'nodes') {
    let dx = (event.clientX-drag.x)/zoom, dy = (event.clientY-drag.y)/zoom;
    if(current().type==='istar'){dx=Math.max(dx,-Math.min(...Object.values(drag.origins).map(p=>p.x)));dy=Math.max(dy,-Math.min(...Object.values(drag.origins).map(p=>p.y)));}
    if (!drag.moved && Math.hypot(dx,dy) > 3) { snapshot(); drag.moved = true; }
    for (const id of drag.ids) { const n=nodeAt(id),origin=drag.origins[id]; if(!n||!origin)continue; const nextX=Math.max(0,snapToGrid?Math.round((origin.x+dx)/20)*20:Math.round(origin.x+dx)),nextY=Math.max(0,snapToGrid?Math.round((origin.y+dy)/20)*20:Math.round(origin.y+dy));if(current().type==='istar'&&isIStarActor(n)&&n.istar?.layoutOrigin){n.istar.layoutOrigin.x+=nextX-n.x;n.istar.layoutOrigin.y+=nextY-n.y;} n.x=nextX;n.y=nextY; const el=$('#nodes').querySelector(`[data-id="${CSS.escape(id)}"]`); if(el){el.style.left=`${n.x}px`;el.style.top=`${n.y}px`;} }
    if(current().type==='istar'){for(const id of drag.ids){const n=nodeAt(id);if(!n)continue;resizeIStarOwner(current(),n);const el=$('#nodes').querySelector(`[data-id="${CSS.escape(id)}"]`);if(el){el.style.left=`${n.x}px`;el.style.top=`${n.y}px`;}}for(const actor of current().nodes.filter(isIStarActor)){const el=$('#nodes').querySelector(`[data-id="${CSS.escape(actor.id)}"]`);if(el){el.style.left=`${actor.x}px`;el.style.top=`${actor.y}px`;if(!actorCollapsed(current(),actor)){el.style.width=`${actor.width}px`;el.style.height=`${actor.height}px`;}}}}
    renderEdges();
    if(current().type==='fluxo')renderNodes();
  } else if(drag.type==='flow-node-resize'){
    const node=nodeAt(drag.id);if(!node)return;
    const deltaX=(event.clientX-drag.x)/zoom,deltaY=(event.clientY-drag.y)/zoom;
    const decisionSize=node.kind==='decision'?Math.max(90,Math.min(360,Math.round(drag.width+(Math.abs(deltaX)>=Math.abs(deltaY)?deltaX:deltaY)))):null;
    const width=decisionSize??Math.max(90,Math.min(600,Math.round(drag.width+deltaX))),height=decisionSize??Math.max(52,Math.min(360,Math.round(drag.height+deltaY)));
    if(width!==node.width||height!==node.height){if(!drag.moved){snapshot();drag.moved=true;}node.width=width;node.height=height;const el=$(`#nodes [data-id="${CSS.escape(node.id)}"]`);if(el){el.style.width=`${width}px`;el.style.height=`${height}px`;}renderEdges();}
  } else if(drag.type==='table-resize'){
    const node=nodeAt(drag.id);if(!node)return;
    const width=Math.max(190,Math.min(480,Math.round(drag.width+(event.clientX-drag.x)/zoom)));
    if(width!==node.width){if(!drag.moved){snapshot();drag.moved=true;}node.width=width;const el=$(`#nodes [data-id="${CSS.escape(node.id)}"]`);if(el)el.style.width=`${width}px`;renderEdges();}
  } else if(drag.type==='usecase-resize'){
    const node=nodeAt(drag.id);if(!node)return;const dx=(event.clientX-drag.x)/zoom,dy=(event.clientY-drag.y)/zoom;
    const minWidth=node.kind==='useCase'?150:250,minHeight=node.kind==='useCase'?70:180,maxWidth=node.kind==='systemBoundary'?3200:900,maxHeight=node.kind==='systemBoundary'?2400:700;
    const width=Math.max(minWidth,Math.min(maxWidth,Math.round(drag.width+(drag.edge==='left'?-dx:dx)))),height=Math.max(minHeight,Math.min(maxHeight,Math.round(drag.height+(drag.edge==='right-bottom'?dy:0))));
    const x=drag.edge==='left'?Math.max(0,Math.round(drag.nodeX+drag.width-width)):drag.nodeX;
    if(width!==node.width||height!==node.height||x!==node.x){if(!drag.moved){snapshot();drag.moved=true;}node.width=width;node.height=height;node.x=x;const el=$(`#nodes [data-id="${CSS.escape(node.id)}"]`);if(el){el.style.left=`${x}px`;el.style.width=`${width}px`;el.style.height=`${height}px`;}renderEdges();}
  } else { pan.x = drag.px+event.clientX-drag.x; pan.y = drag.py+event.clientY-drag.y; renderTransform(); }
});
document.addEventListener('pointerup', event => {
  if(drag?.type==='flow-connect'){
    const source=drag.from,target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.node'),targetId=target?.dataset.id;
    $('#flowConnectionPreview')?.remove();$('#nodes').querySelectorAll('.flow-connect-target,.flow-connect-hover').forEach(el=>el.classList.remove('flow-connect-target','flow-connect-hover'));
    if(!drag.moved){const sourceId=drag.from,side=drag.side;drag=null;return openFlowQuickCreate(sourceId,side);}
    if(targetId&&targetId!==source&&nodeAt(targetId)?.kind!=='start'&&drag.moved&&!current().edges.some(edge=>edge.from===source&&edge.to===targetId)){snapshot();current().edges.push(createFlowEdge(source,targetId));tool='select';connectFrom=null;render();save();toast('Conexão criada.');}
    else if(targetId&&nodeAt(targetId)?.kind==='start')toast('Uma conexão não pode entrar no elemento Início.');
    drag=null;return;
  }
  if (flowDrag) {
    if (flowDrag.moved) { renderInspector(); save(); }
    else if (flowDrag.kind === 'line' || flowDrag.kind === 'curve' || flowDrag.kind === 'corner') lastFlowClick = {edgeId:flowDrag.edge.id,kind:flowDrag.kind,index:flowDrag.index,time:Date.now(),x:event.clientX,y:event.clientY};
    flowDrag = null;
    return;
  }
  if (drag?.type === 'nodes' && drag.moved) { if(current().type==='istar'){for(const id of drag.ids){const n=nodeAt(id);if(n&&!n.istar?.ownerId)placeIStarElement(current(),n);}renderNodes();renderEdges();} renderInspector(); save(); }
  if(drag?.type==='table-resize'&&drag.moved){renderNodes();renderEdges();renderInspector();save();}
  if(drag?.type==='flow-node-resize'&&drag.moved){renderNodes();renderEdges();renderInspector();save();}
  if(drag?.type==='usecase-resize'&&drag.moved){renderNodes();renderEdges();renderInspector();save();}
  if (drag?.type === 'selection-box' && drag.moved) { renderInspector(); }
  if (drag?.type === 'selection-box') { viewport.querySelector('.canvas-selection-box')?.remove(); if(drag.moved){renderInspector();renderEdges();} }
  drag = null;
});
viewport.addEventListener('wheel', e => { e.preventDefault(); if (e.ctrlKey || e.metaKey) { zoom = Math.min(2, Math.max(.15, zoom + (e.deltaY < 0 ? .1 : -.1))); } else if (e.shiftKey) { pan.x -= e.deltaX || e.deltaY; } else { pan.y -= e.deltaY; } renderTransform(); }, {passive: false});
$('#editTools').addEventListener('click', e => { const button = e.target.closest('[data-tool]'); if (button) setTool(button.dataset.tool); });
$('.layout-menu').addEventListener('click',event=>{const button=event.target.closest('[data-layout-action]');if(!button)return;event.preventDefault();if(button.dataset.layoutAction==='toggle-snap'){snapToGrid=!snapToGrid;localStorage.setItem('brmodelo-snap-to-grid',String(snapToGrid));button.setAttribute('aria-pressed',String(snapToGrid));button.textContent=`${snapToGrid?'✓':'○'} Ajustar ao grid (20 px)`;return;}runLayoutAction(button.dataset.layoutAction);$('.layout-menu').open=false;});
$('#connections').addEventListener('click', e => {
  const hit = e.target.closest('[data-edge-hit]');
  const group = e.target.closest('[data-edge]');
  const edge = hit?.dataset.edgeHit || group?.dataset.edge;
  if (edge) { e.preventDefault(); e.stopPropagation(); selectConnection(edge); }
});
function openDiagramContextMenu(event, kind, id) {
  event.preventDefault(); event.stopPropagation();
  const menu=$('#diagramContextMenu');
  if(kind==='node'){
    if(!selectedIds.has(id))selectedIds=new Set([id]);
    selectedId=id;selectedEdge=null;renderNodes();renderInspector();
  }else{
    selectedIds.clear();selectConnection(id);
  }
  contextTarget={kind,id,multiple:kind==='node'&&selectedIds.size>1};
  menu.querySelectorAll('[data-flow-context]').forEach(button=>button.hidden=current().type!=='fluxo'||kind!=='node');
  menu.querySelector('[data-context-action="paste"]').disabled=!copiedElements;
  menu.classList.remove('hidden');
  const bounds=viewport.getBoundingClientRect(),left=event.clientX-bounds.left,top=event.clientY-bounds.top;
  menu.style.left=`${Math.max(6,Math.min(left,bounds.width-menu.offsetWidth-6))}px`;
  menu.style.top=`${Math.max(6,Math.min(top,bounds.height-menu.offsetHeight-6))}px`;
}
$('#nodes').addEventListener('contextmenu',event=>{const element=event.target.closest('.node');if(element)openDiagramContextMenu(event,'node',element.dataset.id);});
$('#connections').addEventListener('contextmenu',event=>{const element=event.target.closest('[data-edge]');if(element)openDiagramContextMenu(event,'edge',element.dataset.edge);});
$('#diagramContextMenu').addEventListener('pointerdown',event=>event.stopPropagation());
$('#diagramContextMenu').addEventListener('click',event=>{
  event.preventDefault();event.stopPropagation();
  const action=event.target.closest('[data-context-action]')?.dataset.contextAction,target=contextTarget;
  if(!action||!target)return;
  $('#diagramContextMenu').classList.add('hidden');
  if(action==='edit'){
    if(target.kind==='edge')selectConnection(target.id);
    else{selectedId=target.id;selectedEdge=null;selectedIds=new Set([target.id]);if(nodeAt(target.id)?.kind==='table')selectTable(target.id);else{renderNodes();renderInspector();}}
    $('.inspector').classList.add('is-open');$('#inspectorTitle')?.focus();
  }else if(action==='duplicate'){
    if(target.kind==='node'){selectedIds=new Set(target.multiple?[...selectedIds]:[target.id]);selectedId=target.id;captureSelection();pasteCopiedElements();}
  }else if(action==='connect'){
    if(target.kind==='node'){connectFrom=target.id;setTool('connect');toast('Selecione o elemento de destino da conexão.');}
  }else if(action==='copy'){
    if(target.kind==='node')captureSelection();
  }else if(action==='paste'){
    if(copiedElements)pasteCopiedElements();
  }else if(action==='front'||action==='back'){
    if(target.kind==='node'&&current().type==='fluxo'){const node=nodeAt(target.id);if(node){snapshot();current().nodes=current().nodes.filter(item=>item.id!==node.id);if(action==='front')current().nodes.push(node);else current().nodes.unshift(node);renderNodes();renderEdges();save();}}
  }else if(action==='changeType'){
    const node=target.kind==='node'&&nodeAt(target.id);if(node&&current().type==='fluxo'){const options=palettes.fluxo.filter(([kind])=>kind!=='note').map(([kind,label])=>`<option value="${kind}" ${kind===node.kind?'selected':''}>${escapeHtml(label)}</option>`).join('');showModal('Alterar símbolo',`<p class="modal-copy">As conexões e o nome serão preservados. Propriedades exclusivas do tipo atual podem ser removidas.</p><label class="field-label">Novo tipo<select id="flowKindChange" class="inspector-select">${options}</select></label>`,'Alterar tipo',()=>{const next=$('#flowKindChange').value,exclusive=({decision:'condition,branchType',connector:'connectorId',pageConnector:'connectorId',subprocess:'subprocessRef'})[node.kind],compatible=(node.kind==='decision'&&next==='decision')||(['connector','pageConnector'].includes(node.kind)&&['connector','pageConnector'].includes(next))||(node.kind==='subprocess'&&next==='subprocess');const change=()=>{snapshot();node.kind=next;if(next==='decision'){node.branchType||='yes-no';node.condition||='';}if(['connector','pageConnector'].includes(next))node.connectorId||=node.title;if(exclusive&&!compatible)for(const key of exclusive.split(','))delete node[key];render();save();};if(exclusive&&!compatible)showModal('Remover propriedades específicas?',`<p class="modal-copy">A alteração pode remover propriedades de ${escapeHtml(labels[node.kind]||node.kind)}.</p>`,'Confirmar alteração',change);else change();});}
  }else if(action==='delete'){
    if(target.multiple)requestDeleteSelection();
    else requestDeleteSelection(target.kind==='node'?target.id:null,target.kind==='edge'?target.id:null);
  }
  contextTarget=null;
});
document.addEventListener('pointerdown',event=>{if(!event.target.closest('#diagramContextMenu'))$('#diagramContextMenu').classList.add('hidden');});
$('#manageConnections').addEventListener('click', openConnections);
$('#logicalValidate').addEventListener('click', validateCurrentLogicalModel);
$('#flowValidate').addEventListener('click',validateCurrentFlow);
$('#flowSimStart').addEventListener('click',startFlowSimulation);
$('#flowSimNext').addEventListener('click',()=>advanceFlowSimulation());
$('#flowSimPause').addEventListener('click',pauseFlowSimulation);
$('#flowSimReset').addEventListener('click',resetFlowSimulation);
$('#logicalSql').addEventListener('click', openLogicalSql);
$('#logicalDictionary').addEventListener('click',()=>{if(current().type!=='logico')return toast('Selecione um diagrama lógico');download(`${slug(current().title)}-dicionario.csv`,'text/csv;charset=utf-8',dataDictionaryCsv(current()));toast('Dicionário de dados exportado');});
$('#logicalNormalize').addEventListener('click',showNormalization);
$('#logicalImportDdl').addEventListener('click',openDdlImport);
$('#conceptualValidate').addEventListener('click',()=>{const issues=validateConceptualDiagram(current());logicalReport('Validação do modelo conceitual',issues);});
$('#conceptualNotation').addEventListener('click',()=>{const d=current(),next=d.conceptual?.notation==='crows-foot'?'chen':'crows-foot';if(next==='crows-foot'){const advanced=d.nodes.some(node=>node.kind==='specialization'||node.conceptual?.entityKind==='weak'||node.fields?.some(field=>field.kind==='composite'||field.kind==='derived'||field.kind==='multivalued'));if(advanced)return showModal("Notação Crow's Foot indisponível",'<p class="modal-copy">Este diagrama contém elementos EER sem representação equivalente completa em Crow’s Foot. O modelo semântico permanece preservado; remova ou modele esses conceitos em outro diagrama antes de alternar.</p>','Fechar',()=>{});}snapshot();d.conceptual.notation=next;render();save();});
$('#conceptualConvert').addEventListener('click',()=>showModal('Converter para modelo lógico?',`<p class="modal-copy">Será criado um novo diagrama lógico; o conceitual será preservado. A conversão mapeia entidades, identificadores, atributos simples e multivalorados e relacionamentos binários/n-ários. Atributos compostos são decompostos; derivados são omitidos. Domínios conceituais não são inferidos como tipos SQL. Revise papéis, chaves e cardinalidades antes de usar o modelo.</p>`,'Criar modelo lógico',()=>{const errors=validateConceptualDiagram(current()).filter(issue=>issue.severity==='error');if(errors.length){logicalReport('Corrija o modelo conceitual antes da conversão',errors);return;}const converted=convertConceptualToLogical(current());converted.id=uid('d');converted.title=`${current().title} · Modelo lógico`;state.diagrams.push(converted);normalizeProjectTables(state);state.active=converted.id;rememberActiveTab('studio',state.id,state.active);activeActivity=null;selectedId=null;selectedIds.clear();selectedEdge=null;connectFrom=null;render();save();toast('Novo diagrama lógico criado para revisão');}));
$('#useCaseValidate').addEventListener('click',()=>{const issues=validateUseCaseDiagram(current());logicalReport('Validação do diagrama de casos de uso',issues);});
$('#istarValidate').addEventListener('click',()=>{const issues=validateIStarDiagram(current());logicalReport('Validação do modelo iStar 2.0',issues);});
$('#istarRelationType').addEventListener('change',event=>{if(current().type!=='istar')return;current().istar.selectedRelationship=event.target.value;renderIStarRelationshipPicker();save();});
$('#istarView').addEventListener('change',event=>{snapshot();current().istar.view=event.target.value;for(const actor of current().nodes.filter(isIStarActor)){actor.istar.collapsed=event.target.value==='SD';}selectedId=null;selectedEdge=null;render();save();});
$('#useCaseLayout').addEventListener('click',()=>{const diagram=current();if(diagram.type!=='usecase')return;if(!diagram.nodes.some(node=>['actor','useCase'].includes(node.kind)))return toast('Adicione atores ou casos de uso para organizar.');snapshot();layoutUseCaseDiagram(diagram);render();save();$('#fitButton').click();toast('Diagrama organizado pelas relações e limites do sistema');});
$('#conceptualDictionary').addEventListener('click',()=>{download(`${slug(current().title)}-dicionario-conceitual.csv`,'text/csv;charset=utf-8',conceptualDictionaryCsv(current()));toast('Dicionário conceitual exportado');});
$('#ddlInput').addEventListener('change',event=>{importDdlFile(event.target.files[0]);event.target.value='';});
$('#themeToggle').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
$('#zoomIn').addEventListener('click', () => { zoom = Math.min(2, +(zoom + .1).toFixed(2)); renderTransform(); });
$('#zoomOut').addEventListener('click', () => { zoom = Math.max(.15, +(zoom - .1).toFixed(2)); renderTransform(); });
$('#fitButton').addEventListener('click', () => {
  const origin=surface.getBoundingClientRect();
  const bounds=[...$('#nodes').querySelectorAll('.node,.istar-boundary-title,.istar-actor-toggle')].map(el=>{
    const rect=el.getBoundingClientRect();return{x:(rect.left-origin.left)/zoom,y:(rect.top-origin.top)/zoom,w:rect.width/zoom,h:rect.height/zoom};
  });
  for(const edge of $('#connections').querySelectorAll('[data-edge]')){
    try{const b=edge.getBBox();if(b.width||b.height)bounds.push({x:b.x,y:b.y,w:b.width,h:b.height});}catch{}
  }
  if(!bounds.length){zoom=1;pan={x:55,y:50};}
  else{
    const left=Math.min(...bounds.map(b=>b.x)),top=Math.min(...bounds.map(b=>b.y));
    const width=Math.max(1,Math.max(...bounds.map(b=>b.x+b.w))-left),height=Math.max(1,Math.max(...bounds.map(b=>b.y+b.h))-top);
    zoom=Math.max(.15,Math.min(1.25,Math.max(64,viewport.clientWidth-96)/width,Math.max(64,viewport.clientHeight-96)/height));
    pan={x:(viewport.clientWidth-width*zoom)/2-left*zoom,y:(viewport.clientHeight-height*zoom)/2-top*zoom};
  }
  renderTransform();
});
$('#undoButton').addEventListener('click', undo); $('#redoButton').addEventListener('click', redo);
$('#quickAdd').addEventListener('click', () => addFromPalette(current().type==='usecase'?'actor':current().type==='istar'?'istarBoundary':'entity'));
$('#exportButton').addEventListener('click', showExport); $('#importButton').addEventListener('click', openJsonImportDialog);
$('#projectTitle').addEventListener('blur', e => { const title = e.target.textContent.trim().slice(0, 80) || 'Sem título'; if (title !== state.title) { snapshot(); state.title = title; save(); render(); } });
$('#projectTitle').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
$('#collapsePalette').addEventListener('click', () => { $('.palette').classList.toggle('collapsed'); $('.editor-grid').classList.toggle('palette-collapsed'); });
$('#showPalette').addEventListener('click',()=>$('.palette').classList.toggle('mobile-open'));
document.addEventListener('pointerdown',event=>{if(matchMedia('(max-width: 720px)').matches&&$('.palette').classList.contains('mobile-open')&&!event.target.closest('.palette,#showPalette'))$('.palette').classList.remove('mobile-open');});
$('.palette-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-palette-view]');if(!button)return;paletteView=button.dataset.paletteView;renderPalette();});
$('#paletteSearch').addEventListener('input',event=>{paletteQuery=event.target.value;renderPalette();});
function updateInspectorControls(){const mobile=matchMedia('(max-width: 720px)').matches,inspector=$('.inspector'),open=mobile?inspector.classList.contains('is-open'):!$('.editor-grid').classList.contains('inspector-collapsed'),toggle=$('#toggleInspectorEdge');inspector.hidden=!open;inspector.inert=!open;toggle.textContent=open?'›':'‹';toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',`${open?'Fechar':'Abrir'} propriedades`);toggle.title=`${open?'Fechar':'Abrir'} propriedades`;}
function toggleInspector(){const inspector=$('.inspector'),grid=$('.editor-grid');if(matchMedia('(max-width: 720px)').matches)inspector.classList.toggle('is-open');else grid.classList.toggle('inspector-collapsed');updateInspectorControls();}
$('#toggleInspectorEdge').addEventListener('click',toggleInspector);
window.matchMedia('(max-width: 720px)').addEventListener?.('change',updateInspectorControls);updateInspectorControls();
(()=>{
  const grid=$('.editor-grid'),storageKey='brmodelo-panel-widths-v1';
  const saveWidths=()=>{try{localStorage.setItem(storageKey,JSON.stringify({palette:Math.round($('.palette').getBoundingClientRect().width),inspector:Math.round($('.inspector').getBoundingClientRect().width)}));}catch{}};
  try{const saved=JSON.parse(localStorage.getItem(storageKey)||'{}'),available=grid.getBoundingClientRect().width||window.innerWidth;if(Number.isFinite(saved.palette)||Number.isFinite(saved.inspector)){const defaultPalette=Number.isFinite(saved.palette)?saved.palette:238,defaultInspector=Number.isFinite(saved.inspector)?saved.inspector:(current().type==='logico'?390:278),inspector=Math.max(250,Math.min(460,defaultInspector,available-500-defaultPalette)),palette=Math.min(340,Math.max(180,Math.min(defaultPalette,available-inspector-500)));if(Number.isFinite(saved.palette))grid.style.setProperty('--palette-panel-width',`${palette}px`);if(Number.isFinite(saved.inspector))grid.style.setProperty('--inspector-panel-width',`${inspector}px`);}}catch{}
  let resizing=null;
  grid.addEventListener('pointerdown',event=>{
    if(matchMedia('(max-width: 720px)').matches||event.button!==0)return;
    const palette=$('.palette'),inspector=$('.inspector'),edge=6;
    if(!palette.classList.contains('collapsed')&&Math.abs(event.clientX-palette.getBoundingClientRect().right)<=edge)resizing='palette';
    else if(!grid.classList.contains('inspector-collapsed')&&Math.abs(event.clientX-inspector.getBoundingClientRect().left)<=edge)resizing='inspector';
    if(resizing){event.preventDefault();document.body.classList.add('panel-resizing');grid.setPointerCapture(event.pointerId);}
  });
  grid.addEventListener('pointermove',event=>{
    if(!resizing)return;
    const bounds=grid.getBoundingClientRect(),usable=bounds.width;
    if(resizing==='palette'){
      const max=Math.min(340,usable-500-$('.inspector').getBoundingClientRect().width);
      grid.style.setProperty('--palette-panel-width',`${Math.round(Math.max(180,Math.min(max,event.clientX-bounds.left)))}px`);
    }else{
      const max=Math.min(460,usable-500-$('.palette').getBoundingClientRect().width),width=bounds.right-event.clientX;
      grid.style.setProperty('--inspector-panel-width',`${Math.round(Math.max(250,Math.min(max,width)))}px`);
    }
  });
  grid.addEventListener('dblclick',event=>{
    const palette=$('.palette'),inspector=$('.inspector'),nearPalette=Math.abs(event.clientX-palette.getBoundingClientRect().right)<=7,nearInspector=Math.abs(event.clientX-inspector.getBoundingClientRect().left)<=7;
    if(nearPalette){grid.style.removeProperty('--palette-panel-width');}
    else if(nearInspector){grid.style.removeProperty('--inspector-panel-width');}
    else return;
    saveWidths();
  });
  const stop=()=>{if(!resizing)return;resizing=null;document.body.classList.remove('panel-resizing');saveWidths();};
  grid.addEventListener('pointerup',stop);grid.addEventListener('pointercancel',stop);
})();
function readWorkspaceProjects() { try { const projects=JSON.parse(localStorage.getItem(PROJECTS_KEY)||'{}'); const current=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); if(current?.id&&!projects[current.id])projects[current.id]=current; if(!Object.keys(projects).length&&current){current.id ||= uid('project');projects[current.id]=current;} return projects; } catch { return {}; } }
function projectTimestamp(value) { const date=new Date(value); return Number.isNaN(date.valueOf())?'':new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'}).format(date); }
function renderProjectDashboard() {
  const projects=Object.values(readWorkspaceProjects()).filter(p=>p?.id&&Array.isArray(p.diagrams)).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  $('#workspaceProjectCount').textContent=String(projects.length).padStart(2,'0');
  $('#workspaceProjects').innerHTML=projects.length?projects.map(p=>`<article class="project-card"><div class="project-icon">▦</div><div class="project-main"><strong>${escapeHtml(p.title||'Sem título')}</strong><p>${p.diagrams.length} ${p.diagrams.length===1?'diagrama':'diagramas'} · Atualizado ${escapeHtml(projectTimestamp(p.updatedAt||p.createdAt))}</p></div><div class="project-actions"><button class="button outline" data-open-workspace="${escapeHtml(p.id)}">Abrir →</button><button class="project-icon-button" data-rename-workspace="${escapeHtml(p.id)}" aria-label="Renomear ${escapeHtml(p.title||'projeto')}" title="Renomear">✎</button><button class="project-icon-button danger" data-delete-workspace="${escapeHtml(p.id)}" aria-label="Excluir ${escapeHtml(p.title||'projeto')}" title="Excluir">×</button></div></article>`).join(''):'<div class="project-empty"><span>▦</span><strong>Nenhum projeto de dados salvo</strong><p>Crie um projeto para começar a modelar.</p></div>';
  const uml=[...loadActivityProjects().flatMap(p=>p.diagrams.map(d=>({kind:'activity',project:p,diagram:d}))),...loadClassProjects().flatMap(p=>p.diagrams.map(d=>({kind:'class',project:p,diagram:d}))),...loadSequenceProjects().flatMap(p=>p.diagrams.map(d=>({kind:'sequence',project:p,diagram:d}))),...projects.flatMap(project=>project.diagrams.filter(diagram=>diagram.type==='usecase').map(diagram=>({kind:'usecase',project,diagram:{id:diagram.id,name:diagram.title}})))];
  $('#umlProjects').innerHTML=uml.length?uml.map(item=>`<article class="project-card uml-project-card"><div class="project-icon ${item.kind}">${item.kind==='activity'?'◉':item.kind==='usecase'?'◎':item.kind==='sequence'?'↔':'▦'}</div><div class="project-main"><strong>${escapeHtml(item.diagram.name)}</strong><p>${item.kind==='activity'?'Atividades UML':item.kind==='usecase'?'Casos de Uso UML':item.kind==='sequence'?'Sequência UML':'Classes UML'} · ${escapeHtml(item.project.title||'Projeto UML')}</p></div><div class="project-actions"><button class="button outline" data-open-uml="${item.kind}" data-project="${escapeHtml(item.project.id)}" data-diagram="${escapeHtml(item.diagram.id)}">Abrir →</button></div></article>`).join(''):'<div class="project-empty compact"><strong>Nenhum diagrama UML salvo</strong><p>Crie diagramas UML pelo botão + nas abas do editor.</p></div>';
  $('#workspaceProjects').querySelectorAll('[data-open-workspace]').forEach(b=>b.onclick=()=>openWorkspaceProject(b.dataset.openWorkspace));
  $('#workspaceProjects').querySelectorAll('[data-rename-workspace]').forEach(b=>b.onclick=()=>renameWorkspaceProject(b.dataset.renameWorkspace));
  $('#workspaceProjects').querySelectorAll('[data-delete-workspace]').forEach(b=>b.onclick=()=>deleteWorkspaceProject(b.dataset.deleteWorkspace));
  $('#umlProjects').querySelectorAll('[data-open-uml]').forEach(b=>b.onclick=()=>{if(b.dataset.openUml==='activity')openActivityDiagram(b.dataset.project,b.dataset.diagram);else if(b.dataset.openUml==='class')openClassDiagram(b.dataset.project,b.dataset.diagram);else if(b.dataset.openUml==='sequence')openSequenceDiagram(b.dataset.project,b.dataset.diagram);else{openWorkspaceProject(b.dataset.project);return;}switchView('editor')});
  renderSavedNativeDocuments();
}
async function renderSavedNativeDocuments(){const box=$('#savedDocuments');try{const docs=await listStoredDocuments();box.innerHTML=docs.length?docs.map(doc=>{const name=doc.kind==='studio-diagram'?doc.name:doc.content?.project?.diagrams?.find(d=>d.id===doc.content?.diagramId)?.name||doc.name;const title=doc.kind==='studio-diagram'?doc.content.project?.title:doc.content.project?.title||'Projeto UML';return `<article class="project-card"><div class="project-icon">${diagramTabIcon(doc.content.diagram?.type|| (doc.kind==='uml-activity'?'atividade':doc.kind==='uml-sequence'?'sequencia':'classes'))}</div><div class="project-main"><strong>${escapeHtml(name)}</strong><p>${escapeHtml(title||'Projeto')} · Salvo ${escapeHtml(projectTimestamp(doc.updatedAt))}</p></div><div class="project-actions"><button class="button outline" data-open-saved-document="${escapeHtml(doc.id)}">Abrir →</button></div></article>`}).join(''):'<div class="project-empty compact"><strong>Nenhum documento salvo ainda</strong><p>Use Arquivo → Salvar para gravar um diagrama.</p></div>';box.querySelectorAll('[data-open-saved-document]').forEach(button=>button.onclick=()=>openSavedDocument(button.dataset.openSavedDocument));}catch(error){box.innerHTML=`<div class="project-empty compact"><strong>Não foi possível ler documentos salvos</strong><p>${escapeHtml(error.message)}</p></div>`}}
async function openSavedDocument(id){try{const doc=await getStoredDocument(id);if(!doc)throw new Error('Documento não encontrado.');if(doc.kind==='studio-diagram')return openSavedNativeDocument(id);if(!['uml-activity','uml-class','uml-sequence'].includes(doc.kind))throw new Error('Tipo de documento desconhecido.');const project=doc.content.project,diagramId=doc.content.diagramId;const prefix=doc.kind==='uml-activity'?'brmodelo.uml-activity':doc.kind==='uml-class'?'brmodelo.uml-class':'brmodelo.uml-sequence',key=`${prefix}.projects.v1`,currentKey=`${prefix}.project.v1`;const projects=JSON.parse(localStorage.getItem(key)||'{}');projects[project.id]=project;localStorage.setItem(key,JSON.stringify(projects));localStorage.setItem(currentKey,JSON.stringify(project));savedDocumentSnapshots.set(id,doc);if(doc.kind==='uml-activity')openActivityDiagram(project.id,diagramId);else if(doc.kind==='uml-class')openClassDiagram(project.id,diagramId);else openSequenceDiagram(project.id,diagramId);switchView('editor');}catch(error){toast(`Não foi possível abrir o documento: ${error.message}`)}}
async function openDocumentDialog(){try{const docs=await listStoredDocuments();const rows=docs.map(doc=>{const name=doc.kind==='studio-diagram'?doc.name:doc.content?.project?.diagrams?.find(d=>d.id===doc.content?.diagramId)?.name||doc.name;return `<button type="button" class="saved-document-choice" data-open-document="${escapeHtml(doc.id)}"><span>${diagramTabIcon(doc.content.diagram?.type||(doc.kind==='uml-activity'?'atividade':doc.kind==='uml-sequence'?'sequencia':'classes'))}</span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(doc.kind==='studio-diagram'?'Modelo de dados':doc.kind==='uml-activity'?'Atividades UML':doc.kind==='uml-sequence'?'Sequência UML':'Classes UML')}</small></button>`}).join('');showModal('Abrir documento',rows?`<div class="saved-document-list">${rows}</div>`:'<p class="modal-copy">Ainda não há documentos salvos. Use Arquivo → Salvar para gravar o documento atual.</p>','Fechar',()=>{});modal.querySelectorAll('[data-open-document]').forEach(button=>button.onclick=()=>{const id=button.dataset.openDocument;modal.close('cancel');openSavedDocument(id)})}catch(error){toast(`Não foi possível listar documentos: ${error.message}`)}}
async function openSavedNativeDocument(id){try{const doc=await getStoredDocument(id);if(!doc)throw new Error('Documento não encontrado.');savedDocumentSnapshots.set(id,doc);if(state.id!==doc.projectId){const projects=readWorkspaceProjects();state=projects[doc.projectId]?normalizeProjectTables(JSON.parse(JSON.stringify(projects[doc.projectId]))):{...doc.content.project,diagrams:[doc.content.diagram]};state.id=doc.projectId;state.openDiagramIds||=[];}const exists=state.diagrams.some(item=>item.id===doc.content.diagram.id);if(exists)state.diagrams=state.diagrams.map(item=>item.id===doc.content.diagram.id?JSON.parse(JSON.stringify(doc.content.diagram)):item);else state.diagrams.push(JSON.parse(JSON.stringify(doc.content.diagram)));if(!state.openDiagramIds.includes(doc.content.diagram.id))state.openDiagramIds.push(doc.content.diagram.id);state.active=doc.content.diagram.id;rememberActiveTab('studio',state.id,state.active);activeActivity=null;activeClassDiagram=null;activeSequenceDiagram=null;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));history=[];future=[];selectedId=null;selectedEdge=null;selectedIds.clear();refreshDocumentStatuses();render();switchView('editor');}catch(error){toast(`Não foi possível abrir o documento: ${error.message}`)}}
async function openWorkspaceProject(id) { if(!readWorkspaceProjects()[id])return;if(await closeAllDocuments()===false)return;const project=readWorkspaceProjects()[id];if(!project){toast('Este projeto não está mais disponível. Atualize a lista de projetos.');renderProjectDashboard();return;}if(!Array.isArray(project.diagrams)||!project.diagrams.length){toast('Este projeto não contém diagramas válidos.');return;}state=normalizeProjectTables(JSON.parse(JSON.stringify(project)));state.openDiagramIds=Array.isArray(state.openDiagramIds)?state.openDiagramIds.filter(diagramId=>state.diagrams.some(diagram=>diagram.id===diagramId)):[];if(!state.openDiagramIds.length)state.openDiagramIds=state.diagrams.map(diagram=>diagram.id);if(!state.diagrams.some(diagram=>diagram.id===state.active))state.active=state.openDiagramIds[0];rememberActiveTab('studio',state.id,state.active);activeActivity=null;activeClassDiagram=null;activeSequenceDiagram=null;history=[];future=[];selectedId=null;selectedEdge=null;selectedIds.clear();connectFrom=null;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));refreshDocumentStatuses();render();switchView('editor'); }
function createWorkspaceProject(name) { const project={id:uid('project'),createdAt:new Date().toISOString(),title:name,active:'conceitual',openDiagramIds:['conceitual'],diagrams:[{id:'conceitual',type:'conceitual',title:'Modelo conceitual',nodes:[],edges:[],conceptual:{version:1,notation:'chen',specializations:[],constraints:[]}}]};state=normalizeProjectTables(project);rememberActiveTab('studio',state.id,state.active);history=[];future=[];selectedId=null;selectedEdge=null;selectedIds.clear();save();render();switchView('editor'); }
function renameWorkspaceProject(id) { const item=readWorkspaceProjects()[id];if(!item)return;showModal('Renomear projeto',`<label class="field-label" for="workspaceProjectName">Nome do projeto</label><input class="inspector-input modal-input" id="workspaceProjectName" maxlength="80" value="${escapeHtml(item.title||'')}">`,'Salvar',()=>{const name=$('#workspaceProjectName').value.trim();if(!name)return;if(state.id===id){snapshot();state.title=name;save();render()}else{const projects=readWorkspaceProjects();projects[id].title=name;projects[id].updatedAt=new Date().toISOString();localStorage.setItem(PROJECTS_KEY,JSON.stringify(projects))}renderProjectDashboard()}); }
function deleteWorkspaceProject(id) { const projects=readWorkspaceProjects(),item=projects[id];if(!item)return;if(Object.keys(projects).length<2)return toast('Mantenha ao menos um projeto de dados.');showModal('Excluir projeto?',`<p class="modal-copy">O projeto <strong>${escapeHtml(item.title||'Sem título')}</strong> e seus diagramas serão removidos deste navegador.</p>`,'Excluir',()=>{const remaining=readWorkspaceProjects();delete remaining[id];localStorage.setItem(PROJECTS_KEY,JSON.stringify(remaining));if(state.id===id){const next=Object.values(remaining)[0];state=normalizeProjectTables(JSON.parse(JSON.stringify(next)));localStorage.setItem(STORAGE_KEY,JSON.stringify(state));history=[];future=[];selectedId=null;selectedEdge=null;selectedIds.clear();render()}renderProjectDashboard()}); }
function switchView(view) { const projects = view === 'projects'; $('#editorView').classList.toggle('hidden', projects); $('#projectsView').classList.toggle('hidden', !projects); $('#workspaceHeading').classList.toggle('hidden', projects); $('.main').classList.toggle('projects-active', projects); document.body.classList.toggle('projects-active',projects); $('#projectsNav').classList.toggle('active', projects); if(projects)renderProjectDashboard(); }
document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', () => switchView(el.dataset.view)));
for(const id of ['activityEditorFrame','classEditorFrame','sequenceEditorFrame']) $(`#${id}`).addEventListener('load',()=>{try{$(`#${id}`).contentWindow.postMessage({type:'brmodelo-theme',theme:document.documentElement.dataset.theme||'light'},location.origin);}catch{}});
window.addEventListener('message',event=>{if(event.origin!==location.origin)return;const activityFrame=$('#activityEditorFrame'),classFrame=$('#classEditorFrame'),sequenceFrame=$('#sequenceEditorFrame'),data=event.data||{},kind=event.source===activityFrame.contentWindow?'uml-activity':event.source===classFrame.contentWindow?'uml-class':event.source===sequenceFrame.contentWindow?'uml-sequence':null;if(!kind)return;if(data.type==='brmodelo-close-active-document'){const doc=activeDocument();if(doc)requestCloseDocument(doc.kind,doc.projectId,doc.diagramId);return}if(data.type==='uml-class-open-error'){toast(`Não foi possível abrir o diagrama de classes: ${data.error||'erro de leitura do documento.'}`);documentStatuses.set(moduleDocumentId('uml-class',data.projectId,data.diagramId),'error');renderTabs();updateSaveStatus();return}if(['uml-activity-ready','uml-activity-active'].includes(data.type)){activeClassDiagram=null;activeSequenceDiagram=null;activeActivity={projectId:data.projectId,diagramId:data.diagramId};rememberActiveTab('uml-activity',data.projectId,data.diagramId);localStorage.setItem('brmodelo.uml-activity.lastSelection',JSON.stringify(activeActivity));renderTabs();updateSaveStatus();return}if(['uml-class-ready','uml-class-active'].includes(data.type)){activeActivity=null;activeSequenceDiagram=null;activeClassDiagram={projectId:data.projectId,diagramId:data.diagramId};rememberActiveTab('uml-class',data.projectId,data.diagramId);renderTabs();updateSaveStatus();return}if(['uml-sequence-ready','uml-sequence-active'].includes(data.type)){activeActivity=null;activeClassDiagram=null;activeSequenceDiagram={projectId:data.projectId,diagramId:data.diagramId};rememberActiveTab('uml-sequence',data.projectId,data.diagramId);renderTabs();updateSaveStatus();return}if(data.type==='brmodelo-document-state'){const id=moduleDocumentId(kind,data.projectId,data.diagramId);documentStatuses.set(id,data.status);renderTabs();updateSaveStatus();return}if(data.type==='brmodelo-document-command'){if(data.command==='save'){documentStatuses.set(moduleDocumentId(kind,data.projectId,data.diagramId),'saving');renderTabs();updateSaveStatus()}event.source.postMessage(data,location.origin);return}if(data.type==='brmodelo-document-command-result'){const pending=pendingDocumentCommands.get(data.requestId);if(pending){clearTimeout(pending.timeout);pendingDocumentCommands.delete(data.requestId);if(data.success&&data.status==='saved'){const id=moduleDocumentId(kind,data.projectId,data.diagramId);documentStatuses.set(id,'saved');renderTabs();updateSaveStatus()}pending.resolve(data);}}});
$('#newProject').addEventListener('click', () => showModal('Novo projeto', '<label class="field-label" for="newWorkspaceProjectName">Nome do projeto</label><input class="inspector-input modal-input" id="newWorkspaceProjectName" maxlength="80" value="Novo projeto">', 'Criar projeto', () => { const name=$('#newWorkspaceProjectName').value.trim();if(name)createWorkspaceProject(name); }));
$('#helpButton').addEventListener('click', () => showModal('Atalhos e dicas', '<div class="modal-copy"><p><strong>Adicionar:</strong> clique ou arraste um elemento da biblioteca. Use Elementos para adicionar e Estrutura para localizar objetos existentes.</p><p><strong>Conectar:</strong> selecione Conectar, depois clique na origem e no destino.</p><p><strong>Editar:</strong> selecione um elemento e use o painel de propriedades; clique duplo foca o nome. Arraste o canto inferior direito de uma tabela para ajustar sua largura.</p><p><strong>Selecionar e editar:</strong> V selecionar · C conectar · H mover canvas · Ctrl/Cmd+A selecionar tudo · Ctrl/Cmd+F buscar · setas movem seleção (Shift+seta: 10 px).</p><p><strong>Organizar:</strong> Ctrl/Cmd+C copiar · Ctrl/Cmd+V colar · Ctrl/Cmd+D duplicar · Delete excluir · Shift+1 ajustar à tela.</p><p><strong>Histórico e arquivos:</strong> Ctrl/Cmd+Z desfazer · Ctrl/Cmd+Shift+Z refazer · Ctrl/Cmd+S salvar · Ctrl/Cmd+W fechar aba.</p><p><strong>Zoom e navegação:</strong> use os controles ou Ctrl/Cmd + rolagem; Espaço + arraste move o canvas.</p></div>', 'Entendi', () => {}));
document.querySelectorAll('[data-file-action]').forEach(button=>button.addEventListener('click',()=>executeFileAction(button.dataset.fileAction)));
$('#fileInput').addEventListener('change',event=>{const file=event.target.files[0];event.target.value='';if(!file)return;if(modal.open)modal.close('cancel');openImportedDocument(file)});
function captureSelection(){
  const ids=selectedIds.size?[...selectedIds]:selectedId?[selectedId]:[];if(!ids.length)return false;const selected=new Set(ids);
  copiedElements={type:current().type,nodes:current().nodes.filter(node=>selected.has(node.id)).map(node=>JSON.parse(JSON.stringify(node))),edges:current().edges.filter(edge=>selected.has(edge.from)&&selected.has(edge.to)).map(edge=>JSON.parse(JSON.stringify(edge)))};pasteCount=0;return true;
}
function pasteCopiedElements(){if(!copiedElements)return toast('Copie elementos antes de colar.');if(copiedElements.type!==current().type)return toast('Cole os elementos em um diagrama do mesmo tipo.');snapshot();const clones=JSON.parse(JSON.stringify(copiedElements)),offset=28*(++pasteCount),nodeMap=new Map(clones.nodes.map(node=>[node.id,uid('n')])),fieldMap=new Map();for(const node of clones.nodes)for(const field of node.fields||[])if(field&&typeof field==='object'&&field.id)fieldMap.set(`${node.id}:${field.id}`,uid('c'));for(const node of clones.nodes){const oldId=node.id;node.id=nodeMap.get(oldId);node.x+=offset;node.y+=offset;const mapColumns=values=>(values||[]).map(value=>fieldMap.get(`${oldId}:${value}`)||value);for(const field of node.fields||[])if(field&&typeof field==='object'){if(field.id)field.id=fieldMap.get(`${oldId}:${field.id}`);if(field.references){const oldTable=field.references.tableId,oldColumn=field.references.columnId;field.references.tableId=nodeMap.get(oldTable)||oldTable;field.references.columnId=fieldMap.get(`${oldTable}:${oldColumn}`)||oldColumn;}}node.primaryKey=mapColumns(node.primaryKey);node.constraints=(node.constraints||[]).map(item=>({...item,columns:mapColumns(item.columns)}));node.indexes=(node.indexes||[]).map(item=>({...item,columns:mapColumns(item.columns)}));node.functionalDependencies=(node.functionalDependencies||[]).map(item=>({...item,determinant:mapColumns(item.determinant),dependent:mapColumns(item.dependent)}));}const edges=clones.edges.map(edge=>({...edge,id:uid('e'),from:nodeMap.get(edge.from),to:nodeMap.get(edge.to)}));current().nodes.push(...clones.nodes);current().edges.push(...edges);selectedIds=new Set(clones.nodes.map(node=>node.id));selectedId=clones.nodes.at(-1)?.id||null;selectedEdge=null;render();save();}
function duplicateSelection(){if(!captureSelection())return toast('Selecione elementos para duplicar.');pasteCopiedElements();}
document.addEventListener('keydown', e => {
  const editing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)||document.activeElement.isContentEditable;
  if(e.code==='Space'&&!editing&&!modal.open&&(document.activeElement===document.body||document.activeElement===viewport)){spacePanActive=true;viewport.classList.add('space-pan-active');e.preventDefault();return;}
  if(e.metaKey||e.ctrlKey){const key=e.key.toLowerCase();if(key==='s'&&!editing){e.preventDefault();e.stopPropagation();if(e.shiftKey)saveAsActiveDocument().catch(error=>toast(error.message));else saveActiveDocument().then(saved=>{if(saved!==false)toast('Documento salvo.')}).catch(error=>toast(`Erro ao salvar: ${error.message}`));return}if(key==='w'&&!editing){e.preventDefault();e.stopPropagation();const doc=activeDocument();if(doc)requestCloseDocument(doc.kind,doc.projectId,doc.diagramId);return}if(key==='z'&&!editing&&!modal.open){e.preventDefault();e.shiftKey?redo():undo();return}if(!editing&&!modal.open&&key==='a'){e.preventDefault();selectedIds=new Set(current().nodes.map(node=>node.id));selectedId=[...selectedIds].at(-1)||null;selectedEdge=null;renderNodes();renderEdges();renderInspector();return}if(!editing&&!modal.open&&key==='f'){e.preventDefault();$('#paletteSearch').focus();return}if(!editing&&!modal.open&&key==='c'&&(selectedIds.size||selectedId)){e.preventDefault();captureSelection();return}if(!editing&&!modal.open&&key==='v'&&copiedElements){e.preventDefault();pasteCopiedElements();return}if(!editing&&!modal.open&&key==='d'){e.preventDefault();duplicateSelection();return}}
  if(editing||modal.open)return;
  if(e.key==='Delete'||e.key==='Backspace'){if(selectedIds.size>1)showModal('Excluir seleção?',`<p class="modal-copy">Tem certeza de que deseja excluir estes ${selectedIds.size} elementos e suas conexões? Você poderá desfazer essa ação.</p>`,'Excluir',deleteSelection);else if(selectedId||selectedEdge)requestDeleteSelection()}else if(e.shiftKey&&e.key==='1'){e.preventDefault();$('#fitButton').click()}else if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)&&(selectedIds.size||selectedId)){e.preventDefault();const step=e.shiftKey?10:1,dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0,ids=new Set(selectedIds.size?selectedIds:[selectedId]);if(current().type==='istar')for(const id of [...ids])if(isIStarActor(nodeAt(id)))for(const child of current().nodes)if(child.istar?.ownerId===id)ids.add(child.id);if(!e.repeat)snapshot();for(const id of ids){const node=nodeAt(id);if(node){node.x=Math.max(0,node.x+dx);node.y=Math.max(0,node.y+dy);if(current().type==='istar'&&node.istar?.ownerId)clampIStarElement(current(),node);}}renderNodes();renderEdges();if(!e.repeat)save();return}else if(e.key.toLowerCase()==='v')setTool('select');else if(e.key.toLowerCase()==='c')setTool('connect');else if(e.key.toLowerCase()==='h')setTool('pan');else if(e.key==='Escape'){connectFrom=null;selectedId=null;selectedIds.clear();selectedEdge=null;setTool('select');render()}
});
document.addEventListener('keyup',event=>{if(event.code==='Space'){spacePanActive=false;viewport.classList.remove('space-pan-active');}if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)&&!(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)||document.activeElement.isContentEditable))save();});
window.addEventListener('blur',()=>{spacePanActive=false;viewport.classList.remove('space-pan-active');});
window.addEventListener('beforeunload',event=>{if(hasUnsavedDocuments()){event.preventDefault();event.returnValue='';}});

applyTheme(localStorage.getItem(THEME_KEY) || 'dark'); render(); if(hadLegacyWorkspace)save(); initializeDocumentRepository();
window.addEventListener('pageshow', renderTabs);
