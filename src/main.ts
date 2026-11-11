import Phaser from "phaser";
import { CenaCombate } from "./render/CenaCombate";
import { CenaPreparacao } from "./render/CenaPreparacao";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "jogo",
  width: 1200,
  height: 675,
  backgroundColor: "#141a22",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // Com ?demo o jogo abre direto no combate de demonstração da fase 2.
  scene: new URLSearchParams(window.location.search).has("demo")
    ? [CenaCombate, CenaPreparacao]
    : [CenaPreparacao, CenaCombate],
});
