import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessRequest, AccessRequestDocument } from '../access-requests/schemas/access-request.schema';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction, FormFieldKind, REQUEST_TYPE_LABELS, RequestType } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { UpdateFormDefinitionDto } from './dto/update-form-definition.dto';
import {
  DEFAULT_FORM_DEFINITIONS,
  DefaultFormDefinition,
  DefaultFormField,
  RESERVED_FIELD_KEYS,
} from './form-definitions.defaults';
import {
  FormDefinition,
  FormDefinitionDocument,
  FormFieldDefinition,
} from './schemas/form-definition.schema';

export interface FormDataValidationError {
  field: string;
  message: string;
}

interface ActionContext {
  actor?: AuthUser;
  ipAddress?: string;
  userAgent?: string;
}

/** Couple libellé / valeur lisible, utilisé par l'export PDF */
export interface LabelledFormEntry {
  label: string;
  value: string;
}

/** État d'un engagement à cocher du formulaire */
export interface FormCommitmentState {
  label: string;
  accepted: boolean;
}

/** Contenu rempli d'une demande, prêt à être restitué (PDF) */
export interface DescribedFormData {
  title: string;
  entries: LabelledFormEntry[];
  commitments: FormCommitmentState[];
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Gestion des formulaires numérisés.
 *
 * Les définitions vivent en base (modifiables par le super administrateur) avec
 * un cache mémoire, invalidé à chaque écriture. Les définitions par défaut
 * (`form-definitions.defaults.ts`) servent d'amorçage et de réinitialisation :
 * l'application reste donc fonctionnelle sur une base vierge.
 */
@Injectable()
export class FormDefinitionsService implements OnModuleInit {
  private readonly logger = new Logger(FormDefinitionsService.name);
  private cache: Map<RequestType, FormDefinitionDocument> | null = null;

  constructor(
    @InjectModel(FormDefinition.name)
    private readonly formModel: Model<FormDefinitionDocument>,
    @InjectModel(AccessRequest.name)
    private readonly requestModel: Model<AccessRequestDocument>,
    private readonly auditLogs: AuditLogsService,
  ) {}

  /** Crée au démarrage les définitions manquantes (base neuve ou nouveau type) */
  async onModuleInit(): Promise<void> {
    try {
      await this.ensureDefaults();
    } catch (error) {
      // Ne jamais empêcher le démarrage de l'API : les défauts servent de secours
      this.logger.error(`Initialisation des formulaires impossible : ${error}`);
    }
  }

  async ensureDefaults(): Promise<void> {
    const existing = await this.formModel.find().select('requestType').exec();
    const known = new Set(existing.map((definition) => definition.requestType));
    const missing = Object.values(RequestType).filter((type) => !known.has(type));
    if (missing.length > 0) {
      await this.formModel.insertMany(
        missing.map((type) => this.fromDefaults(DEFAULT_FORM_DEFINITIONS[type])),
      );
      this.logger.log(`Formulaires initialisés : ${missing.join(', ')}`);
    }
    const upgraded = await this.syncManagedDefaultFields();
    if (upgraded.length > 0) {
      this.logger.log(`Formulaires mis a jour : ${upgraded.join(', ')}`);
    }
    this.cache = null;
  }

  // ------------------------------------------------------------------
  // Lecture
  // ------------------------------------------------------------------

  /** Toutes les définitions (les formulaires désactivés sont réservés aux administrateurs) */
  async findAll(includeInactive = false): Promise<FormDefinitionDocument[]> {
    const definitions = [...(await this.load()).values()];
    const visible = includeInactive
      ? definitions
      : definitions.filter((definition) => definition.isActive);
    // Ordre stable : celui de l'énumération (ordre des formulaires papier)
    const order = Object.values(RequestType);
    return visible.sort(
      (a, b) => order.indexOf(a.requestType) - order.indexOf(b.requestType),
    );
  }

  async findByType(requestType: RequestType): Promise<FormDefinitionDocument> {
    const definition = (await this.load()).get(requestType);
    if (!definition) {
      throw new NotFoundException('Formulaire introuvable.');
    }
    return definition;
  }

