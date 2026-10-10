// Projetos locais: cada projeto guarda seu próprio conjunto de chaves "saga.*" do navegador.
// Os dados dos projetos inativos ficam no IndexedDB (muito mais espaço que o localStorage),
// deixando o localStorage livre apenas para o projeto ativo.
const LISTA_KEY = "sagaws.lista";
const DADOS_PREFIX = "sagaws.dados."; // legado (localStorage)
const DB_NAME = "saga-workspaces";
const STORE = "dados";

export interface Workspace {
  id: string;
  nome: string;
  criadoEm: string;
  salvoEm?: string;
}

interface Estado {
  ativoId: string;
  projetos: Workspace[];
}

type Snapshot = Record<string, string>;

const uid = () => Math.random().toString(36).slice(2, 10);

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await abrirDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, modo);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result as T);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

const salvarSnapshot = (id: string, d: Snapshot) => idb<void>("readwrite", (s) => s.put(d, id));
const removerSnapshot = (id: string) => idb<void>("readwrite", (s) => s.delete(id));

async function lerSnapshot(id: string): Promise<Snapshot> {
  // migra snapshots antigos guardados no localStorage
  const legado = localStorage.getItem(DADOS_PREFIX + id);
  if (legado) {
    localStorage.removeItem(DADOS_PREFIX + id);
    try {
      return JSON.parse(legado) as Snapshot;
    } catch {
      return {};
    }
  }
  return ((await idb<Snapshot | undefined>("readonly", (s) => s.get(id))) ?? {}) as Snapshot;
}

function chavesSaga(): string[] {
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("saga.")) out.push(k);
  }
  return out;
}

function capturar(): Snapshot {
  const r: Snapshot = {};
  chavesSaga().forEach((k) => {
    const v = localStorage.getItem(k);
    if (v != null) r[k] = v;
  });
  return r;
}

function aplicar(d: Snapshot) {
  chavesSaga().forEach((k) => localStorage.removeItem(k));
  Object.entries(d).forEach(([k, v]) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* limite de espaço */
    }
  });
}

/** Move snapshots legados de projetos inativos para o IndexedDB, liberando espaço. */
async function migrarLegado(e: Estado) {
  for (const p of e.projetos) {
    if (p.id === e.ativoId) continue;
    const raw = localStorage.getItem(DADOS_PREFIX + p.id);
    if (!raw) continue;
    try {
      await salvarSnapshot(p.id, JSON.parse(raw) as Snapshot);
      localStorage.removeItem(DADOS_PREFIX + p.id);
    } catch {
      /* mantém legado */
    }
  }
}

export function lerEstado(): Estado {
  let e: Estado | null = null;
  try {
    const raw = localStorage.getItem(LISTA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Estado;
      if (parsed.projetos?.length) e = parsed;
    }
  } catch {
    /* ignora */
  }
  if (!e) {
    const p: Workspace = { id: uid(), nome: "Projeto 1", criadoEm: new Date().toISOString() };
    e = { ativoId: p.id, projetos: [p] };
    localStorage.setItem(LISTA_KEY, JSON.stringify(e));
  }
  void migrarLegado(e);
  return e;
}

function gravar(e: Estado) {
  localStorage.setItem(LISTA_KEY, JSON.stringify(e));
}

function recarregar() {
  // permanece na mesma tela após trocar de projeto
  window.location.reload();
}

/** Salva explicitamente o projeto ativo (cópia de segurança no IndexedDB). */
export async function salvarAtual(): Promise<void> {
  const e = lerEstado();
  await salvarSnapshot(e.ativoId, capturar());
  gravar({
    ...e,
    projetos: e.projetos.map((p) => (p.id === e.ativoId ? { ...p, salvoEm: new Date().toISOString() } : p)),
  });
}

export async function trocarProjeto(id: string) {
  const e = lerEstado();
  if (id === e.ativoId) return;
  await salvarSnapshot(e.ativoId, capturar());
  const dados = await lerSnapshot(id);
  aplicar(dados);
  await removerSnapshot(id).catch(() => undefined);
  gravar({ ...e, ativoId: id });
  recarregar();
}

export async function criarProjeto(nome: string) {
  const e = lerEstado();
  const p: Workspace = {
    id: uid(),
    nome: nome.trim() || `Projeto ${e.projetos.length + 1}`,
    criadoEm: new Date().toISOString(),
  };
  gravar({ ...e, projetos: [...e.projetos, p] });
  await trocarProjeto(p.id);
}

export function renomearProjeto(id: string, nome: string) {
  const e = lerEstado();
  gravar({ ...e, projetos: e.projetos.map((p) => (p.id === id ? { ...p, nome } : p)) });
}

export async function excluirProjeto(id: string) {
  const e = lerEstado();
  if (e.projetos.length <= 1) return;
  const resto = e.projetos.filter((p) => p.id !== id);
  if (id === e.ativoId) {
    const alvo = resto[0];
    aplicar(await lerSnapshot(alvo.id));
    await removerSnapshot(alvo.id).catch(() => undefined);
    gravar({ ativoId: alvo.id, projetos: resto });
    recarregar();
  } else {
    localStorage.removeItem(DADOS_PREFIX + id);
    await removerSnapshot(id).catch(() => undefined);
    gravar({ ...e, projetos: resto });
  }
}
