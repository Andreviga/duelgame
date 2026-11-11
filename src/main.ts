import Phaser from "phaser";
import { CenaCombate } from "./render/CenaCombate";
import { CenaInicial } from "./render/CenaInicial";
import { CenaPreparacao } from "./render/CenaPreparacao";
import { CenaResultado } from "./render/CenaResultado";
import { CenaSala } from "./render/CenaSala";
import { jogo } from "./render/jogo";

const outras = [CenaPreparacao, CenaResultado, CenaSala];
// Com ?demo o jogo abre direto no combate de demonstração (4x4 solto, sem partida).
const demo = new URLSearchParams(window.location.search).has("demo");

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "jogo",
  width: 1200,
  height: 675,
  backgroundColor: "#141a22",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: demo ? [CenaCombate, CenaInicial, ...outras] : [CenaInicial, CenaCombate, ...outras],
});

// Online, é o servidor que decide a tela: fecha as que estiverem abertas e abre a pedida.
jogo.irPara = (cena) => {
  for (const aberta of game.scene.getScenes(true)) game.scene.stop(aberta.scene.key);
  game.scene.start(cena);
};

// Aviso de conexão perdida, por cima do jogo.
const aviso = document.createElement("div");
aviso.id = "aviso-rede";
aviso.textContent = "Conexão perdida. Tentando reconectar…";
document.body.appendChild(aviso);
window.setInterval(() => {
  aviso.style.display = jogo.conexaoCaiu ? "block" : "none";
}, 250);
