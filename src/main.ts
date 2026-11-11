import Phaser from "phaser";
import { CenaCombate } from "./render/CenaCombate";
import { CenaInicial } from "./render/CenaInicial";
import { CenaPreparacao } from "./render/CenaPreparacao";
import { CenaResultado } from "./render/CenaResultado";

const outras = [CenaPreparacao, CenaResultado];
// Com ?demo o jogo abre direto no combate de demonstração (4x4 solto, sem partida).
const demo = new URLSearchParams(window.location.search).has("demo");

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "jogo",
  width: 1200,
  height: 675,
  backgroundColor: "#141a22",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: demo ? [CenaCombate, CenaInicial, ...outras] : [CenaInicial, CenaCombate, ...outras],
});
