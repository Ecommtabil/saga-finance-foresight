export function baixarArquivo(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function nomeArquivoNCG(empresa: string, extensao: string) {
  const nome = empresa.trim().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/\s+/g, "_").slice(0, 80) || "Empresa";
  return `Ecommtabil_NCG_${nome}.${extensao}`;
}