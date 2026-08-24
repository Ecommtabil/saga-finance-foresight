import { useRef } from "react";
import { Save, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSimpl } from "@/lib/simpl/store";

export function SimplProjectActions() {
  const { empresa, exportarEstado, importarEstado } = useSimpl();
  const inputRef = useRef<HTMLInputElement>(null);

  const slug = (s: string) =>
    (s || "modelagem")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

  const salvar = () => {
    const blob = new Blob([exportarEstado()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simpl-${slug(empresa?.nome ?? "")}-${new Date().toISOString().slice(0, 10)}.simpl.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const abrir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      importarEstado(await file.text());
    } catch {
      alert("Arquivo inválido. Selecione um arquivo .simpl.json salvo pela Modelagem Simplificada.");
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
        <span className="hidden sm:inline">Abrir modelagem</span>
      </Button>
      <Button variant="outline" size="sm" onClick={salvar}>
        <Save className="h-4 w-4" />
        <span className="hidden sm:inline">Salvar modelagem</span>
      </Button>
    </div>
  );
}
