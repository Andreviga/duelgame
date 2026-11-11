#!/usr/bin/env python3
"""Edita números dos JSON de dados pela linha de comando, para iterar no balanceamento.

Uso: python3 ferramentas/ajustar.py maestro.ataque.dano=4.5 sinergias.mundos.dojo.niveis.1.efeitos.recargaHabilidade=1.2
O primeiro trecho é o id de um personagem ou o nome de um arquivo de src/dados (sem .json).
"""
import json, sys, pathlib

DADOS = pathlib.Path(__file__).resolve().parent.parent / "src" / "dados"
personagens = json.loads((DADOS / "personagens.json").read_text())
ids = {p["id"]: p for p in personagens}
abertos = {}

for arg in sys.argv[1:]:
    caminho, valor = arg.split("=")
    partes = caminho.split(".")
    if partes[0] in ids:
        alvo = ids[partes[0]]
    else:
        alvo = abertos.setdefault(partes[0], json.loads((DADOS / f"{partes[0]}.json").read_text()))
    for parte in partes[1:-1]:
        alvo = alvo[int(parte)] if isinstance(alvo, list) else alvo[parte]
    chave = int(partes[-1]) if isinstance(alvo, list) else partes[-1]
    antes = alvo[chave]
    alvo[chave] = json.loads(valor)
    print(f"{caminho}: {antes} -> {alvo[chave]}")

(DADOS / "personagens.json").write_text(json.dumps(personagens, ensure_ascii=False, indent=2) + "\n")
for nome, conteudo in abertos.items():
    (DADOS / f"{nome}.json").write_text(json.dumps(conteudo, ensure_ascii=False, indent=2) + "\n")