  /** Nombre de demandes déjà enregistrées par clé de champ (aide à la décision du super admin) */
  async fieldUsage(requestType: RequestType): Promise<Record<string, number>> {
    const definition = await this.findByType(requestType);
    const usage: Record<string, number> = {};
    await Promise.all(
      definition.fields.map(async (field) => {
        usage[field.key] = await this.requestModel.countDocuments({
          requestType,
          [`formData.${field.key}`]: { $exists: true },
        });
      }),
    );
    return usage;
  }

  /** Nombre total de demandes déjà créées avec ce formulaire */
  async requestCount(requestType: RequestType): Promise<number> {
    return this.requestModel.countDocuments({ requestType });
  }

  /**
   * Intitulé courant du formulaire (notifications, historique, PDF).
   * Repli sur le libellé livré si la définition est indisponible.
   */
  async titleOf(requestType: RequestType): Promise<string> {
    try {
      return (await this.findByType(requestType)).title;
    } catch {
      return REQUEST_TYPE_LABELS[requestType];
    }
  }

  /** Refuse la création d'une demande sur un formulaire retiré du catalogue */
  async assertUsable(requestType: RequestType): Promise<FormDefinitionDocument> {
    const definition = await this.findByType(requestType);
    if (!definition.isActive) {
      throw new BadRequestException(
        `Le formulaire « ${definition.title} » n'est plus disponible. Contactez l'administrateur.`,
      );
    }
    return definition;
  }

  // ------------------------------------------------------------------
  // Validation du contenu d'une demande (formData)
  // ------------------------------------------------------------------

  /**
   * Valide et nettoie le `formData` d'une demande selon la définition en base :
   * champs requis, valeurs de listes autorisées, engagements cochés, bornes,
   * et suppression de toute clé non déclarée (liste blanche).
   */
  async validateFormData(
    requestType: RequestType,
    raw: Record<string, unknown> | undefined | null,
  ): Promise<{ cleaned: Record<string, unknown>; errors: FormDataValidationError[] }> {
    const definition = await this.findByType(requestType);
    const input = raw ?? {};
    const cleaned: Record<string, unknown> = {};
    const errors: FormDataValidationError[] = [];

    for (const field of definition.fields) {
      const value = input[field.key];

      if (field.kind === FormFieldKind.COMMITMENT) {
        if (value !== true && field.required) {
          errors.push({
            field: field.key,
            message: `L'engagement doit être accepté : « ${field.label} ».`,
          });
        } else {
          cleaned[field.key] = value === true;
        }
        continue;
      }

      if (field.kind === FormFieldKind.NUMBER) {
        const numeric =
          typeof value === 'number'
            ? value
            : typeof value === 'string' && value.trim() !== ''
              ? Number(value)
              : null;
        if (numeric === null) {
          if (field.required) {
            errors.push({
              field: field.key,
              message: `Le champ « ${field.label} » est obligatoire.`,
            });
          }
          continue;
        }
        if (Number.isNaN(numeric)) {
          errors.push({
            field: field.key,
            message: `Le champ « ${field.label} » doit être un nombre.`,
          });
          continue;
        }
        if (field.min !== null && field.min !== undefined && numeric < field.min) {
          errors.push({
            field: field.key,
            message: `Le champ « ${field.label} » ne peut pas être inférieur à ${field.min}.`,
          });
          continue;
        }
        if (field.max !== null && field.max !== undefined && numeric > field.max) {
          errors.push({
            field: field.key,
            message: `Le champ « ${field.label} » ne peut pas dépasser ${field.max}.`,
          });
          continue;
        }
        cleaned[field.key] = numeric;
        continue;
      }

      const text = typeof value === 'string' ? value.trim() : '';
      if (!text) {
        if (field.required) {
          errors.push({ field: field.key, message: `Le champ « ${field.label} » est obligatoire.` });
        }
        continue;
      }

      if (field.kind === FormFieldKind.DATE) {
        if (!DATE_PATTERN.test(text) || Number.isNaN(new Date(text).getTime())) {
          errors.push({
            field: field.key,
            message: `Le champ « ${field.label} » doit être une date valide (AAAA-MM-JJ).`,
          });
          continue;
        }
        cleaned[field.key] = text;
        continue;
      }

      if (field.kind === FormFieldKind.SELECT) {
        const allowed = field.options.some((option) => option.value === text);
        if (!allowed) {
          errors.push({ field: field.key, message: `Valeur invalide pour « ${field.label} ».` });
          continue;
        }
        cleaned[field.key] = text;
        continue;
      }

      const maxLength = field.maxLength ?? 2000;
      if (text.length > maxLength) {
        errors.push({
          field: field.key,
          message: `Le champ « ${field.label} » dépasse ${maxLength} caractères.`,
        });
        continue;
      }
      cleaned[field.key] = text;
    }

    return { cleaned, errors };
  }

