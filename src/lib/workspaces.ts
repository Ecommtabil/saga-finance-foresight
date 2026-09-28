// Projetos locais: cada projeto guarda seu próprio conjunto de chaves "saga.*" do navegador.
const LISTA_KEY = "sagaws.lista";
const DADOS_PREFIX = "sagaws.dados.";

export interface Workspace {
  id: string;
  nome: string;
  criadoEm: string;
}

interface Estado {
  ativoId: string;
  projetos: Workspace[];
}

const uid = () => Math.random().toString(36).slice(2, 10);

function chavesSaga(): string[] {
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("saga.")) out.push(k);
  }
  return out;
}

function capturar(): Record<string, string> {
  const r: Record<string, string> = {};
  chavesSaga().forEach((k) => {
    const v = localStorage.getItem(k);
    if (v != null) r[k] = v;
  });
  return r;
}

function aplicar(d: Record<string, string>) {
  chavesSaga().forEach((k) => localStorage.removeItem(k));
  Object.entries(d).forEach(([k, v]) => localStorage.setItem(k, v));
}

export function lerEstado(): Estado {
  try {
    const raw = localStorage.getItem(LISTA_KEY);
    if (raw) {
      const e = JSON.parse(raw) as Estado;
      if (e.projetos?.length) return e;
    }
  } catch {
    /* ignora */
  }
  const p: Workspace = { id: uid(), nome: "Projeto 1", criadoEm: new Date().toISOString() };
  const e = { ativoId: p.id, projetos: [p] };
  localStorage.setItem(LISTA_KEY, JSON.stringify(e));
  return e;
}

function gravar(e: Estado) {
  localStorage.setItem(LISTA_KEY, JSON.stringify(e));
}

function recarregar() {
  window.location.assign("/");
}

export function trocarProjeto(id: string) {
  const e = lerEstado();
  if (id === e.ativoId) return;
  localStorage.setItem(DADOS_PREFIX + e.ativoId, JSON.stringify(capturar()));
  const raw = localStorage.getItem(DADOS_PREFIX + id);
  aplicar(raw ? (JSON.parse(raw) as Record<string, string>) : {});
  localStorage.removeItem(DADOS_PREFIX + id);
  gravar({ ...e, ativoId: id });
  recarregar();
}

export function criarProjeto(nome: string) {
  const e = lerEstado();
  const p: Workspace = {
    id: uid(),
    nome: nome.trim() || `Projeto ${e.projetos.length + 1}`,
    criadoEm: new Date().toISOString(),
  };
  gravar({ ...e, projetos: [...e.projetos, p] });
  trocarProjeto(p.id);
}

export function renomearProjeto(id: string, nome: string) {
  const e = lerEstado();
  gravar({ ...e, projetos: e.projetos.map((p) => (p.id === id ? { ...p, nome } : p)) });
}

export function excluirProjeto(id: string) {
  const e = lerEstado();
  if (e.projetos.length <= 1) return;
  const resto = e.projetos.filter((p) => p.id !== id);
  if (id === e.ativoId) {
    const alvo = resto[0];
    const raw = localStorage.getItem(DADOS_PREFIX + alvo.id);
    aplicar(raw ? (JSON.parse(raw) as Record<string, string>) : {});
    localStorage.removeItem(DADOS_PREFIX + alvo.id);
    gravar({ ativoId: alvo.id, projetos: resto });
    recarregar();
  } else {
    localStorage.removeItem(DADOS_PREFIX + id);
    gravar({ ...e, projetos: resto });
  }
}
