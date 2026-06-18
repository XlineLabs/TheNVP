# NVP — One-Pager

> Support d'une page pour partenaires, presse, investisseurs. À exporter en PDF.

---

# NVP — L'IA possédée par les gens

**L'IA qui tourne sur des millions de téléphones, pas dans des datacenters.**

## Le problème
L'inférence IA est centralisée et coûteuse, alors que des **milliards de
smartphones** disposent de puces IA (NPU) puissantes **inutilisées**, dont les
propriétaires ne tirent aucune valeur.

## La solution
NVP met ces appareils en réseau. Chaque téléphone exécute un modèle d'IA en
local, répond aux requêtes du réseau, et **son propriétaire est payé**. Les
utilisateurs accèdent à un **chatbot** et à une **API compatible OpenAI** dont les
réponses sont calculées par de vrais téléphones.

## Ce qui fonctionne déjà (v0)
- Chatbot web (réponses calculées en direct par des iPhones)
- App iOS « worker » qui paie en USD
- API `/v1/chat/completions` compatible OpenAI
- Vérification anti-triche (jobs-canaris déterministes) + réputation
- Dashboard admin temps réel (appareils en ligne, puissance combinée)

## Pourquoi c'est défendable
- **Effet de réseau** : chaque appareil ajouté renforce le réseau.
- **Coût marginal ~0** : pas de datacenter ; matériel des utilisateurs.
- **Vérification + réputation** propriétaires.
- **Compatibilité OpenAI** : adoption sans friction.

## Business model
Marge entre le prix payé par le requester et la part reversée au worker
(take-rate réglable). Bêta : chat gratuit pour l'adoption, workers payés.

## Feuille de route
v0 produit complet → **v1** retraits réels + anti-fraude + Android → **v2**
marché décentralisé + gros modèles répartis sur plusieurs appareils.

## Contact
*[nom · email · site · réseaux]*

> Rejoignez la révolution : l'IA rendue au peuple.
