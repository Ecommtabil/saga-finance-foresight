import { useRef } from "react";
import { Save, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSaga, type ProjetoSaga } from "@/lib/saga/context";

function slug(s: string) {
  return (s || "projeto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function ProjectActions() {
  const { empresa, exportarProjeto, carregarProjeto } = useSaga();
  const inputRef = useRef<HTMLInputElement>(null);

  const salvar = () => {
    const projeto = exportarProjeto();
    const blob = new Blob([JSON.stringify(projeto, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `saga-${slug(empresa?.nome ?? "")}-${new Date().toISOString().slice(0, 10)}.saga.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const abrir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const projeto = JSON.parse(await file.text()) as ProjetoSaga;
      if (!projeto || typeof projeto !== "object" || !("versao" in projeto)) {
        throw new Error("formato");
      }
      carregarProjeto(projeto);
    } catch {
      alert("Arquivo de projeto inválido. Selecione um arquivo .saga.json salvo pelo SAGA.");
    }
  };

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={abrir}
      />
      <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
        <FolderOpen className="h-4 w-4" />
        <span className="hidden sm:inline">Abrir projeto</span>
      </Button>
      <Button variant="outline" size="sm" onClick={salvar}>
        <Save className="h-4 w-4" />
        <span className="hidden sm:inline">Salvar projeto</span>
      </Button>
    </div>
  );
}
