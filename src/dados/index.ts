import arenaBasicaJson from "./arena-basica.json";
import personagensJson from "./personagens.json";
import { ErroDeDados, validarArena, validarPersonagens } from "./schemas";
import type { DefPersonagem } from "../sim/combate/tipos";

export const ARENA_BASICA = validarArena(arenaBasicaJson);
export const PERSONAGENS = validarPersonagens(personagensJson);

export function personagem(id: string): DefPersonagem {
  const def = PERSONAGENS.find((p) => p.id === id);
  if (!def) throw new ErroDeDados(`personagem desconhecido: ${id}`);
  return def;
}
