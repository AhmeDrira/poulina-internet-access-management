/**
 * Import de l'annuaire réel dans le portail des accès.
 *
 *   npm run import:users -- "../bd users.xlsx"
 *
 * Le script est **idempotent** : il rapproche les enregistrements par matricule,
 * met à jour l'existant et ne régénère jamais le mot de passe d'un compte déjà
 * importé (les identifiants déjà distribués restent valables). Il ne touche à
 * aucune donnée métier existante (demandes, historiques, messagerie).
 *
 * Règles appliquées (annuaire RH → portail) :
 *  - Matricule      : normalisé en 8 chiffres avec zéros de tête, clé d'identité.
 *  - Email          : absent de la source → généré `prenom.nom@poulina.local`,
 *                     marqué temporaire (SSO inopérant tant qu'il l'est).
 *  - Rôle           : chef si le matricule apparaît en Matricule_Responsable.
 *  - Approbateur    : le responsable direct (Matricule_Responsable).
 *  - Département    : Libelle_Unite (ni la filiale ni le coordinateur).
 */
import 'dotenv/config';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import { UserSchema } from '../users/schemas/user.schema';
import { DepartmentSchema } from '../departments/schemas/department.schema';
import { Role } from '../common/enums';

const MONGODB_URI =
  process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/poulina_internet_access';
const EMAIL_DOMAIN = process.env.IMPORT_EMAIL_DOMAIN ?? 'poulina.local';
const MATRICULE_LENGTH = 8;
const BCRYPT_ROUNDS = 10;

const UserModel = mongoose.model('User', UserSchema);
const DepartmentModel = mongoose.model('Department', DepartmentSchema);

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

/** Cellule Excel → texte propre (les nombres perdent leurs zéros de tête) */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'result' in (value as any)) {
    return String((value as any).result ?? '').trim();
  }
  if (typeof value === 'object' && 'text' in (value as any)) {
    return String((value as any).text ?? '').trim();
  }
  return String(value).trim();
}

/**
 * Matricule sur 8 chiffres. Excel stocke souvent ces identifiants comme des
 * nombres et supprime les zéros de tête : « 59967 » redevient « 00059967 ».
 */
function normalizeMatricule(value: ExcelJS.CellValue): string {
  const digits = cellText(value).replace(/\D/g, '');
  return digits ? digits.padStart(MATRICULE_LENGTH, '0') : '';
}

/** Retire les accents et réduit à un fragment utilisable dans une adresse email */
function emailSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/** Particules des noms composés (BEN MILED, BEL HAJ...) */
const NAME_PARTICLES = new Set([
  'BEN', 'BENT', 'BEL', 'EL', 'ABD', 'ABDEL', 'ABOU', 'BOU', 'OULD', 'HAJ', 'HADJ',
]);

/**
 * Découpe un libellé « PRÉNOM NOM » de l'annuaire.
 * Convention vérifiée sur les responsables présents aussi comme employés :
 * le prénom vient en premier, et une particule ouvre le nom composé.
 */
function splitFullName(label: string): { firstName: string; lastName: string } {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { firstName: '', lastName: '' };
  if (words.length === 1) return { firstName: words[0], lastName: words[0] };
  if (words.length === 2) return { firstName: words[0], lastName: words[1] };

  const particleIndex = words.findIndex(
    (word, index) => index >= 1 && NAME_PARTICLES.has(word.toUpperCase()),
  );
  if (particleIndex > 0) {
    return {
      firstName: words.slice(0, particleIndex).join(' '),
      lastName: words.slice(particleIndex).join(' '),
    };
  }
  // Sans particule : le dernier mot est le nom, le reste le prénom
  return {
    firstName: words.slice(0, -1).join(' '),
    lastName: words[words.length - 1],
  };
}

/** Code de département unique, dérivé du libellé de l'unité */
function departmentCode(name: string, taken: Set<string>): string {
  const words = emailSlug(name).split('-').filter(Boolean);
  const initials = words.map((w) => w[0]).join('').toUpperCase();
  const base = (initials.length >= 3 ? initials : emailSlug(name).replace(/-/g, '').toUpperCase())
    .slice(0, 8) || 'UNITE';
  let code = base;
  let suffix = 2;
  while (taken.has(code)) {
    code = `${base.slice(0, 7)}${suffix}`;
    suffix += 1;
  }
  taken.add(code);
  return code;
}

/**
 * Mot de passe temporaire lisible : 12 caractères sans glyphes ambigus
 * (ni O/0, ni I/l/1), avec au moins une lettre et un chiffre — conforme à la
 * politique de l'application.
 */
function temporaryPassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = letters + digits;
  const chars = [
    letters[randomInt(letters.length)],
    digits[randomInt(digits.length)],
  ];
  while (chars.length < 12) {
    chars.push(all[randomInt(all.length)]);
  }
  // Mélange de Fisher-Yates pour ne pas figer la position des deux premiers
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// ---------------------------------------------------------------------------
// Lecture du fichier
// ---------------------------------------------------------------------------

interface SourceRow {
  matricule: string;
  firstName: string;
  lastName: string;
  unit: string;
  managerMatricule: string;
  managerLabel: string;
}

async function readWorkbook(filePath: string): Promise<SourceRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Le classeur ne contient aucune feuille.');

  const headers: Record<string, number> = {};
  sheet.getRow(1).eachCell((cell, col) => {
    headers[cellText(cell.value)] = col;
  });

  const required = ['Matricule', 'Prenom', 'Nom', 'Matricule_Responsable', 'Libelle_Unite'];
  const missing = required.filter((name) => !headers[name]);
  if (missing.length > 0) {
    throw new Error(`Colonnes absentes du fichier : ${missing.join(', ')}`);
  }

  const rows: SourceRow[] = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const matricule = normalizeMatricule(row.getCell(headers['Matricule']).value);
    if (!matricule) return;
    rows.push({
      matricule,
      firstName: cellText(row.getCell(headers['Prenom']).value),
      lastName: cellText(row.getCell(headers['Nom']).value),
      unit: cellText(row.getCell(headers['Libelle_Unite']).value),
      managerMatricule: normalizeMatricule(row.getCell(headers['Matricule_Responsable']).value),
      managerLabel: headers['Nom_Prenom_Responsable']
        ? cellText(row.getCell(headers['Nom_Prenom_Responsable']).value)
        : '',
    });
  });
  return rows;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

interface PlannedUser {
  matricule: string;
  firstName: string;
  lastName: string;
  unit: string | null;
  managerMatricule: string | null;
  role: Role;
  /** true si l'identité provient des colonnes « Responsable » et non d'une ligne */
  fromManagerColumns: boolean;
  /** true si le découpage prénom/nom a dû être déduit d'un libellé */
  nameInferred: boolean;
}

