import { OportunidadesPanel } from "../../modules/comunicaciones/OportunidadesPanel";

export function MobileOportunidades() {
  return (
    <div className="min-h-full overflow-x-hidden bg-[#f6f8fb]">
      <div className="min-w-0 [&_*]:max-w-full">
        <OportunidadesPanel />
      </div>
    </div>
  );
}

export default MobileOportunidades;
