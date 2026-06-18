# 01 — PRD · NVP Node v0

## Vision (north star)

Un réseau où la puissance inutilisée des machines grand public exécute de l’inférence IA, et où les gens sont payés pour ça. À terme : pipeline d’activations entre appareils (cf. spec NVP complète). **Cette v0 ne livre que la première marche utile et démontrable.**

## Énoncé v0

Une app iOS transforme un iPhone en **worker** qui exécute de petits modèles de langage en local. Un **coordinateur** central distribue des jobs d’inférence et crédite le worker à chaque job accepté. L’utilisateur **voit son solde grimper** et peut **demander un retrait**.

## Utilisateurs

- **Worker** (cœur v0) : possède un iPhone, installe l’app, active le mode worker, gagne des crédits, consulte ses gains.
- **Requester** (minimal v0) : soumet des jobs d’inférence via l’API ou une petite page de test. Pas d’UI riche en v0.
- **Opérateur** (toi) : seed les modèles, les canaris, et traite les demandes de retrait à la main.

## Périmètre fonctionnel v0

**Inclus**

1. Enregistrement d’un appareil → clé d’API.
1. Téléchargement d’un petit modèle quantifié sur l’appareil.
1. Mode worker : récupérer un job, l’exécuter on-device (greedy), renvoyer le résultat + latence.
1. Vérification : jobs-canaris + redondance optionnelle.
1. Crédit du worker via ledger Postgres ; calcul du solde.
1. Écran Gains : solde, historique des jobs/crédits, bouton « Demander un retrait ».
1. Soumission de jobs (API requester) + petite page web de test.
1. Simulateur de worker (TS) pour tester le backend sans téléphone.

**Exclus (v1+)**

- Pipeline d’activations / sharding (v2).
- Vrais virements d’argent (Stripe Connect viendra plus tard).
- DHT / décentralisation du coordinateur.
- Modèles > 1.5B, entraînement, vision.

## Modèles cibles v0

Petits LLM instruct quantifiés 4-bit, ex. `Qwen2.5-0.5B-Instruct`, `Llama-3.2-1B-Instruct`, ou `TinyLlama-1.1B`. Choisir le plus léger qui tourne confortablement sur un iPhone récent. Le coordinateur connaît la liste des modèles supportés (table `models`).

## Unité économique

- 1 job accepté → crédit = `models.credit_rate` (réglable par modèle/taille).
- Solde = somme du ledger.
- Retrait : crée une demande `pending` (traitée hors app en v0).

## Critères de succès (definition of done v0)

1. Le simulateur enregistre un worker, traite 100 jobs, et son solde reflète exactement les jobs acceptés.
1. Un job-canari avec mauvaise réponse est **rejeté** et non crédité.
1. L’app iOS réelle exécute au moins un modèle on-device, traite des jobs, et l’écran Gains affiche le solde correct en temps quasi réel.
1. Une demande de retrait apparaît côté serveur en statut `requested`.
1. Tout se lance depuis le `README` sans étape cachée.

## Risques & vérités à ne pas masquer

- **iOS tue le compute en arrière-plan.** Une app ne peut pas calculer librement « dans la poche ». En pratique le worker gagne **app ouverte au premier plan**, idéalement **branché au chargeur**. Le design produit doit l’assumer : positionner comme « gagne pendant que tu charges ton téléphone le soir », pas « gagne passivement 24/7 ». Afficher l’état (premier plan / branché) dans l’app.
- **Mémoire/chauffe.** Les petits modèles seulement ; surveiller la RAM (limite par app) et throttler si l’appareil chauffe.
- **Vérif de sortie générative.** Deux exécutions ne sont identiques que si greedy + même modèle/quant. D’où l’obligation temperature = 0 et la dépendance aux canaris.
- **Fraude.** Clé d’API + réputation + canaris en v0 ; **App Attest (DeviceCheck)** à ajouter en v1 pour prouver que c’est une vraie app non trafiquée.
- **Retraits réels = lourd** (KYC, micro-montants). À traiter plus tard via seuil de retrait + Stripe Connect ou bons d’achat. Hors v0.
- **Économie réelle** : l’avantage n’est pas le prix au FLOP mais l’accès distribué. Sujet business, pas v0 — juste à garder en tête.