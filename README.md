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

---

## Sommaire

1. [Stack technique](#stack-technique)
2. [Architecture du monorepo](#architecture-du-monorepo)
3. [Prérequis](#prérequis)
4. [Installation et lancement](#installation-et-lancement)
5. [Comptes de démonstration](#comptes-de-démonstration)
6. [Fonctionnalités](#fonctionnalités)
7. [Workflow et statuts d'une demande](#workflow-et-statuts-dune-demande)
8. [Modèle de données](#modèle-de-données)
9. [API REST](#api-rest)
10. [Sécurité](#sécurité)
11. [Module d'aide à la décision](#module-daide-à-la-décision)
12. [Évolutions prévues](#évolutions-prévues)

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
│       ├── store/            # AuthContext (session JWT), ToastContext
│       ├── types/            # Types/enums miroir du backend
│       └── utils/            # Labels FR, formatage de dates
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
| Administrateur | `admin@poulina.tn` | `Admin@2026` |
| Chef de département (IT) | `manager.it@poulina.tn` | `Manager@2026` |
| Chef de département (Marketing) | `manager.mkt@poulina.tn` | `Manager@2026` |
| Employé (IT) | `employee@poulina.tn` | `Employee@2026` |
| Employé (Marketing) | `malek.rahmouni@poulina.tn` | `Employee@2026` |
| Équipe réseau et serveur | `network@poulina.tn` | `Network@2026` |
| Responsable sécurité | `security@poulina.tn` | `Security@2026` |

**Scénario de démonstration conseillé** :
1. Connexion `employee@poulina.tn` → *Nouvelle demande* → soumettre.
2. Connexion `manager.it@poulina.tn` → examiner la demande (score d'aide à la décision) → accepter ou refuser.
3. Connexion `network@poulina.tn` → prendre en charge → activer l'accès (dates + commentaire technique).
4. Retour employé → suivi du statut, notifications, historique complet de la demande.
5. Connexion `admin@poulina.tn` → statistiques, gestion des référentiels, journal d'audit.

## Fonctionnalités

### Par rôle

| Rôle | Capacités |
|---|---|
| **EMPLOYEE** | Choisir l'un des 6 formulaires, le remplir, suivre ses demandes, corriger et re-soumettre si le chef demande des modifications, exporter le PDF, notifications, historique |
| **MANAGER** | Voir les demandes de son département, accepter / refuser avec motif / **demander des modifications**, score d'aide à la décision, statistiques du département |
| **NETWORK_TEAM** | File des demandes acceptées (2ᵉ vérification), prise en charge, exécution selon le type (activation, configuration, autorisation temporaire, attribution, enregistrement), **refus technique motivé**, clôture |
| **ADMIN** | Gestion utilisateurs/départements/services, toutes les demandes, statistiques globales, journal d'audit |
| **SECURITY_OFFICER** | Consultation de toutes les demandes, statistiques et journal d'audit |

### Transverses

- **Notifications internes** à chaque étape (création → chef ; décision → employé + équipe réseau ; activation/clôture/expiration → employé), avec compteur temps réel dans la barre de navigation.
- **Historique (timeline)** de chaque demande : qui a fait quoi, quand, avec quel commentaire.
- **Journal d'audit** : connexions (réussies et échouées), créations/décisions/traitements, modifications d'utilisateurs et de rôles — avec adresse IP et user-agent.
- **Expiration automatique** : une tâche planifiée fait passer les accès arrivés à échéance au statut `EXPIRED` et envoie un rappel 7 jours avant.
- **Statistiques** : volumes par statut et par département, évolution mensuelle, taux d'acceptation, délais moyens de validation et de traitement.

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

## Modèle de données

Collections MongoDB (références par `ObjectId`) :

- **User** — identité, matricule, email, mot de passe haché, rôle, département, service, poste, actif/inactif.
- **Department** — nom, code, description, **chef responsable** (réf. User).
- **Service** — nom, description, département de rattachement.
- **AccessRequest** — **type de formulaire** (`requestType`, référence préfixée : `REQ-NET-…`, `REQ-DIS-…`, `REQ-USB-…`, `REQ-PRT-…`, `REQ-3G-…`, `REQ-ENG-…`), demandeur (réf.) + *snapshot* de son identité, durée, justification, **champs spécifiques du formulaire** (`formData`, validés par liste blanche), statut, décision du chef (par/quand/commentaire/motif), traitement réseau (par/quand/activation/expiration/commentaire), **score d'aide à la décision** embarqué.
- **RequestHistory** — timeline de chaque transition (action, statuts, acteur, commentaire).
- **Notification** — destinataire, type, titre, message, demande liée, lu/non lu.
- **AuditLog** — utilisateur, action, IP, user-agent, détails, horodatage.

## API REST

Préfixe `/api` — documentation complète sur **`/api/docs`** (Swagger, auth Bearer intégrée).

| Ressource | Endpoints principaux |
|---|---|
| Auth | `POST /auth/login`, `GET /auth/me`, `POST /auth/change-password` |
| Utilisateurs (ADMIN) | `GET/POST /users`, `GET/PATCH/DELETE /users/:id`, `PATCH /users/:id/activate|deactivate` |
| Départements | `GET /departments`, `POST/PATCH/DELETE` (ADMIN) |
| Services | `GET /services?department=`, `POST/PATCH/DELETE` (ADMIN) |
| Demandes | `POST /access-requests` (6 types), `GET /access-requests/my`, `GET /access-requests` (selon rôle, filtres type/statut), `GET /access-requests/:id`, `GET /access-requests/:id/history`, **`GET /access-requests/:id/pdf`** (export du formulaire rempli) |
| Workflow | `PATCH /access-requests/:id/approve|reject|request-changes` (MANAGER), `PATCH /access-requests/:id/resubmit` (auteur, après demande de modification), `PATCH /access-requests/:id/start-processing|process|close` (NETWORK_TEAM — `process` avec `accessActivated=false` = refus technique motivé) |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` |
| Audit (ADMIN/SÉCU) | `GET /audit-logs` (filtres action, utilisateur, dates) |
| Statistiques | `GET /statistics/overview`, `GET /statistics/by-department`, `GET /statistics/by-type`, `GET /statistics/monthly` |

## Sécurité

- **Authentification JWT** (expiration configurable) — toutes les routes sont protégées par défaut (guard global), seul le login est public.
- **RBAC** : décorateur `@Roles()` + guard global ; contrôles fins côté service (un chef ne voit que son département, un employé que ses demandes...).
- **Mots de passe hachés** avec bcrypt (10 rounds), jamais renvoyés par l'API (`select: false`).
- **Validation stricte** des entrées : DTO + class-validator (whitelist, rejet des champs inconnus) côté backend, validation des formulaires côté frontend.
- **Rate-limiting** sur `/auth/login` (5 tentatives/minute) + en-têtes sécurisés via helmet.
- **Traçabilité** : journal d'audit avec IP/user-agent pour chaque action sensible, y compris les échecs de connexion et les exports PDF.
- L'identité portée par une demande (nom, matricule, département) provient **toujours du profil serveur**, jamais du client.
- **Séparation des tâches** : personne ne peut valider ni traiter techniquement sa propre demande.
- **Champs spécifiques par formulaire validés côté serveur** (liste blanche des clés, valeurs autorisées, engagements obligatoires) — voir `backend/src/access-requests/form-definitions.ts`.
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

- **Envoi d'emails** : l'architecture des notifications repose sur un point d'extension unique (`NotificationsService.dispatchEmail`) prêt à recevoir un transport **Nodemailer** (SMTP interne).
- Intégration **Active Directory** pour l'authentification.
- Automatisation réseau (application des règles firewall) après validation.

---

*Projet de stage d'été — Groupe Holding Poulina, Département Informatique.*
*Réalisé par Malek Rahmouni & Ahmed Amine Drira — Encadré par M. Mourad Jeribi.*
