/**
 * Tiempo del clip para un tiempo de juego, con dos tramos lineales: [0, impacto] del juego va a
 * [0, contacto] del clip, y [impacto, fin] a [contacto, duración]. Así el cuadro de contacto del
 * clip cae exactamente en el impacto que define la tabla de ataques.
 */
export function warpTime(
  gameTime: number,
  impactTime: number,
  totalTime: number,
  contact: number,
  clipDuration: number,
): number {
  if (gameTime <= 0) return 0;
  if (gameTime <= impactTime) return (gameTime / impactTime) * contact;
  const tail = totalTime - impactTime;
  const u = tail > 0 ? Math.min((gameTime - impactTime) / tail, 1) : 1;
  return contact + u * (clipDuration - contact);
}

/** Momento de impacto de un ataque: el instante de impacto puntual, o el medio de la ventana. */
export function impactTimeOf(def: {
  active: readonly [number, number];
  impact?: { at: number };
}): number {
  return def.impact?.at ?? (def.active[0] + def.active[1]) / 2;
}

/**
 * Impacto de un golpe del jefe, contado desde el inicio de la carga: los golpes que pegan una vez
 * (martillazo, garfio, invocación) conectan al empezar la ventana; los barridos, en el medio.
 */
export function bossImpactTime(windup: number, active: number, instant: boolean): number {
  return windup + (instant ? 0 : active / 2);
}
