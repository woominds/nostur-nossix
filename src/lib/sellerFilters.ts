export const SELLER_FILTER_ALL = "__all__";

export type SellerProfileLite = {
  id: string;
  nombre?: string | null;
  apellido?: string | null;
  email?: string | null;
  rol?: string | null;
  activo?: boolean | null;
  color?: string | null;
};

export function getProfileFullName(profile?: SellerProfileLite | null): string {
  if (!profile) return "Sin asignar";

  return (
    `${profile.nombre || ""} ${profile.apellido || ""}`.trim() ||
    profile.email ||
    "Usuario"
  );
}

export function isSellerRole(profile?: SellerProfileLite | null): boolean {
  return String(profile?.rol || "").toLowerCase() === "vendedor";
}

export function getDefaultSellerFilter(params: {
  currentUserId: string | null;
  currentProfile: SellerProfileLite | null;
}): string {
  const { currentUserId, currentProfile } = params;

  if (currentUserId && isSellerRole(currentProfile)) {
    return currentUserId;
  }

  return SELLER_FILTER_ALL;
}

export function applySellerFilterToQuery<TQuery>(params: {
  query: TQuery;
  sellerFilterId: string;
  field?: string;
}): TQuery {
  const { query, sellerFilterId, field = "vendedor_id" } = params;

  if (!sellerFilterId || sellerFilterId === SELLER_FILTER_ALL) {
    return query;
  }

  return (query as any).eq(field, sellerFilterId);
}