  /**
   * Décrit le contenu rempli d'une demande (export PDF, affichages serveur).
   * Les clés absentes de la définition actuelle — champ supprimé du formulaire
   * après la création de la demande — restent affichées : l'historique
   * d'une demande déjà déposée n'est jamais perdu.
   */
  async describeFormData(
    requestType: RequestType,
    formData: Record<string, unknown> | undefined | null,
  ): Promise<DescribedFormData> {
    const definition = await this.findByType(requestType);
    const data = formData ?? {};
    const entries: LabelledFormEntry[] = [];
    const commitments: FormCommitmentState[] = [];
    const covered = new Set<string>();

    for (const field of definition.fields) {
      covered.add(field.key);
      if (field.kind === FormFieldKind.COMMITMENT) {
        commitments.push({ label: field.label, accepted: data[field.key] === true });
        continue;
      }
      const value = data[field.key];
      if (value === undefined || value === null || value === '') continue;
      entries.push({ label: field.label, value: formatFieldValue(field, value) });
    }

    for (const [key, value] of Object.entries(data)) {
      if (covered.has(key) || value === undefined || value === null || value === '') continue;
      entries.push({
        label: `${key} (champ retiré du formulaire)`,
        value: typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value),
      });
    }

    return { title: definition.title, entries, commitments };
  }

  // ------------------------------------------------------------------
  // Écriture (super administrateur)
  // ------------------------------------------------------------------

  async update(
    requestType: RequestType,
    dto: UpdateFormDefinitionDto,
    context: ActionContext = {},
  ): Promise<FormDefinitionDocument> {
    const definition = await this.findByType(requestType);
    const previousKeys = definition.fields.map((field) => field.key);

    if (dto.title !== undefined) definition.title = dto.title.trim();
    if (dto.shortLabel !== undefined) definition.shortLabel = dto.shortLabel.trim();
    if (dto.description !== undefined) definition.description = dto.description.trim();
    if (dto.instructions !== undefined) definition.instructions = dto.instructions.trim();
    if (dto.requiresAccessType !== undefined) definition.requiresAccessType = dto.requiresAccessType;
    if (dto.requiresDuration !== undefined) definition.requiresDuration = dto.requiresDuration;
    if (dto.defaultJustification !== undefined) {
      definition.defaultJustification = dto.defaultJustification.trim();
    }
    if (dto.requiresJustification !== undefined) {
      definition.requiresJustification = dto.requiresJustification;
    }
    if (dto.fields !== undefined) {
      definition.fields = this.normalizeFields(dto.fields);
    }

    // Un formulaire sans justification libre doit fournir une justification de repli
    // (elle alimente le PDF, l'historique et le score d'aide à la décision)
    if (!definition.requiresJustification && !definition.defaultJustification) {
      throw new BadRequestException(
        'Un formulaire sans justification libre doit définir une justification par défaut.',
      );
    }

    definition.updatedBy = context.actor ? new Types.ObjectId(context.actor.userId) : null;
    definition.version += 1;
    await definition.save();
    this.cache = null;

    const newKeys = definition.fields.map((field) => field.key);
    const removed = previousKeys.filter((key) => !newKeys.includes(key));
    const added = newKeys.filter((key) => !previousKeys.includes(key));

    await this.auditLogs.record({
      userId: context.actor?.userId,
      userEmail: context.actor?.email,
      action: AuditAction.FORM_UPDATED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: {
        formulaire: requestType,
        version: definition.version,
        champsAjoutes: added,
        champsRetires: removed,
      },
    });

    // Rechargement : renvoie la définition avec son auteur de modification peuplé
    return this.findByType(requestType);
  }

