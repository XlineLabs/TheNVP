# 09 — Diviser le modèle sur plusieurs workers (réflexion v2)

> Réponse honnête à : « divise le modèle en parties selon les workers et utilise
> les deux pour plus de puissance / une réponse plus rapide ». Ce document
> explique **pourquoi ce n'est pas faisable maintenant**, **ce qu'on fait à la
> place (Boost)**, et **comment on le ferait vraiment en v2**.

## Ce que veut dire « diviser le modèle »

Deux familles de parallélisme :

1. **Pipeline parallelism** : couper les couches du modèle en blocs (couches 1–N
   sur l'appareil A, N+1–M sur B). À chaque token, l'activation passe de A → B.
2. **Tensor parallelism** : couper *chaque* couche entre appareils ; échanges à
   chaque sous-étape.

## Pourquoi c'est infaisable aujourd'hui (et pourquoi ce serait plus lent)

- **La latence réseau tue le gain.** Générer un token = des dizaines/centaines de
  couches. En pipeline sur 2 téléphones reliés par **internet** (Wi-Fi/4G, NAT,
  20–150 ms d'aller-retour), il faut transférer l'activation **à chaque token**
  (souvent **à chaque couche**). Le temps de transfert dépasse de très loin le
  calcul économisé → **plus lent** qu'un seul appareil.
- iOS **interdit** les connexions entrantes / le réseau soutenu en arrière-plan →
  pas de lien direct fiable entre 2 iPhones (il faudrait des relais).
- Synchronisation, tolérance aux pannes (un worker disparaît en plein token),
  sécurité des activations… → problème de **systèmes distribués de recherche**.

> Le split n'a de sens que sur un lien **ultra-rapide et fiable** (datacenter,
> NVLink, LAN câblé). Sur des téléphones grand public via internet, non.

## Ce qu'on fait à la place — et qui marche

### Boost (course / best-of-N) — **implémenté**
La requête est envoyée à **N workers en parallèle** ; on garde la **réponse la
plus rapide**. Implémentation : N jobs partagent un `redundancy_group` (turn id) ;
le premier résultat accepté écrit la réponse (insertion gardée `WHERE NOT
EXISTS`), les autres sont ignorés. **Vérifié** : 2 jobs → 2 workers distincts → 1
seule réponse livrée.

- ✅ Utilise réellement plusieurs appareils pour une requête.
- ✅ Réduit la latence perçue (meilleur-de-N) et la variance.
- ⚠️ Ne « divise » pas le modèle : chaque worker fait le calcul complet.

### Autres leviers de vitesse (réels)
- **Débit (throughput)** : beaucoup de requêtes en parallèle réparties sur tous
  les workers (déjà le cas).
- **Décodage spéculatif** : un petit modèle « draft » + vérif (futur).
- **Modèle plus rapide / moins de tokens**, quantization.

## Comment on le ferait vraiment en v2 (NVP-D)

1. **Sharding par couches** d'un **gros** modèle (qui ne tient pas sur 1 appareil)
   — l'intérêt n'est pas la vitesse mais de **faire tenir** un modèle trop gros.
2. **Transport bas-latence** : QUIC + relais TURN ; grouper les workers d'une même
   région / même réseau.
3. **Placement** : appareils proches (latence) et stables (réputation, branchés).
4. **Tolérance aux pannes** : checkpoints d'activations, reprise sur un autre
   worker.
5. **Vérification** : preuves sur les activations / redondance par segment.

**Conclusion** : pour « plus de puissance », la v2 vise à faire tourner des
modèles **trop gros pour un seul téléphone** (pas à accélérer un petit modèle).
Pour « plus rapide maintenant », c'est **Boost** + un **modèle adapté** (ex.
Gemma 3 1B rapide, ou Gemma 3n E2B plus costaud quand l'appareil le permet).
