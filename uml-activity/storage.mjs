import {parseProject, clone} from './model.mjs';
import {saveDocument, getDocument} from '../document-store.mjs';

const KEY = 'brmodelo.uml-activity.project.v1';
const PROJECTS = 'brmodelo.uml-activity.projects.v1';
const VERSIONS = 'brmodelo.uml-activity.versions.v1';
export function loadProject() {
  try {const raw=localStorage.getItem(KEY);return raw?parseProject(JSON.parse(raw)):null;} catch {return null;}
}
export function saveProject(project) {
  project.updatedAt=new Date().toISOString();
  localStorage.setItem(KEY,JSON.stringify(project));
  const projects=JSON.parse(localStorage.getItem(PROJECTS)||'{}');
  projects[project.id]=project;
  localStorage.setItem(PROJECTS,JSON.stringify(projects));
}
export async function persistProjectDocument(project, diagramId=project.activeDiagramId){const diagram=project.diagrams.find(item=>item.id===diagramId)||project.diagrams[0];if(!diagram)throw new Error('O diagrama não existe.');return saveDocument({id:`uml-activity:${project.id}:${diagram.id}`,kind:'uml-activity',version:1,projectId:project.id,name:diagram.name,updatedAt:new Date().toISOString(),content:{project:clone(project),diagramId:diagram.id}});}
export async function loadStoredProject(id, diagramId){const doc=await getDocument(`uml-activity:${id}:${diagramId}`);return doc?parseProject(doc.content.project):loadSavedProject(id);}
export function listProjects(){try{return Object.values(JSON.parse(localStorage.getItem(PROJECTS)||'{}')).map(({id,title,updatedAt})=>({id,title,updatedAt})).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}catch{return [];}}
export function loadSavedProject(id){try{const value=JSON.parse(localStorage.getItem(PROJECTS)||'{}')[id];return value?parseProject(value):null;}catch{return null;}}
export function deleteSavedProject(id){const projects=JSON.parse(localStorage.getItem(PROJECTS)||'{}');delete projects[id];localStorage.setItem(PROJECTS,JSON.stringify(projects));}
export function listVersions() {
  try {const value=JSON.parse(localStorage.getItem(VERSIONS)||'[]');return Array.isArray(value)?value:[];} catch {return [];}
}
export function saveVersion(project, label='Versão manual') {
  const versions=listVersions();
  versions.unshift({id:crypto.randomUUID(),label,createdAt:new Date().toISOString(),project:clone(project)});
  localStorage.setItem(VERSIONS,JSON.stringify(versions.slice(0,30)));
  return versions[0];
}
export function removeVersion(id) {localStorage.setItem(VERSIONS,JSON.stringify(listVersions().filter(v=>v.id!==id)));}