  async setActive(
    requestType: RequestType,
    active: boolean,
    context: ActionContext = {},
  ): Promise<FormDefinitionDocument> {
    const definition = await this.findByType(requestType);
    definition.isActive = active;
    definition.updatedBy = context.actor ? new Types.ObjectId(context.actor.userId) : null;
    await definition.save();
    this.cache = null;

    await this.auditLogs.record({
      userId: context.actor?.userId,
      userEmail: context.actor?.email,
      action: active ? AuditAction.FORM_ACTIVATED : AuditAction.FORM_DEACTIVATED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { formulaire: requestType, titre: definition.title },
    });
    return this.findByType(requestType);
  }

  /** Restaure le formulaire dans son état d'origine (définitions livrées) */
  async reset(
    requestType: RequestType,
    context: ActionContext = {},
  ): Promise<FormDefinitionDocument> {
    const definition = await this.findByType(requestType);
    const defaults = this.fromDefaults(DEFAULT_FORM_DEFINITIONS[requestType]);
    const version = definition.version + 1;

    await this.formModel.updateOne(
      { _id: definition._id },
      {
        ...defaults,
        version,
        updatedBy: context.actor ? new Types.ObjectId(context.actor.userId) : null,
      },
    );
    this.cache = null;

    await this.auditLogs.record({
      userId: context.actor?.userId,
      userEmail: context.actor?.email,
      action: AuditAction.FORM_RESET,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { formulaire: requestType, version },
    });

    return this.findByType(requestType);
  }

  // ------------------------------------------------------------------
  // Privé
  // ------------------------------------------------------------------

  private async syncManagedDefaultFields(): Promise<RequestType[]> {
    const definitions = await this.formModel.find().exec();
    const upgraded: RequestType[] = [];

    for (const definition of definitions) {
      const defaults = DEFAULT_FORM_DEFINITIONS[definition.requestType];
      if (!defaults) continue;

      const fields = definition.fields.map((field) => this.fieldToPlain(field));
      let changed = false;

      for (const defaultField of defaults.fields) {
        const nextField = this.fromDefaultField(defaultField);
        const index = fields.findIndex((field) => field.key === nextField.key);

        if (index === -1) {
          fields.push(nextField);
          changed = true;
          continue;
        }

        if (!this.isManagedDefaultField(definition.requestType, nextField.key)) {
          continue;
        }

        if (JSON.stringify(fields[index]) !== JSON.stringify(nextField)) {
          fields[index] = nextField;
          changed = true;
        }
      }

      if (!changed) continue;
      definition.fields = fields as FormFieldDefinition[];
      definition.version += 1;
      await definition.save();
      upgraded.push(definition.requestType);
    }

    return upgraded;
  }

  private isManagedDefaultField(requestType: RequestType, key: string): boolean {
    return (
      key === 'commitmentAccepted' ||
      (requestType === RequestType.NETWORK_SHARE && key === 'permissionLevel')
    );
  }

  private fromDefaultField(field: DefaultFormField): FormFieldDefinition {
    return {
      key: field.key,
      label: field.label,
      kind: field.kind,
      required: field.required,
      maxLength: field.maxLength ?? null,
      min: field.min ?? null,
      max: field.max ?? null,
      placeholder: field.placeholder ?? '',
      helpText: field.helpText ?? '',
      options: field.options ?? [],
    } as FormFieldDefinition;
  }

  private fieldToPlain(field: FormFieldDefinition): FormFieldDefinition {
    return {
      key: field.key,
      label: field.label,
      kind: field.kind,
      required: field.required,
      maxLength: field.maxLength ?? null,
      min: field.min ?? null,
      max: field.max ?? null,
      placeholder: field.placeholder ?? '',
      helpText: field.helpText ?? '',
      options: (field.options ?? []).map((option) => ({
        value: option.value,
        label: option.label,
      })),
    } as FormFieldDefinition;
  }

  private async load(): Promise<Map<RequestType, FormDefinitionDocument>> {
    if (this.cache) {
      return this.cache;
    }
    const definitions = await this.formModel
      .find()
      .populate({ path: 'updatedBy', select: 'firstName lastName' })
      .exec();
    const map = new Map<RequestType, FormDefinitionDocument>();
    for (const definition of definitions) {
      map.set(definition.requestType, definition);
    }
    // Base non initialisée (ex : collection vidée à chaud) : on repart des défauts
    for (const type of Object.values(RequestType)) {
      if (!map.has(type)) {
        map.set(
          type,
          new this.formModel(this.fromDefaults(DEFAULT_FORM_DEFINITIONS[type])) as FormDefinitionDocument,
        );
      }
    }
    this.cache = map;
    return map;
  }

