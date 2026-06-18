# 06 — Intégration MLX Swift + Gemma 4 E2B (iOS)

> Ce doc **remplace le choix de modèle** de `04-app-ios.md` : le modèle cible est **Gemma 4 E2B** (instruct, 4-bit MLX). Il décrit comment le faire tourner on-device et la séquence pour arriver vite à une version fonctionnelle.

## 1. Le modèle

- **Famille** : Gemma 4 (Google DeepMind, sorti le 2 avril 2026, **licence Apache 2.0** → usage commercial libre, redistribution OK).
- **Variante mobile : E2B** — le « E » = *effective parameters* ; l’archi **Per-Layer Embeddings (PLE)** donne à chaque couche son petit embedding, ce qui maximise l’efficacité mémoire en on-device. E2B et E4B supportent nativement texte + image + audio ; **en v0 on n’utilise que le texte** (désactiver image/audio pour économiser la RAM).
- **Quant cible** : 4-bit MLX.
  - Point d’entrée : `mlx-community/gemma-4-e2b-it-4bit` (rapporté fonctionnel sur iPhone avec le port Swift ci-dessous).
  - Meilleure qualité à taille égale : `mlx-community/gemma-4-e2b-it-OptiQ-4bit` (précision mixte, bat le 4-bit uniforme).
  - ⚠️ Certaines quantif MLX de Gemma 4 sur HF sont **cassées sur le chemin multimodal** ; comme on ne fait que du texte, on est sur le chemin sûr, mais **valider toute quantif sur Mac avant de l’embarquer** (cf. §5).

## 2. Le mur technique et comment le passer

`mlx-swift-lm` (≈2.31.x) **ne gère pas Gemma 4 out-of-the-box**. Deux raisons :

1. **Chargement des poids** : Gemma 4 diffère de Gemma 3 (PLE, KV-sharing sur l’arrière du décodeur, RoPE à rotation partielle `partial_rotary_factor = 0.75`, `rope_type = longrope`). Réutiliser le décodeur Gemma 3 échoue.
1. **Chat template** : le chemin swift-jinja corrompt le prompt en silence → le modèle charge mais génère du charabia.

**Solution : utiliser un port Swift dédié du décodeur Gemma 4.** Deux pistes communautaires à évaluer (vendoring ou SPM) :

- `github.com/yejingyang8963-byte/Swift-gemma4-core` — port pur-Swift du **décodeur texte** branché sur mlx-swift-lm en *sidecar*. Implémente PLE, KV-sharing, le RoPE proportionnel custom, et **un bypass du chat template** (construction littérale du prompt + `tokenizer.encode(text:)`, aligné byte-for-byte sur `apply_chat_template` de Python mlx-lm). C’est le plus proche de notre besoin (texte only). Mesures iPhone rapportées : load ~6 s, mémoire après load ~340–390 Mo, TTFT 2,82 s, 12–14 tok/s.
- `github.com/VincentGourbin/gemma-4-swift-mlx` — inférence multimodale native MLX Swift pour Apple Silicon, avec CLI de profilage. Plus large que nécessaire, mais utile comme référence/validation.

> Recommandation : partir du **sidecar texte** (option A), c’est le moins lourd. Garder le repo Vincent comme référence de validation et profilage.

## 3. Le chat template Gemma (ne pas se louper)

Ne **pas** s’appuyer sur swift-jinja. Construire le prompt en littéral, format Gemma :

```
<bos><start_of_turn>user
{user_prompt}<end_of_turn>
<start_of_turn>model
```

- Encoder via `tokenizer.encode(text:)` (pas via un apply_chat_template Swift).
- Arrêter la génération au token `<end_of_turn>`.
- **Vérifier byte-for-byte** que la séquence de tokens correspond à ce que produit `tokenizer.apply_chat_template(...)` côté Python mlx-lm (sinon dérive de qualité). Le `chat_template` exact est dans le `tokenizer_config.json` du repo HF — c’est la source de vérité.

## 4. Cibles appareil & mémoire

- **Appareils** : viser iPhone 15 Pro et au-dessus (≥ 8 Go RAM). E2B reste léger grâce au PLE, mais garder une marge.
- **Entitlement** : demander **Increased Memory Limit** (`com.apple.developer.kernel.increased-memory-limit`) pour éviter le jetsam sur les jobs longs.
- **Texte only** : ne pas charger les tours vision/audio (mémoire + temps de load en moins).
- **Garde-fous runtime** (déjà prévus dans `WorkerLoop`, cf. 04) :
  - pause si `ProcessInfo.thermalState >= .serious`,
  - worker actif seulement au premier plan,
  - recommander la charge ; afficher l’état.
- **Config de référence** (pour debug si le load casse) : `num_hidden_layers = 32`, `num_key_value_heads = 8`, `partial_rotary_factor = 0.75`, quant `group_size = 64, bits = 4, mode = affine`.

## 5. Déterminisme pour la vérification (lien avec 02-architecture)