async function run() {
  const fileArg = process.argv[2] ?? path.join(__dirname, '..', '..', '..', 'bd users.xlsx');
  const filePath = path.resolve(fileArg);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fichier introuvable : ${filePath}`);
  }

  console.log(`Lecture de ${filePath}...`);
  const rows = await readWorkbook(filePath);
  console.log(`  ${rows.length} lignes lues.`);

  // --- Plan d'import ------------------------------------------------------
  const managerMatricules = new Set(rows.map((r) => r.managerMatricule).filter(Boolean));
  const planned = new Map<string, PlannedUser>();

  for (const row of rows) {
    planned.set(row.matricule, {
      matricule: row.matricule,
      firstName: row.firstName,
      lastName: row.lastName,
      unit: row.unit || null,
      managerMatricule: row.managerMatricule || null,
      role: managerMatricules.has(row.matricule) ? Role.MANAGER : Role.EMPLOYEE,
      fromManagerColumns: false,
      nameInferred: false,
    });
  }

  // Responsables cités mais absents des lignes : sans eux, des employés
  // n'auraient aucun approbateur.
  const supervisedUnits = new Map<string, Set<string>>();
  const managerLabels = new Map<string, string>();
  for (const row of rows) {
    if (!row.managerMatricule) continue;
    managerLabels.set(row.managerMatricule, row.managerLabel);
    if (!supervisedUnits.has(row.managerMatricule)) {
      supervisedUnits.set(row.managerMatricule, new Set());
    }
    if (row.unit) supervisedUnits.get(row.managerMatricule)!.add(row.unit);
  }

  for (const matricule of managerMatricules) {
    if (planned.has(matricule)) continue;
    const label = managerLabels.get(matricule) ?? '';
    const { firstName, lastName } = splitFullName(label);
    const units = [...(supervisedUnits.get(matricule) ?? [])];
    planned.set(matricule, {
      matricule,
      firstName,
      lastName,
      // Unité déduite seulement si le responsable n'en encadre qu'une
      unit: units.length === 1 ? units[0] : null,
      managerMatricule: null,
      role: Role.MANAGER,
      fromManagerColumns: true,
      nameInferred: label.trim().split(/\s+/).length > 2,
    });
  }

  console.log(
    `  ${planned.size} comptes à importer ` +
      `(${rows.length} depuis les lignes, ${planned.size - rows.length} responsables reconstitués).`,
  );

  await mongoose.connect(MONGODB_URI);

  // --- Départements -------------------------------------------------------
  const unitNames = [...new Set(rows.map((r) => r.unit).filter(Boolean))].sort();
  const existingDepartments = await DepartmentModel.find().lean();
  const takenCodes = new Set<string>(existingDepartments.map((d: any) => d.code));
  const departmentIdByName = new Map<string, mongoose.Types.ObjectId>();
  for (const dep of existingDepartments as any[]) {
    departmentIdByName.set(dep.name, dep._id);
  }

  let departmentsCreated = 0;
  for (const name of unitNames) {
    if (departmentIdByName.has(name)) continue;
    const created = await DepartmentModel.create({
      name,
      code: departmentCode(name, takenCodes),
      description: `Unité importée depuis l'annuaire RH.`,
    });
    departmentIdByName.set(name, created._id as mongoose.Types.ObjectId);
    departmentsCreated += 1;
  }
  console.log(
    `Départements : ${departmentsCreated} créé(s), ${unitNames.length - departmentsCreated} déjà présent(s).`,
  );

  // --- Emails uniques -----------------------------------------------------
  const emailByMatricule = new Map<string, string>();
  const usedEmails = new Set<string>(
    (await UserModel.find().select('email matricule').lean()).map((u: any) => u.email),
  );
  const existingByMatricule = new Map<string, any>(
    (await UserModel.find().select('matricule email').lean()).map((u: any) => [u.matricule, u]),
  );

  for (const user of planned.values()) {
    const existing = existingByMatricule.get(user.matricule);
    if (existing) {
      // Compte déjà importé : on conserve son adresse (éventuellement corrigée depuis)
      emailByMatricule.set(user.matricule, existing.email);
      continue;
    }
    const base = `${emailSlug(user.firstName)}.${emailSlug(user.lastName)}`;
    let email = `${base}@${EMAIL_DOMAIN}`;
    if (usedEmails.has(email)) {
      // Homonymes : désambiguïsation par le matricule, qui est unique
      email = `${base}.${user.matricule}@${EMAIL_DOMAIN}`;
    }
    usedEmails.add(email);
    emailByMatricule.set(user.matricule, email);
  }

  // --- Comptes ------------------------------------------------------------
  const credentials: {
    matricule: string;
    nom: string;
    email: string;
    role: string;
    unite: string;
    motDePasse: string;
  }[] = [];
  const idByMatricule = new Map<string, mongoose.Types.ObjectId>();
  let created = 0;
  let updated = 0;

  for (const user of planned.values()) {
    const email = emailByMatricule.get(user.matricule)!;
    const departmentId = user.unit ? (departmentIdByName.get(user.unit) ?? null) : null;
    const existing = await UserModel.findOne({ matricule: user.matricule });

    if (existing) {
      existing.set({
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        department: departmentId,
      });
      await existing.save();
      idByMatricule.set(user.matricule, existing._id as mongoose.Types.ObjectId);
      updated += 1;
      continue;
    }

    const password = temporaryPassword();
    const doc = await UserModel.create({
      firstName: user.firstName,
      lastName: user.lastName,
      matricule: user.matricule,
      email,
      password: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role: user.role,
      department: departmentId,
      service: null,
      position: '',
      isActive: true,
      emailIsTemporary: true,
      // Le mot de passe est distribué en clair : son remplacement est imposé
      mustChangePassword: true,
      activatedAt: new Date(),
    });
    idByMatricule.set(user.matricule, doc._id as mongoose.Types.ObjectId);
    credentials.push({
      matricule: user.matricule,
      nom: `${user.firstName} ${user.lastName}`,
      email,
      role: user.role,
      unite: user.unit ?? '',
      motDePasse: password,
    });
    created += 1;
  }
  console.log(`Comptes : ${created} créé(s), ${updated} mis à jour.`);

  // --- Hiérarchie ---------------------------------------------------------
  let links = 0;
  for (const user of planned.values()) {
    if (!user.managerMatricule) continue;
    const managerId = idByMatricule.get(user.managerMatricule);
    const userId = idByMatricule.get(user.matricule);
    if (!managerId || !userId) continue;
    await UserModel.updateOne({ _id: userId }, { manager: managerId });
    links += 1;
  }
  console.log(`Hiérarchie : ${links} rattachement(s) responsable direct.`);

  // Chef du département : renseigné uniquement quand l'unité n'a qu'un responsable
  const unitManagers = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.unit || !row.managerMatricule) continue;
    if (!unitManagers.has(row.unit)) unitManagers.set(row.unit, new Set());
    unitManagers.get(row.unit)!.add(row.managerMatricule);
  }
  let departmentManagers = 0;
  const ambiguousUnits: string[] = [];
  for (const [unit, managers] of unitManagers) {
    const departmentId = departmentIdByName.get(unit);
    if (!departmentId) continue;
    if (managers.size === 1) {
      const managerId = idByMatricule.get([...managers][0]);
      if (managerId) {
        await DepartmentModel.updateOne({ _id: departmentId }, { manager: managerId });
        departmentManagers += 1;
      }
    } else {
      ambiguousUnits.push(unit);
    }
  }
  console.log(
    `Départements : ${departmentManagers} chef(s) désigné(s), ` +
      `${ambiguousUnits.length} unité(s) à plusieurs responsables laissée(s) sans chef unique.`,
  );

  // --- Sortie des identifiants -------------------------------------------
  const outputDir = path.resolve(__dirname, '..', '..', 'import-output');
  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  if (credentials.length > 0) {
    const csvPath = path.join(outputDir, `identifiants-${stamp}.csv`);
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      'Matricule;Nom;Email;Role;Unite;MotDePasseTemporaire',
      ...credentials.map((c) =>
        [c.matricule, c.nom, c.email, c.role, c.unite, c.motDePasse].map(escape).join(';'),
      ),
    ].join('\r\n');
    // BOM : Excel ouvre alors le fichier en UTF-8 sans déformer les accents
    fs.writeFileSync(csvPath, '﻿' + csv, 'utf8');
    console.log(`\nIdentifiants temporaires écrits dans :\n  ${csvPath}`);
    console.log('  (fichier sensible, non versionné — à transmettre puis détruire)');
  }

  // --- Points nécessitant une décision humaine ---------------------------
  const report: string[] = [];
  report.push(`Import du ${new Date().toLocaleString('fr-FR')}`);
  report.push(`Source : ${filePath}`);
  report.push(`Comptes créés : ${created} — mis à jour : ${updated}`);
  report.push('');

  const inferred = [...planned.values()].filter((u) => u.nameInferred);
  if (inferred.length > 0) {
    report.push(`## Prénom/nom déduits d'un libellé (${inferred.length}) — à vérifier`);
    report.push('Le fichier ne fournit que « PRÉNOM NOM » pour ces responsables.');
    for (const u of inferred) {
      report.push(
        `  ${u.matricule}  « ${managerLabels.get(u.matricule)} »  ->  prénom « ${u.firstName} » / nom « ${u.lastName} »  ->  ${emailByMatricule.get(u.matricule)}`,
      );
    }
    report.push('');
  }

  const withoutUnit = [...planned.values()].filter((u) => !u.unit);
  if (withoutUnit.length > 0) {
    report.push(`## Comptes sans département (${withoutUnit.length}) — à compléter`);
    report.push(
      'Responsables absents des lignes et encadrant plusieurs unités : leur propre',
      'unité de rattachement ne figure pas dans le fichier.',
    );
    for (const u of withoutUnit) {
      const units = [...(supervisedUnits.get(u.matricule) ?? [])];
      report.push(
        `  ${u.matricule}  ${u.firstName} ${u.lastName}  (encadre : ${units.join(', ') || 'aucune unité'})`,
      );
    }
    report.push('');
  }

  if (ambiguousUnits.length > 0) {
    report.push(`## Unités à plusieurs responsables (${ambiguousUnits.length})`);
    report.push(
      'Aucun « chef de département » unique n\'a été désigné pour ces unités.',
      'Sans conséquence sur le circuit : l\'approbation suit le responsable direct.',
    );
    for (const unit of ambiguousUnits.sort()) {
      const names = [...unitManagers.get(unit)!].map((m) => {
        const u = planned.get(m);
        return `${u?.firstName} ${u?.lastName} (${m})`;
      });
      report.push(`  ${unit} : ${names.join(' / ')}`);
    }
    report.push('');
  }

  report.push('## Rappel');
  report.push(
    'Toutes les adresses générées sont temporaires (@' + EMAIL_DOMAIN + ') :',
    "l'authentification unique ne peut pas fonctionner pour ces comptes tant que",
    "leur véritable adresse professionnelle n'a pas été renseignée.",
  );

  const reportPath = path.join(outputDir, `rapport-import-${stamp}.txt`);
  fs.writeFileSync(reportPath, report.join('\n'), 'utf8');
  console.log(`Rapport des points à trancher :\n  ${reportPath}`);

  // --- Récapitulatif ------------------------------------------------------
  const roles = await UserModel.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  console.log('\n=== Portail après import ===');
  console.table(roles.map((r: any) => ({ Role: r._id, Comptes: r.count })));
  console.log(`Départements : ${await DepartmentModel.countDocuments()}`);
  console.log(`Comptes à email temporaire : ${await UserModel.countDocuments({ emailIsTemporary: true })}`);
  console.log(`Comptes sans responsable direct : ${await UserModel.countDocuments({ manager: null })}`);
}

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Échec de l'import :", error);
    await mongoose.disconnect();
    process.exit(1);
  });
