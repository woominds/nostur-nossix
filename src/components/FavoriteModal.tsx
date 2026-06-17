import { useState } from "react";
import type { SyntheticEvent } from "react";
import { Star, X } from "lucide-react";
import { useBrowserStore } from "../store/browserStore";
import { getDomainFromUrl } from "../utils/url";

type FavoriteModalProps = {
  url: string;
  defaultName: string;
  appId: string;
  faviconUrl?: string;
  onClose: () => void;
};

export function FavoriteModal({
  url,
  defaultName,
  appId,
  faviconUrl,
  onClose
}: FavoriteModalProps) {
  const addFavorite = useBrowserStore((state) => state.addFavorite);
  const [name, setName] = useState(defaultName || getDomainFromUrl(url) || "Favorito");

function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault();

    addFavorite({
      name: name.trim() || getDomainFromUrl(url) || "Favorito",
      url,
      appId,
      faviconUrl
    });

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 pt-28 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-[420px] rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-nostur-orange text-black">
              <Star size={20} />
            </div>

            <div>
              <h2 className="text-base font-bold text-white">Agregar favorito</h2>
              <p className="text-xs text-nostur-muted">Elegí cómo querés llamarlo.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-nostur-muted hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 rounded-2xl border border-white/10 bg-[#0b1119] p-3">
          <div className="mb-2 flex items-center gap-2">
            {faviconUrl ? <img src={faviconUrl} className="h-5 w-5 rounded" alt="" /> : null}
            <span className="truncate text-sm text-white">{getDomainFromUrl(url)}</span>
          </div>
          <p className="truncate text-xs text-nostur-muted">{url}</p>
        </div>

        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-nostur-muted">
          Nombre del favorito
        </label>

        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mb-5 h-11 w-full rounded-2xl border border-white/10 bg-[#0b1119] px-4 text-sm text-white outline-none placeholder:text-nostur-muted focus:border-nostur-orange"
          placeholder="Ej: Experts, Ábaco, Banco, Proveedor..."
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-2xl px-4 text-sm font-semibold text-nostur-muted hover:bg-white/10 hover:text-white"
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="h-10 rounded-2xl bg-nostur-orange px-5 text-sm font-bold text-black hover:bg-nostur-orangeSoft"
          >
            Guardar favorito
          </button>
        </div>
      </form>
    </div>
  );
}