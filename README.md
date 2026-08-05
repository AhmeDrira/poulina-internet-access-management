# Gestion des demandes d'accès — Groupe Holding Poulina

Application web interne de **digitalisation et de sécurisation des demandes d'accès** des employés
(anciens formulaires papier de la DSI), développée dans le cadre d'un stage d'été au département
informatique du Groupe Holding Poulina.

**6 formulaires numérisés :**

1. Demande d'accès Internet
2. Demande d'accès à distance (VPN, télémaintenance)
3. Engagement pour déverrouillage d'un lecteur externe (USB, disque...)
4. Demande d'accès à un partage réseau
5. Demande d'accès Internet via clé 3G
6. Fiche d'engagement du mot de passe

> Workflow : **Employé** (choisit le formulaire et le remplit) → **Chef de département** (accepte / refuse / demande des modifications) → **Équipe réseau et sécurité** (2ᵉ vérification technique : exécute, refuse techniquement ou clôture), avec notifications, historique complet, **export PDF du formulaire rempli**, journal d'audit, aide à la décision et statistiques.
>
> Trois briques transverses complètent le dispositif : un **super administrateur** qui supervise l'application (administrateurs, **formulaires modifiables en base**, référentiels), une **messagerie interne** réservée au chef de département et à l'équipe réseau pour le traitement des demandes, et une **création de compte par invitation** (lien temporaire à usage unique, mot de passe défini par l'employé lui-même).

---

## Sommaire

1. [Stack technique](#stack-technique)
2. [Architecture du monorepo](#architecture-du-monorepo)
3. [Prérequis](#prérequis)
4. [Installation et lancement](#installation-et-lancement)
5. [Comptes de démonstration](#comptes-de-démonstration)
6. [Fonctionnalités](#fonctionnalités)
7. [Workflow et statuts d'une demande](#workflow-et-statuts-dune-demande)
8. [Gestion des formulaires](#gestion-des-formulaires)
9. [Messagerie interne de traitement](#messagerie-interne-de-traitement)
10. [Cycle de vie d'un compte](#cycle-de-vie-dun-compte)
11. [Modèle de données](#modèle-de-données)
12. [API REST](#api-rest)
13. [Sécurité](#sécurité)
14. [Module d'aide à la décision](#module-daide-à-la-décision)
15. [Évolutions prévues](#évolutions-prévues)

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18 + TypeScript (Vite), React Router, Axios, lucide-react, Recharts |
| Backend | NestJS 11 + TypeScript, Passport JWT, class-validator (DTO), Swagger |
| Base de données | MongoDB + Mongoose (références `ObjectId` entre collections) |
| Sécurité | JWT, RBAC (guards par rôle), bcrypt (hash des mots de passe), helmet, rate-limiting sur le login |
| Tâches planifiées | @nestjs/schedule (expiration automatique des accès + rappels) |

## Architecture du monorepo

```
internet-access-management/
├── backend/                  # API NestJS (port 3000)
│   └── src/
│       ├── auth/             # Login JWT, stratégie Passport, changement de mot de passe
│       ├── users/            # CRUD utilisateurs, activation/désactivation, rôles
│       ├── departments/      # CRUD départements (avec chef responsable)
│       ├── services/         # CRUD services (rattachés à un département)
│       ├── access-requests/  # Workflow des demandes + historique + cron d'expiration
│       ├── form-definitions/ # Formulaires stockés en base, gérés par le super admin
│       ├── messaging/        # Messagerie interne chef de département ↔ équipe réseau
│       ├── notifications/    # Notifications internes (architecture prête pour Nodemailer)
│       ├── audit-logs/       # Journal de sécurité et de traçabilité
│       ├── statistics/       # Indicateurs et agrégations MongoDB
│       ├── decision-helper/  # Score de recommandation par règles
│       ├── seed/             # Données de démonstration
│       └── common/           # Enums, guards, décorateurs, filtres, DTO partagés
├── frontend/                 # SPA React (port 5173)
│   └── src/
│       ├── api/              # Client Axios + appels typés par ressource
│       ├── components/       # Composants réutilisables (UI, timeline, modales métier)
│       ├── hooks/            # useApi, useDebounce
│       ├── layouts/          # Sidebar (menu par rôle), Navbar, gabarit principal
│       ├── pages/            # Login, dashboards par rôle, formulaires, admin...
│       ├── routes/           # Routes protégées (auth + rôle)
│       ├── store/            # AuthContext (session JWT), ToastContext, FormDefinitionsContext
│       ├── types/            # Types/enums miroir du backend
│       └── utils/            # Labels FR, formatage de dates, politique de mot de passe
├── docker-compose.yml        # MongoDB optionnel via Docker
└── README.md
```

## Prérequis

- **Node.js ≥ 20** et npm
- **MongoDB ≥ 6** en local (`mongodb://127.0.0.1:27017`) — ou via Docker : `docker compose up -d`

## Installation et lancement

```bash
# 1. Backend
cd backend
npm install
copy .env.example .env        # (Linux/Mac : cp .env.example .env) puis ajuster si besoin
npm run seed                  # injecte les données de démonstration
npm run start:dev             # API sur http://localhost:3000/api

# 2. Frontend (dans un second terminal)
cd frontend
npm install
npm run dev                   # interface sur http://localhost:5173
```

- **Swagger** (documentation interactive de l'API) : http://localhost:3000/api/docs
- Le frontend proxifie `/api` vers le backend (configurable via `frontend/.env`).

## Comptes de démonstration

Créés par `npm run seed` :

| Rôle | Email | Mot de passe |
|---|---|---|
| **Super administrateur** | `superadmin@poulina.tn` | `Super@2026` |
| Administrateur | `admin@poulina.tn` | `Admin@2026` |
| Chef de département (IT) | `manager.it@poulina.tn` | `Manager@2026` |
| Chef de département (Marketing) | `manager.mkt@poulina.tn` | `Manager@2026` |
| Employé (IT) | `employee@poulina.tn` | `Employee@2026` |
| Employé (Marketing) | `malek.rahmouni@poulina.tn` | `Employee@2026` |
| Équipe réseau et serveur | `network@poulina.tn` | `Network@2026` |
| Responsable sécurité | `security@poulina.tn` | `Security@2026` |

Le seed crée aussi un **compte en attente d'activation** (`nour.belhadj@poulina.tn`, sans mot de passe)
pour dérouler le scénario d'arrivée d'un nouvel employé.

**Scénario de démonstration conseillé** :
1. Connexion `employee@poulina.tn` → *Nouvelle demande* → soumettre.
2. Connexion `manager.it@poulina.tn` → examiner la demande (score d'aide à la décision) → accepter ou refuser.
3. Connexion `network@poulina.tn` → prendre en charge → activer l'accès (dates + commentaire technique).
4. Retour employé → suivi du statut, notifications, historique complet de la demande.
5. Connexion `admin@poulina.tn` → statistiques, gestion des référentiels, journal d'audit.

**Scénarios des fonctions transverses** :

6. **Formulaires** — `superadmin@poulina.tn` → *Supervision → Formulaires* → sélectionner un
   formulaire, ajouter ou réordonner un champ, enregistrer ; se reconnecter en employé : le
   formulaire de saisie reflète immédiatement la modification.
7. **Messagerie** — `manager.mkt@poulina.tn` → *Messagerie interne* → fil de `REQ-NET-2026-0005`
   avec l'équipe réseau ; répondre depuis `network@poulina.tn`. Un employé ou le responsable
   sécurité qui tente d'y accéder obtient un refus.
8. **Nouveau compte** — `admin@poulina.tn` → *Utilisateurs* → « Nouvel utilisateur » (aucun mot de
   passe demandé) → copier le lien d'activation affiché → l'ouvrir dans une fenêtre déconnectée →
   définir le mot de passe → se connecter. Le lien rejoué ne fonctionne plus.

## Fonctionnalités

### Par rôle

| Rôle | Capacités |
|---|---|
| **EMPLOYEE** | Choisir l'un des 6 formulaires, le remplir, suivre ses demandes, corriger et re-soumettre si le chef demande des modifications, exporter le PDF, notifications, historique |
| **MANAGER** | Voir les demandes de son département, accepter / refuser avec motif / **demander des modifications**, score d'aide à la décision, statistiques du département |
| **NETWORK_TEAM** | File des demandes acceptées (2ᵉ vérification), prise en charge, exécution selon le type (activation, configuration, autorisation temporaire, attribution, enregistrement), **refus technique motivé**, clôture |
| **ADMIN** | Gestion des utilisateurs non privilégiés (création par invitation, liens d'accès, activation/désactivation), départements et services, toutes les demandes, statistiques globales, journal d'audit |
| **SECURITY_OFFICER** | Consultation de toutes les demandes, statistiques et journal d'audit |
| **SUPER_ADMIN** | Supervision de l'application : **gestion des administrateurs**, **gestion des 6 formulaires** (champs, options, ordre, disponibilité), référentiels, tous les comptes, vue globale des demandes, statistiques et audit. Ne valide ni ne traite aucune demande (séparation des tâches) |

### Transverses

- **Notifications internes** à chaque étape (création → chef ; décision → employé + équipe réseau ; activation/clôture/expiration → employé), avec compteur temps réel dans la barre de navigation.
- **Historique (timeline)** de chaque demande : qui a fait quoi, quand, avec quel commentaire.
- **Journal d'audit** : connexions (réussies et échouées), créations/décisions/traitements, modifications d'utilisateurs et de rôles — avec adresse IP et user-agent.
- **Expiration automatique** : une tâche planifiée fait passer les accès arrivés à échéance au statut `EXPIRED` et envoie un rappel 7 jours avant.
- **Statistiques** : volumes par statut et par département, évolution mensuelle, taux d'acceptation, délais moyens de validation et de traitement.
- **Formulaires modifiables sans redéploiement** : les 6 formulaires vivent en base et sont édités par le super administrateur (voir [Gestion des formulaires](#gestion-des-formulaires)).
- **Messagerie interne** cloisonnée entre le chef de département et l'équipe réseau (voir [Messagerie interne de traitement](#messagerie-interne-de-traitement)).
- **Comptes créés par invitation** : lien temporaire à usage unique, mot de passe défini par l'employé (voir [Cycle de vie d'un compte](#cycle-de-vie-dun-compte)).

## Workflow et statuts d'une demande

```
                         ┌───────────────┐
   Employé soumet ─────→ │PENDING_MANAGER│ ←──── re-soumission (après correction)
                         └──────┬────────┘                       │
        ┌───────────────────────┼────────────────────┐           │
  refus ▼          modifications▼          acceptation▼           │
   ┌────────┐      ┌─────────────────┐   ┌───────────────────┐   │
   │REJECTED│      │CHANGES_REQUESTED│──→│APPROVED_BY_MANAGER│   │
   └────────┘      └─────────────────┘   └─────────┬─────────┘   │
                     (l'employé corrige ────────────│─────────────┘
                      et re-soumet)                 ▼ prise en charge
                                         ┌────────────────────┐
                                         │IN_PROGRESS_NETWORK │ (2e vérification technique)
                                         └─────────┬──────────┘
                        refus technique ┌──────────┴─────────┐ exécution
                                        ▼                    ▼
                              ┌───────────────────┐    ┌──────────┐
                              │REJECTED_TECHNICAL │    │ACTIVATED │─── cron ──→ EXPIRED
                              └───────────────────┘    └────┬─────┘               │
                                                            └── clôture ─→ CLOSED ┘
```

> `PENDING_NETWORK` est conservé dans l'énumération comme synonyme fonctionnel de la file d'attente réseau.
> Selon le formulaire, `ACTIVATED` signifie : accès Internet activé, accès distant configuré, lecteur
> externe autorisé temporairement, partage accordé, clé 3G attribuée ou fiche d'engagement enregistrée.

## Gestion des formulaires

Les 6 formulaires ne sont **pas codés en dur** : ils sont stockés dans la collection
`formdefinitions` et administrés par le **super administrateur** depuis *Supervision →
Formulaires*, sans redéploiement ni intervention sur la base.

Pour chaque formulaire :

| Élément | Modifiable |
|---|---|
| Intitulé complet, libellé court, présentation, consignes | oui |
| Champs spécifiques : ajout, suppression, **réordonnancement** | oui |
| Par champ : clé technique, libellé, type, obligation, aide, exemple, longueur / bornes | oui |
| Valeurs autorisées des listes de choix | oui |
| Blocs communs demandés : type d'accès Internet, durée, justification libre | oui |
| Disponibilité : retirer du catalogue / remettre à disposition | oui |
| Réinitialisation à la définition d'origine | oui |

**Types de champs disponibles** : texte court, texte long, nombre (avec bornes), date,
liste de choix, engagement à cocher (toujours obligatoire — un engagement optionnel n'aurait
aucune valeur).

**Garanties de cohérence :**

- La validation serveur du contenu d'une demande (`formData`) découle **toujours** de la
  définition en base : liste blanche des clés, valeurs de listes autorisées, bornes,
  engagements cochés. Le frontend rend le même formulaire à partir de la même source.
- Un formulaire **retiré du catalogue** disparaît du choix proposé aux employés ; les demandes
  déjà déposées poursuivent normalement leur traitement.
- Les clés déjà utilisées sont signalées avec leur **nombre de demandes** avant modification.
- Un champ supprimé n'efface rien : les valeurs des demandes antérieures restent visibles dans
  le détail et le PDF, signalées comme « champ retiré du formulaire ».
- Une définition est **versionnée** (numéro + auteur + date), et chaque modification est
  inscrite au journal d'audit avec la liste des champs ajoutés et retirés.
- Les définitions livrées (`form-definitions.defaults.ts`) servent d'amorçage au démarrage et
  de cible de réinitialisation : l'application fonctionne sur une base vierge.

> Les champs actuels restent des hypothèses raisonnables : dès réception des formulaires papier
> exacts, ils s'ajustent depuis cette interface, sans toucher au code.

## Messagerie interne de traitement

Espace d'échange **strictement réservé au chef du département concerné et à l'équipe réseau**,
pour traiter les demandes validées (précision technique, contrainte, confirmation d'exécution).

- **Un fil par demande**, créé à la volée au premier message, rattaché à la référence : les
  échanges restent liés au traitement et ne dérivent pas en discussion générale.
- **Ouverture à partir de la validation du chef** (`APPROVED_BY_MANAGER` et au-delà) — le moment
  où les deux acteurs collaborent réellement.
- **Cloisonnement** : un chef ne voit que les demandes de son département ; personne ne peut
  échanger sur sa propre demande (séparation des tâches) ; employés, administrateurs, super
  administrateur et responsable sécurité reçoivent un `403`.
- **Suivi** : état *En cours* / *Traité* (un nouveau message rouvre automatiquement un échange
  clos), compteur de messages non lus dans le menu, filtres par état, type et référence.
- **Notification** du correspondant à chaque message (chef ↔ tous les membres actifs de l'équipe
  réseau), et accès contextuel depuis la page de détail d'une demande.
- **Traçabilité sans indiscrétion** : le journal d'audit enregistre l'existence des échanges
  (`MESSAGE_SENT`, `THREAD_RESOLVED`), jamais leur contenu.

## Cycle de vie d'un compte

Un employé ne crée jamais son compte. Le scénario d'arrivée est le suivant :

1. **Création par une personne habilitée** (administrateur ou super administrateur) : identité,
   matricule, email, rôle, département, service. **Aucun mot de passe n'est saisi.**
2. L'application génère un **lien d'accès temporaire** affiché une seule fois à son créateur
   (et transmis au point d'extension email) : seule l'**empreinte SHA-256** du jeton est stockée.
3. Tant que le lien n'est pas utilisé, la **connexion est impossible** et le compte apparaît
   « En attente d'activation ».
4. L'employé ouvre le lien (page publique `/activation/:token`), **choisit son mot de passe**
   (8 caractères minimum, au moins une lettre et un chiffre, avec confirmation).
5. Le lien devient **immédiatement inutilisable** — usage unique — et il expire de toute façon
   après `ACTIVATION_TOKEN_TTL_HOURS` (48 h par défaut).
6. Le compte est activé : l'employé se connecte et accède normalement à l'application.

**Réinitialisation** : sur un compte déjà activé, la même action génère un nouveau lien *et*
impose le changement de mot de passe. Un guard global (`PasswordChangeGuard`) bloque alors toute
l'API — hors profil et changement de mot de passe — et l'interface redirige vers le formulaire
jusqu'à ce qu'un nouveau mot de passe soit enregistré. Le mot de passe actuel reste valable pour
se connecter : aucun risque de blocage définitif.

## Modèle de données

Collections MongoDB (références par `ObjectId`) :

- **User** — identité, matricule, email, mot de passe haché (`null` avant activation), rôle, département, service, poste, actif/inactif, **cycle de vie du compte** (empreinte du lien d'activation, échéance, date d'activation, créateur du compte, changement de mot de passe imposé).
- **Department** — nom, code, description, **chef responsable** (réf. User).
- **Service** — nom, description, département de rattachement.
- **AccessRequest** — **type de formulaire** (`requestType`, référence préfixée : `REQ-NET-…`, `REQ-DIS-…`, `REQ-USB-…`, `REQ-PRT-…`, `REQ-3G-…`, `REQ-ENG-…`), demandeur (réf.) + *snapshot* de son identité, durée, justification, **champs spécifiques du formulaire** (`formData`, validés par liste blanche), statut, décision du chef (par/quand/commentaire/motif), traitement réseau (par/quand/activation/expiration/commentaire), **score d'aide à la décision** embarqué.
- **RequestHistory** — timeline de chaque transition (action, statuts, acteur, commentaire).
- **Notification** — destinataire, type, titre, message, demande liée, lu/non lu.
- **AuditLog** — utilisateur, action, IP, user-agent, détails, horodatage.
- **FormDefinition** — un document par formulaire : intitulés, consignes, disponibilité, blocs demandés (type d'accès / durée / justification), **liste ordonnée des champs** (clé, libellé, type, obligation, bornes, options), version et auteur de la dernière modification.
- **RequestThread** — fil de discussion d'une demande (référence, département, état ouvert/traité, dernier message, compteur).
- **RequestMessage** — message d'un fil (auteur, rôle, contenu, destinataires ayant lu).

## API REST

Préfixe `/api` — documentation complète sur **`/api/docs`** (Swagger, auth Bearer intégrée).

| Ressource | Endpoints principaux |
|---|---|
| Auth | `POST /auth/login`, `GET /auth/me`, `POST /auth/change-password`, **`GET/POST /auth/activation/:token`** (public — vérification puis définition du mot de passe) |
| Utilisateurs (ADMIN / SUPER_ADMIN) | `GET/POST /users`, `GET/PATCH/DELETE /users/:id`, `PATCH /users/:id/activate|deactivate`, **`POST /users/:id/activation-link`** (nouveau lien d'accès ou réinitialisation), `GET /users/summary` (SUPER_ADMIN) |
| **Formulaires** | `GET /form-definitions` (tous rôles), `GET /form-definitions/:type` · SUPER_ADMIN : `PATCH /form-definitions/:type`, `PATCH /form-definitions/:type/activate|deactivate`, `POST /form-definitions/:type/reset`, `GET /form-definitions/:type/usage` |
| **Messagerie** (MANAGER / NETWORK_TEAM) | `GET /messaging/threads`, `GET /messaging/unread-count`, `GET /messaging/unread-threads`, `GET /messaging/requests/:requestId`, `POST /messaging/requests/:requestId/messages`, `PATCH /messaging/threads/:id/resolve|reopen` |
| Départements | `GET /departments`, `POST/PATCH/DELETE` (ADMIN / SUPER_ADMIN) |
| Services | `GET /services?department=`, `POST/PATCH/DELETE` (ADMIN / SUPER_ADMIN) |
| Demandes | `POST /access-requests` (6 types), `GET /access-requests/my`, `GET /access-requests` (selon rôle, filtres type/statut), `GET /access-requests/:id`, `GET /access-requests/:id/history`, **`GET /access-requests/:id/pdf`** (export du formulaire rempli) |
| Workflow | `PATCH /access-requests/:id/approve|reject|request-changes` (MANAGER), `PATCH /access-requests/:id/resubmit` (auteur, après demande de modification), `PATCH /access-requests/:id/start-processing|process|close` (NETWORK_TEAM — `process` avec `accessActivated=false` = refus technique motivé) |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` |
| Audit (ADMIN / SUPER_ADMIN / SÉCU) | `GET /audit-logs` (filtres action, utilisateur, dates) |
| Statistiques | `GET /statistics/overview`, `GET /statistics/by-department`, `GET /statistics/by-type`, `GET /statistics/monthly` |

## Sécurité

- **Authentification JWT** (expiration configurable) — toutes les routes sont protégées par défaut (guard global) ; seuls le login et l'activation de compte sont publics.
- **RBAC** : décorateur `@Roles()` + guard global ; contrôles fins côté service (un chef ne voit que son département, un employé que ses demandes...).
- **Mots de passe hachés** avec bcrypt (10 rounds), jamais renvoyés par l'API (`select: false`). Politique commune : 8 caractères minimum, au moins une lettre et un chiffre.
- **Aucun mot de passe défini par un tiers** : les comptes sont créés sans mot de passe et activés par leur titulaire via un **lien à usage unique** dont seule l'empreinte SHA-256 est stockée, avec expiration (48 h par défaut).
- **Changement de mot de passe imposable** : un guard global (`PasswordChangeGuard`) verrouille toute l'API — hors profil et changement de mot de passe — tant que l'utilisateur n'a pas défini un nouveau mot de passe.
- **Anti-escalade de privilèges** : seul le super administrateur crée, modifie ou supprime un compte administrateur ; personne ne modifie son propre rôle ; l'application conserve toujours au moins un super administrateur actif.
- **Suppression de compte protégée** : refusée si le compte est référencé (demandes, décisions, traitements, historique, messagerie, responsabilité de département) — la désactivation préserve la traçabilité.
- **Validation stricte** des entrées : DTO + class-validator (whitelist, rejet des champs inconnus) côté backend, validation des formulaires côté frontend.
- **Rate-limiting** sur `/auth/login` (5 tentatives/minute) et sur les routes d'activation (10/minute) + en-têtes sécurisés via helmet.
- **Traçabilité** : journal d'audit avec IP/user-agent pour chaque action sensible — connexions (y compris échouées), exports PDF, invitations et activations (y compris les liens invalides), modifications de formulaires, existence des échanges internes.
- L'identité portée par une demande (nom, matricule, département) provient **toujours du profil serveur**, jamais du client.
- **Séparation des tâches** : personne ne peut valider ni traiter techniquement sa propre demande, ni échanger à son sujet dans la messagerie interne. Le super administrateur supervise mais n'intervient pas dans le circuit de validation.
- **Champs spécifiques par formulaire validés côté serveur** d'après la définition en base (liste blanche des clés, valeurs autorisées, bornes, engagements obligatoires) — voir `backend/src/form-definitions/`.
- **Messagerie cloisonnée** : accessible au seul chef du département concerné et à l'équipe réseau, à partir de la validation de la demande ; le contenu des messages n'est jamais journalisé.
- **Échappement des saisies** utilisées dans les filtres de recherche MongoDB (anti-injection regex).

## Module d'aide à la décision

Service de **scoring par règles** (0 à 100) calculé à la création de chaque demande et affiché au chef de département. Il ne décide jamais à la place du chef.

| Règle | Effet |
|---|---|
| Justification absente / < 20 caractères | −30 / −25 |
| Justification détaillée (≥ 100 caractères) | +10 |
| Type d'accès complet (FULL) | −20 (demande sensible) |
| Accès restreint | +10 |
| Durée permanente | −15 |
| Durée > 6 mois / ≤ 30 jours | −10 / +10 |
| Département à fort besoin métier (IT, réseau, marketing...) — accès Internet/3G | +15 / +10 |
| Lecteur externe demandé depuis un département à données sensibles (contrôle de gestion, finance, RH, paie...) | −20 |
| Déverrouillage permanent d'un lecteur externe | −15 |
| Accès à distance permanent / méthode non standard | −10 |
| Partage réseau en écriture / en lecture seule | −10 / +10 |
| Fiche d'engagement (conformité) | +25 |
| Engagement signé par le demandeur | +10 |
| Demandes précédentes refusées | −10 |

Recommandations : **≥ 65** « Demande probablement légitime » · **40–64** « Demande à vérifier » · **< 40** « Demande risquée ou insuffisamment justifiée ».

## Évolutions prévues

- **Envoi d'emails** : deux points d'extension uniques sont prêts à recevoir un transport
  **Nodemailer** (SMTP interne) — `NotificationsService.dispatchEmail` pour les notifications de
  workflow et `NotificationsService.dispatchAccountInvitation` pour les liens d'activation. En
  attendant, le lien est affiché à la personne habilitée qui crée le compte et journalisé côté serveur.
- Intégration **Active Directory** pour l'authentification.
- Automatisation réseau (application des règles firewall) après validation.

---

*Projet de stage d'été — Groupe Holding Poulina, Département Informatique.*
*Réalisé par Malek Rahmouni & Ahmed Amine Drira — Encadré par M. Mourad Jeribi.*
