const DATABASE = 'brmodelo-studio.documents';
const VERSION = 1;
const STORE = 'documents';
let databasePromise;

export function validateDocumentRecord(value) {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !value.id.trim()) {
    throw new TypeError('O documento precisa ter um identificador.');
  }
  if (typeof value.kind !== 'string' || !value.kind.trim()) {
    throw new TypeError('O documento precisa informar seu tipo.');
  }
  if (!Number.isInteger(value.version) || value.version < 1 || !value.content || typeof value.content !== 'object') {
    throw new TypeError('O conteúdo ou a versão do documento é inválido.');
  }
  return structuredClone({...value, updatedAt: value.updatedAt || new Date().toISOString()});
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('O armazenamento de documentos deste navegador não está disponível.'));
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const documents = db.createObjectStore(STORE, {keyPath: 'id'});
        documents.createIndex('kind', 'kind', {unique: false});
        documents.createIndex('projectId', 'projectId', {unique: false});
        documents.createIndex('updatedAt', 'updatedAt', {unique: false});
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error || new Error('Não foi possível abrir o armazenamento de documentos.'));
    request.onblocked = () => reject(new Error('Feche outras abas do ARQON Software Engineering Studio para atualizar o armazenamento.'));
  }).catch(error => { databasePromise = null; throw error; });
  return databasePromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falha ao acessar o documento.'));
  });
}

export async function saveDocument(value) {
  const document = validateDocumentRecord(value);
  const db = await openDatabase();
  const transaction = db.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).put(document);
  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('O documento não foi salvo.'));
  });
  return document;
}

export async function getDocument(id) {
  const db = await openDatabase();
  return requestResult(db.transaction(STORE, 'readonly').objectStore(STORE).get(id));
}

export async function listDocuments({kind, projectId} = {}) {
  const db = await openDatabase();
  const values = await requestResult(db.transaction(STORE, 'readonly').objectStore(STORE).getAll());
  return values.filter(item => (!kind || item.kind === kind) && (!projectId || item.projectId === projectId))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function deleteDocument(id) {
  const db = await openDatabase();
  const transaction = db.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).delete(id);
  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('O documento não foi removido.'));
  });
}
