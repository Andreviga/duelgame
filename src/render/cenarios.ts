import type Phaser from "phaser";
import cenariosJson from "../dados/cenarios.json";
import type { Arena } from "../sim/combate/tipos";
import { colocarCamada, colocarCeu, type Camera } from "./camadas";

/** Arenas que têm cenário em imagens em `public/cenarios/<id>/`. As outras são desenhadas por código. */
export const CENARIOS: readonly string[] = cenariosJson;
const IMAGENS = ["ceu", "longe", "perto", "frente", "chao", "plataforma"] as const;
type Imagem = (typeof IMAGENS)[number];
/** Altura, em unidades do mundo, com que a imagem da plataforma é desenhada (a metade de baixo é sombra). */
const ALTURA_DA_PLATAFORMA = 20;

/** O que o jogo usa do `cenario.json` gravado pelo Blender. */
interface DadosDoCenario {
  encaixe: { linhaDoChao: number };
  paralaxeSugerida: { longe: number; perto: number; frente: number };
  corAbaixo: { longe: string; perto: string };
}

/**
 * Com `?cenario=codigo` no endereço, o jogo ignora as imagens e desenha as arenas por código.
 * Serve para comparar desempenho e para os testes longos, que não dependem do cenário.
 */
const SO_CODIGO =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("cenario") === "codigo";

const chave = (arena: string, imagem: Imagem): string => `cenario:${arena}:${imagem}`;
const chaveDosDados = (arena: string): string => `cenario:${arena}:dados`;

/**
 * Põe na fila de carga os cenários pedidos que ainda não foram carregados. Chamar no `preload`.
 * Cada tela pede só a arena que vai mostrar: carregar as três de uma vez pesaria à toa.
 */
export function carregarCenarios(cena: Phaser.Scene, arenas: readonly string[]): void {
  if (SO_CODIGO) return;
  for (const arena of arenas) {
    if (!CENARIOS.includes(arena)) continue;
    for (const imagem of IMAGENS) {
      if (cena.textures.exists(chave(arena, imagem))) continue;
      cena.load.image(chave(arena, imagem), `cenarios/${arena}/${imagem}.png`);
    }
    if (!cena.cache.json.exists(chaveDosDados(arena))) {
      cena.load.json(chaveDosDados(arena), `cenarios/${arena}/cenario.json`);
    }
  }
}

/** Uma falha de carga em arquivo de cenário não derruba o jogo: a arena volta a ser desenhada por código. */
export const ehArquivoDeCenario = (chaveDoArquivo: string): boolean =>
  chaveDoArquivo.startsWith("cenario:");

function dadosDoCenario(cena: Phaser.Scene, arena: string): DadosDoCenario | null {
  if (SO_CODIGO || !CENARIOS.includes(arena)) return null;
  if (!IMAGENS.every((imagem) => cena.textures.exists(chave(arena, imagem)))) return null;
  const d = cena.cache.json.get(chaveDosDados(arena)) as Partial<DadosDoCenario> | undefined;
  if (!d?.encaixe || !d.paralaxeSugerida || !d.corAbaixo) return null;
  return d as DadosDoCenario;
}

/** A arena tem todas as imagens carregadas? Se não tiver, quem chama usa o desenho por código. */
export const temCenario = (cena: Phaser.Scene, arena: string): boolean =>
  dadosDoCenario(cena, arena) !== null;

const cor = (hex: string): number => Number.parseInt(hex.replace("#", ""), 16);

/**
 * As camadas de imagem de uma arena. A ordem de desenho é a ordem em que as partes são criadas:
 * `criarFundo` (céu, longe, perto), depois o mundo com `criarPiso`, depois `criarFrente`.
 * Tudo aqui só lê a arena; nada volta para a simulação.
 */
export class CamadasDoCenario {
  private readonly dados: DadosDoCenario;
  private ceu: Phaser.GameObjects.Image | null = null;
  private largas: {
    img: Phaser.GameObjects.Image;
    paralaxe: number;
    abaixo: Phaser.GameObjects.Rectangle | null;
  }[] = [];

  /** Devolve null se a arena não tiver cenário carregado. */
  static para(cena: Phaser.Scene, arena: Arena): CamadasDoCenario | null {
    const dados = dadosDoCenario(cena, arena.id);
    return dados ? new CamadasDoCenario(cena, arena, dados) : null;
  }

  private constructor(
    private readonly cena: Phaser.Scene,
    private readonly arena: Arena,
    dados: DadosDoCenario,
  ) {
    this.dados = dados;
  }

  private get tela() {
    return { largura: this.cena.scale.width, altura: this.cena.scale.height };
  }

  private larga(imagem: "longe" | "perto" | "frente", corAbaixo: string | null) {
    const abaixo = corAbaixo
      ? this.cena.add.rectangle(0, 0, this.tela.largura, 10, cor(corAbaixo)).setOrigin(0, 0)
      : null;
    const img = this.cena.add.image(0, 0, chave(this.arena.id, imagem)).setOrigin(0, 0);
    this.largas.push({ img, paralaxe: this.dados.paralaxeSugerida[imagem], abaixo });
    return abaixo ? [abaixo, img] : [img];
  }

  /** Céu, camada distante e camada próxima, atrás da luta. */
  criarFundo(): Phaser.GameObjects.GameObject[] {
    this.ceu = this.cena.add.image(0, 0, chave(this.arena.id, "ceu")).setOrigin(0, 0);
    const p = colocarCeu({ largura: this.ceu.width, altura: this.ceu.height }, this.tela);
    this.ceu.setPosition(p.x, p.y).setScale(p.escala);
    return [
      this.ceu,
      ...this.larga("longe", this.dados.corAbaixo.longe),
      ...this.larga("perto", this.dados.corAbaixo.perto),
    ];
  }

  /** Chão e plataformas, em coordenadas do mundo: para pôr dentro do contêiner do mundo. */
  criarPiso(): Phaser.GameObjects.Image[] {
    const c = this.arena.chao;
    const chao = this.cena.add
      .image(c.x, c.y, chave(this.arena.id, "chao"))
      .setOrigin(0, 0)
      .setDisplaySize(c.largura, c.altura);
    const plataformas = this.arena.plataformas.map((p) =>
      this.cena.add
        .image(p.x, p.y, chave(this.arena.id, "plataforma"))
        .setOrigin(0, 0)
        .setDisplaySize(p.largura, ALTURA_DA_PLATAFORMA),
    );
    return [chao, ...plataformas];
  }

  /** O que passa na frente da luta, só nas bordas. */
  criarFrente(): Phaser.GameObjects.GameObject[] {
    return this.larga("frente", null);
  }

  /** Reposiciona as camadas largas para a câmera atual. */
  atualizar(cam: Camera): void {
    const tela = this.tela;
    for (const { img, paralaxe, abaixo } of this.largas) {
      const p = colocarCamada(
        { largura: img.width, linhaDoChao: this.dados.encaixe.linhaDoChao },
        paralaxe,
        this.arena.chao.y,
        cam,
        tela,
      );
      img.setPosition(p.x, p.y).setScale(p.escala);
      if (!abaixo) continue;
      // Da base da imagem até o fim da tela, a cor que continua a camada.
      const base = Math.floor(p.y + img.height * p.escala) - 1;
      abaixo.setPosition(0, base).setSize(tela.largura, Math.max(0, tela.altura - base));
      abaixo.setVisible(base < tela.altura);
    }
  }
}
