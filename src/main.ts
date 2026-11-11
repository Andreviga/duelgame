import Phaser from "phaser";
import { CenaDuelo } from "./render/CenaDuelo";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "jogo",
  width: 1200,
  height: 675,
  backgroundColor: "#141a22",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [CenaDuelo],
});