  /** Contrôles de cohérence d'un formulaire édité par le super administrateur */
  private normalizeFields(
    fields: UpdateFormDefinitionDto['fields'] = [],
  ): FormFieldDefinition[] {
    const seen = new Set<string>();
    return fields.map((field, index) => {
      const key = field.key.trim();
      const position = index + 1;

      if (seen.has(key)) {
        throw new BadRequestException(
          `La clé technique « ${key} » est utilisée par deux champs : chaque clé doit être unique.`,
        );
      }
      if (RESERVED_FIELD_KEYS.includes(key)) {
        throw new BadRequestException(
          `La clé technique « ${key} » est réservée par l'application : choisissez-en une autre (champ ${position}).`,
        );
      }
      seen.add(key);

      const isText = field.kind === FormFieldKind.TEXT || field.kind === FormFieldKind.TEXTAREA;
      const options =
        field.kind === FormFieldKind.SELECT
          ? (field.options ?? []).map((option) => ({
              value: option.value.trim(),
              label: option.label.trim(),
            }))
          : [];

      if (field.kind === FormFieldKind.SELECT) {
        if (options.length === 0) {
          throw new BadRequestException(
            `Le champ « ${field.label} » est une liste de choix : ajoutez au moins une option.`,
          );
        }
        const values = new Set<string>();
        for (const option of options) {
          if (values.has(option.value)) {
            throw new BadRequestException(
              `Le champ « ${field.label} » comporte deux options de même valeur (« ${option.value} »).`,
            );
          }
          values.add(option.value);
        }
      }

      if (
        field.kind === FormFieldKind.NUMBER &&
        field.min !== undefined &&
        field.max !== undefined &&
        field.min > field.max
      ) {
        throw new BadRequestException(
          `Le champ « ${field.label} » a une valeur minimale supérieure à sa valeur maximale.`,
        );
      }

      return {
        key,
        label: field.label.trim(),
        kind: field.kind,
        // Un engagement optionnel n'aurait aucune valeur juridique : toujours obligatoire
        required: field.kind === FormFieldKind.COMMITMENT ? true : field.required === true,
        maxLength: isText ? (field.maxLength ?? null) : null,
        min: field.kind === FormFieldKind.NUMBER ? (field.min ?? null) : null,
        max: field.kind === FormFieldKind.NUMBER ? (field.max ?? null) : null,
        placeholder: field.placeholder?.trim() ?? '',
        helpText: field.helpText?.trim() ?? '',
        options,
      };
    });
  }

  private fromDefaults(defaults: DefaultFormDefinition): Record<string, unknown> {
    return {
      requestType: defaults.requestType,
      title: defaults.title,
      shortLabel: defaults.shortLabel,
      description: defaults.description,
      instructions: defaults.instructions,
      isActive: true,
      requiresAccessType: defaults.requiresAccessType,
      requiresDuration: defaults.requiresDuration,
      requiresJustification: defaults.requiresJustification,
      defaultJustification: defaults.defaultJustification,
      fields: defaults.fields.map((field) => ({
        key: field.key,
        label: field.label,
        kind: field.kind,
        required: field.required,
        maxLength: field.maxLength ?? null,
        min: field.min ?? null,
        max: field.max ?? null,
        placeholder: field.placeholder ?? '',
        helpText: field.helpText ?? '',
        options: field.options ?? [],
      })),
      updatedBy: null,
    };
  }
}

/** Libellé lisible d'une valeur de formData (résout les listes et les engagements) */
export function formatFieldValue(field: FormFieldDefinition, value: unknown): string {
  if (field.kind === FormFieldKind.COMMITMENT) {
    return value === true ? 'Oui — engagement accepté' : 'Non';
  }
  if (field.kind === FormFieldKind.SELECT && typeof value === 'string') {
    return field.options.find((option) => option.value === value)?.label ?? value;
  }
  if (field.kind === FormFieldKind.DATE && typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-FR');
  }
  return String(value ?? '');
}
