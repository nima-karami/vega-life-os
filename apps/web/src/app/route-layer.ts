type MorphDirection = "open" | "back";

export interface RouteLayer {
  pathname: string;
  /** Changes on every route fade; held through a card → page morph. */
  key: number;
  carriedPath: string | null;
  direction: MorphDirection | null;
}

export function advanceRouteLayer(
  layer: RouteLayer,
  pathname: string,
  carriedPath: string | null,
): RouteLayer {
  if (layer.pathname === pathname && layer.carriedPath === carriedPath) return layer;
  const isFade = layer.pathname !== pathname && carriedPath === null;
  return {
    pathname,
    key: isFade ? layer.key + 1 : layer.key,
    carriedPath,
    direction: resolveMorphDirection(layer, pathname, carriedPath),
  };
}

function resolveMorphDirection(
  layer: RouteLayer,
  pathname: string,
  carriedPath: string | null,
): MorphDirection | null {
  if (carriedPath === null) return null;
  if (carriedPath === layer.carriedPath) return layer.direction;
  // Back starts on the page being carried; a forward open starts on the list.
  return pathname === carriedPath ? "back" : "open";
}
