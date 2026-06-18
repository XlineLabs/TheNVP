# NVP — FAQ (vente, presse, support)

Réponses prêtes à l'emploi. Ton : clair, honnête, enthousiaste.

## Général

**C'est quoi NVP ?**
Un réseau d'inférence IA distribué : des téléphones exécutent des modèles d'IA en
local et leurs propriétaires sont payés. Les utilisateurs accèdent à un chatbot et
à une API compatible OpenAI dont les réponses sont calculées par de vrais
téléphones.

**En quoi est-ce une révolution ?**
L'IA cesse d'être l'apanage des datacenters. La puissance est déjà dans nos
poches ; NVP la met en réseau et **redistribue la valeur** aux propriétaires
d'appareils. C'est une révolution d'accès et de propriété.

**C'est décentralisé / blockchain ?**
Pas encore. En v0, un **coordinateur central** orchestre le réseau (plus simple,
plus fiable). L'architecture est conçue pour se **décentraliser** progressivement
(marché/DHT, règlement on-chain) en v2.

## Pour les propriétaires de téléphones (workers)

**Comment je gagne de l'argent ?**
Tu installes l'app, tu actives « worker », ton iPhone répond à des jobs d'IA et tu
es crédité en USD à chaque réponse vérifiée.

**Combien je peux gagner ?**
Cela dépend du nombre de jobs traités et du prix par job. Les gains s'affichent en
temps réel dans l'app. *(Pas de promesse de revenu garanti.)*

**Ça marche quand l'app est fermée ?**
Non : iOS interdit le calcul lourd en arrière-plan prolongé. Le worker travaille
**app ouverte au premier plan**, idéalement **en charge** (ex. la nuit). On
l'assume clairement.

**Ça va abîmer / chauffer mon téléphone ?**
On surveille la température et on met en pause si l'appareil devient critique. On
recommande de travailler en charge.

**Je change de téléphone, je perds mes gains ?**
Non : une **clé de récupération** (fichier téléchargeable) permet de reconnecter
ton compte sur un autre appareil. Tu peux aussi lier ton appareil à ton compte
chatbot par email.

## Pour les utilisateurs du chatbot

**C'est payant ?**
En **bêta, c'est gratuit** : un crédit de démarrage est offert et ton solde ne
baisse pas. Les téléphones qui répondent sont, eux, payés (financé par la
plateforme pendant la bêta).

**La qualité vaut un grand modèle cloud ?**
On utilise des modèles **compacts** on-device (Gemma 3). La qualité est plus
modeste qu'un modèle géant, mais on compense avec la **recherche web** et un mode
**réflexion**. L'avantage : accès distribué, coût, et propriété par le peuple.

## Pour les développeurs

**Comment j'utilise l'API ?**
Crée une clé dans le dashboard, puis appelle `POST /v1/chat/completions` avec
`Authorization: Bearer sk-nvp-…`. C'est **compatible OpenAI** : change juste l'URL
de base dans ton app (OpenClaw, etc.).

**C'est déterministe ?**
Oui : décodage greedy (temperature ignorée). C'est requis pour la vérification
anti-triche.

## Confiance & sécurité

**Comment savez-vous que le téléphone calcule vraiment ?**
Des **jobs-canaris** à réponse connue sont glissés dans le flux ; une mauvaise
réponse est rejetée et fait chuter la réputation. Redondance et (en v1)
**App Attest** renforcent l'anti-fraude.

**Mes données / le contenu des chats ?**
Les requêtes transitent par le coordinateur et sont traitées par un appareil du
réseau. *(Détailler la politique de confidentialité avant lancement public.)*

## Business

**Comment vous gagnez de l'argent ?**
Marge entre le prix payé par le requester et la part reversée au worker
(take-rate réglable), abonnements API, et offres entreprise à terme.
