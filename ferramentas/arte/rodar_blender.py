"""Roda um script do Blender com o que estiver disponível: o programa `blender` ou o módulo `bpy`.

Uso: python3 ferramentas/arte/rodar_blender.py [arquivo.blend] script.py -- argumentos...
Com o programa instalado, equivale a: blender -b [arquivo.blend] -P script.py -- argumentos...
"""

import runpy
import shutil
import subprocess
import sys

args = sys.argv[1:]
blend = args.pop(0) if args and args[0].endswith(".blend") else None
script = args.pop(0)
resto = args  # começa com "--"

programa = shutil.which("blender")
if programa:
    comando = [programa, "-b"] + ([blend] if blend else []) + ["-P", script] + resto
    raise SystemExit(subprocess.call(comando))

try:
    import bpy
except ImportError:
    raise SystemExit(
        "Blender não encontrado. Instale o Blender (o comando `blender` precisa estar no PATH) "
        "ou o módulo Python `bpy` da mesma versão."
    )

if blend:
    bpy.ops.wm.open_mainfile(filepath=blend)
sys.argv = [script] + resto
runpy.run_path(script, run_name="__main__")
