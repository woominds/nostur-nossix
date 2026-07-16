export type SucursalActivaLike = {
  activo?: boolean | null;
  activa?: boolean | null;
};

export function filtrarSucursalesActivas<T extends SucursalActivaLike>(
  sucursales: T[] | null | undefined
): T[] {
  return (sucursales || []).filter(
    (sucursal) =>
      sucursal.activo !== false &&
      sucursal.activa !== false
  );
}