Toute la vérif serveur repose sur le **greedy déterministe**. Donc :

- Générer en **temperature = 0, top-k=1, seed fixe**, sans repetition penalty (pour rester reproductible).
- **Générer les sorties attendues des canaris avec le MÊME modèle + MÊME quant** que les workers, sur Mac (Apple Silicon, MLX) :
  
  ```bash
  pip install mlx-lm
  python -c "
  from mlx_lm import load, generate
  m,t = load('mlx-community/gemma-4-e2b-it-4bit')
  print(generate(m,t, prompt='<le prompt canari>', max_tokens=64, temp=0.0))
  "
  ```
  
  Stocker (prompt → sortie) dans `jobs.canary_expected`.
- **Caveat honnête** : le bit-exact greedy est fiable sur une même archi MLX, mais deux puces Apple différentes peuvent diverger sur quelques tokens. Mitigations v0 :
  - comparer après **normalisation** (trim, espaces) plutôt qu’égalité brute si on observe des écarts,
  - choisir des **canaris courts et robustes** (réponses factuelles déterministes),
  - relâcher en « préfixe identique sur N tokens » si nécessaire.
- Le drafter `gemma-4-e2b-it-assistant-bf16` (décodage spéculatif, équivalence greedy bit-exacte) peut accélérer plus tard — **hors v0**.

## 6. API de l’`InferenceEngine` (forme attendue)

L’API exacte dépend du port choisi ; viser cette interface côté app :

```swift
protocol InferenceEngine {
    /// charge le modèle depuis un dossier local (poids + tokenizer)
    func load(modelDir: URL) async throws

    /// génération greedy déterministe, stop sur <end_of_turn>
    func generate(prompt: String, maxTokens: Int) async throws -> GenResult

    var isLoaded: Bool { get }
    func unload()   // libère la RAM quand le worker passe OFF
}

struct GenResult {
    let text: String
    let tokensOut: Int
    let latencyMs: Int
}
```

`WorkerLoop` appelle `generate` pour chaque job, construit le prompt Gemma (§3), et poste le résultat. `unload()` sur passage en background pour rendre la mémoire.

## 7. Téléchargement du modèle

- `GET /api/models` renvoie l’URL des poids + tokenizer + un checksum.
- Télécharger au premier lancement dans `Application Support/models/gemma-4-e2b-it-4bit/`, vérifier le checksum, puis charger.
- Taille à afficher dans l’UI (download conséquent en Wi-Fi recommandé).

## 8. Séquence pour une version fonctionnelle (dé-risquée)

Ne pas tout miser sur Gemma 4 d’emblée. Ordre conseillé :

1. **Mac d’abord** : faire tourner `mlx-community/gemma-4-e2b-it-4bit` via `mlx-lm` Python en greedy → confirmer que le modèle répond correctement et **générer les canaris de référence**. (30 min, zéro risque iOS.)
1. **Port Swift sur Mac** : cloner le sidecar Gemma 4, builder la CLI, vérifier la **parité de sortie** avec le Python (même prompt → même texte). C’est le go/no-go du port.
1. **Pipeline iOS avec un modèle natif d’abord** : pour valider tout le `WorkerLoop` (next → infer → submit → crédit) sans dépendre du port, brancher un modèle **déjà supporté nativement** par mlx-swift-lm (ex. un Qwen2.5-0.5B-Instruct 4-bit). On prouve la boucle end-to-end.
1. **Swap Gemma 4** : remplacer l’`InferenceEngine` par le port Gemma 4 E2B, re-tester la parité + les canaris sur device.
1. **Mesurer** : load, TTFT, tok/s, RAM, thermal sur l’iPhone cible ; ajuster `max_tokens` et la cadence.

Cette séquence te donne une **boucle qui crédite réellement** dès l’étape 3, puis Gemma 4 « pour de vrai » à l’étape 4, sans rester bloqué si le port demande du tuning.

## 9. Plan B si le port Gemma 4 résiste

- **llama.cpp + GGUF** : des GGUF Gemma 4 E2B existent (unsloth). Wrapper Swift llama.cpp, greedy. Plus universel, perd l’optimisation MLX/PLE.
- **Rester sur le modèle natif** (Qwen2.5-0.5B) pour la démo fonctionnelle et garder Gemma 4 E2B comme cible v0.1 une fois le port stabilisé.

## Sources / repos à ouvrir

- Modèle & licence : `ai.google.dev/gemma/docs/core` · `huggingface.co/blog/gemma4`
- Quants MLX : `huggingface.co/mlx-community` (`gemma-4-e2b-it-4bit`, `gemma-4-e2b-it-OptiQ-4bit`)
- Port Swift sidecar (texte) : `github.com/yejingyang8963-byte/Swift-gemma4-core`
- Référence MLX Swift multimodale + CLI : `github.com/VincentGourbin/gemma-4-swift-mlx`
- Quantif PLE-safe / pièges : `github.com/FakeRocket543/mlx-gemma4`