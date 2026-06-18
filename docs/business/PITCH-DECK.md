# NVP — Pitch Deck

> Présentation de vente / investisseurs. Une section = une slide. Texte prêt à
> coller dans Keynote/Google Slides/PowerPoint. Garder une slide ultra-épurée :
> 1 idée, 1 visuel. Ton : ambitieux mais honnête.

---

## Slide 1 — Couverture

# NVP
### L'IA qui tourne sur des millions de téléphones — pas dans des datacenters.

Le premier réseau d'inférence IA **possédé par les gens**.

*[logo] · [nom] · [contact] · [date]*

---

## Slide 2 — Le problème

**L'IA est centralisée, chère et fermée.**

- Quelques géants contrôlent le calcul (GPU rares, datacenters, énergie).
- Pendant ce temps, **des milliards de smartphones** ont des puces IA (NPU)
  puissantes… **inutilisées 95 % du temps**.
- Leurs propriétaires n'en tirent **rien**.

> Le calcul le plus sous-exploité de la planète est déjà dans nos poches.

---

## Slide 3 — La solution

**NVP transforme chaque téléphone en nœud d'un réseau d'IA mondial.**

1. Tu installes l'app → ton iPhone exécute un modèle d'IA en local.
2. Il répond à des requêtes du réseau.
3. **Tu es payé** pour chaque réponse vérifiée.

Côté utilisateur : un **chatbot** (et une **API compatible OpenAI**) dont les
réponses sont calculées par de vrais téléphones.

---

## Slide 4 — Démo (ce qui marche déjà)

- ✅ **Chatbot web** : pose une question → un iPhone répond en direct.
- ✅ **App iOS worker** : bouton « Become a worker » → gagne en USD.
- ✅ **API `/v1/chat/completions`** compatible OpenAI (clé `sk-nvp-…`).
- ✅ **Vérification** anti-triche (jobs-canaris déterministes).
- ✅ **Dashboard admin** : appareils en ligne, puissance combinée, activité live.

*[capture du chatbot] · [capture de l'app] · [capture admin]*

---

## Slide 5 — Pourquoi maintenant

- Les **NPU mobiles** atteignent des dizaines de TOPS (A17/A18, etc.).
- Les **petits modèles** (Gemma 3, etc.) deviennent excellents et tournent
  on-device.
- **Défiance** croissante envers les Big Tech → appétit pour une IA « du peuple ».
- L'écosystème **OpenAI-compatible** rend l'intégration triviale.

---

## Slide 6 — Comment ça marche (simple)

```
Tu demandes ─▶ Coordinateur ─▶ un iPhone calcule ─▶ Réponse
                                     │
                                     ▼
                         le propriétaire est payé 💵
```

Vérification déterministe + réputation = on sait que le calcul est réel, sans
tout recalculer.

---

## Slide 7 — Le marché

- **Inférence IA** : marché en croissance explosive (dizaines de milliards $).
- **Edge AI / on-device** : segment en forte hausse.
- **TAM illustratif** : > 1,5 milliard d'iPhones actifs ; même 0,1 % en workers =
  un supercalculateur distribué.

> *Chiffres marché à sourcer avant diffusion investisseurs (placeholders).* 

---

## Slide 8 — Business model

- **Revenu** : marge entre le prix payé par le requester et la part reversée au
  worker (take-rate réglable).
- **Bêta** : chat gratuit (crédit offert) pour l'adoption ; workers payés
  (financé plateforme).
- **Plus tard** : abonnements API, crédits prépayés, entreprises (inférence
  privée à bas coût).

---

## Slide 9 — Avantage défendable (moat)

1. **Effet de réseau** : chaque téléphone ajouté améliore capacité & latence.
2. **Coût marginal ~0** : pas de datacenter ; le matériel appartient aux users.
3. **Vérification + réputation** propriétaires.
4. **Marque & communauté** : « possédé par le peuple ».
5. **Compat OpenAI** : adoption développeurs sans friction.

---

## Slide 10 — Traction & feuille de route

- **Aujourd'hui (v0)** : produit fonctionnel de bout en bout (chatbot + app + API).
- **v1** : retraits réels, anti-fraude App Attest, Android.
- **v2** : marché décentralisé + gros modèles répartis sur plusieurs appareils.

*[insérer métriques réelles dès qu'elles existent : workers, jobs, tok/s]*

---

## Slide 11 — L'équipe

*[à compléter — fondateur(s), compétences clés, pourquoi vous]*

---

## Slide 12 — La demande (ask)

- **Ce qu'on lève / cherche** : *[montant / partenariats / pilotes]*.
- **Usage** : croissance de la base de workers, sécurité (App Attest), paiements.
- **Vision** : devenir l'**infrastructure d'IA possédée par les utilisateurs**.

> Rejoignez la révolution : l'IA rendue au peuple.
