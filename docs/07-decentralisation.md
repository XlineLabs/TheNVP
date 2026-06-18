# 07 — Décentralisation : feuille de route (post-v0)

> Réponse à : « peut-on faire un truc complètement décentralisé, comme la
> blockchain ou BitTorrent, sans coordinateur central ? »

## TL;DR

Oui, c'est la **vision long terme** (et c'est ce qui rend le projet vraiment
« révolutionnaire »). Mais aller décentralisé **maintenant** ne livre pas plus
vite une app + un chatbot qui marchent — ça les livre beaucoup plus lentement et
avec un risque technique élevé. La v0 garde donc un **coordinateur central**, mais
est conçue pour être **décentralisable par morceaux** ensuite.

## Pourquoi pas tout de suite

### Style torrent / DHT (découverte pair-à-pair)

- **iOS l'interdit en pratique.** Les iPhones sont derrière le NAT opérateur et
  iOS tue le réseau en arrière-plan : un téléphone ne peut pas être un nœud DHT
  qui accepte des connexions entrantes ; il ne peut que **poller vers l'extérieur,
  app au premier plan** (cf. `01-prd.md` §vérités). Ça casse le P2P pur sur iPhone.
- **Découverte + hole-punching NAT** nécessitent des relais TURN — c'est-à-dire…
  encore de l'infra centrale.

### Style blockchain (paiement + vérif sans tiers de confiance)

- **Les micro-paiements ne passent pas on-chain.** Payer 0,0002 $ par job coûte
  plus cher en gas que le paiement, sauf à empiler L2 + canaux de paiement —
  lourd, et `01-prd.md` exclut explicitement la crypto en v0.
- **Vérifier qu'un téléphone a vraiment fait le calcul** est non résolu à grande
  échelle : les preuves ZK d'inférence LLM (ZKML) sont extrêmement coûteuses ;
  les preuves de fraude optimistes obligent quelqu'un à ré-exécuter le job. Le
  coordinateur central marche **parce qu'**un tiers de confiance détient les
  réponses canaris attendues.
- La blockchain ne règle pas la fraude ici : il faut toujours de l'**attestation
  d'appareil** (App Attest) pour prouver que c'est un vrai iPhone non trafiqué.

## Architecture v0 « décentralisation-ready »

On isole déjà les concepts qui devront être remplacés :

| Concept v0 (central)                  | Brique de remplacement (v2)                          |
| ------------------------------------- | ---------------------------------------------------- |
| `jobs` + dispatch SKIP LOCKED         | Marché de jobs / DHT (publication + claim signés)    |
| Ledger Postgres (`ledger_entries`)    | Settlement on-chain ou canaux de paiement (L2)       |
| Vérif canaris (serveur détient l'attendu) | Redondance N-of-M + attestation + preuves optimistes |
| Clé d'API par appareil                | App Attest / DeviceCheck + clé publique signée       |
| Long-poll HTTP                        | libp2p / QUIC + relais                               |

Décisions de conception prises dès la v0 pour faciliter la suite :

- **Résultats attribuables** : chaque job a un worker assigné et un `job_result`
  horodaté → base d'une future signature cryptographique du résultat.
- **Settlement abstrait** : tout l'argent passe par des écritures de ledger
  (`ledger_entries`, `user_ledger_entries`). Remplacer l'implémentation par un
  contrat/État on-chain ne change pas les appelants.
- **Pricing isolé** (`app/lib/pricing.ts`) : un seul endroit définit le prix réel
  en USD ; un futur oracle/marché peut le remplacer.

## Trajectoire proposée

1. **v0 (maintenant)** — coordinateur central. App + chatbot fonctionnels, vrais
   paiements en ledger USD.
2. **v1** — anti-fraude renforcé (App Attest), SSE/WebSocket, seuils de retrait,
   premiers vrais virements (Stripe Connect), signature des résultats par appareil.
3. **v2** — remplacer le dispatch par un **marché/DHT**, le settlement par des
   **canaux de paiement / L2**, la vérif par **redondance + attestation + preuves
   optimistes**. C'est là que naît le pipeline d'activations NVP-D (gros modèles
   répartis sur plusieurs appareils).

Chaque étape garde un produit utilisable ; la décentralisation arrive comme une
suite de remplacements de modules, pas une réécriture.
