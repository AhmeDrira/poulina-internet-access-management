import { api } from './client';
import { FormDefinition, FormFieldKind, FormUsage, RequestType } from '../types';

/** Charge utile d'édition d'un formulaire (super administrateur) */
export interface FormFieldPayload {
  key: string;
  label: string;
  kind: FormFieldKind;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  helpText?: string;
  options?: { value: string; label: string }[];
}

export interface FormDefinitionPayload {
  title?: string;
  shortLabel?: string;
  description?: string;
  instructions?: string;
  requiresAccessType?: boolean;
  requiresDuration?: boolean;
  requiresJustification?: boolean;
  defaultJustification?: string;
  fields?: FormFieldPayload[];
}

export const formsApi = {
  /** Définitions visibles par l'utilisateur (les administrateurs voient aussi les inactives) */
  async list(): Promise<FormDefinition[]> {
    const { data } = await api.get<FormDefinition[]>('/form-definitions');
    return data;
  },

  async get(type: RequestType): Promise<FormDefinition> {
    const { data } = await api.get<FormDefinition>(`/form-definitions/${type}`);
    return data;
  },

  async usage(type: RequestType): Promise<FormUsage> {
    const { data } = await api.get<FormUsage>(`/form-definitions/${type}/usage`);
    return data;
  },

  async update(type: RequestType, payload: FormDefinitionPayload): Promise<FormDefinition> {
    const { data } = await api.patch<FormDefinition>(`/form-definitions/${type}`, payload);
    return data;
  },

  async setActive(type: RequestType, active: boolean): Promise<FormDefinition> {
    const { data } = await api.patch<FormDefinition>(
      `/form-definitions/${type}/${active ? 'activate' : 'deactivate'}`,
      {},
    );
    return data;
  },

  async reset(type: RequestType): Promise<FormDefinition> {
    const { data } = await api.post<FormDefinition>(`/form-definitions/${type}/reset`, {});
    return data;
  },
};
