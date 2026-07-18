import { api } from './client';
import { DepartmentStats, MonthlyStats, StatsOverview, TypeStats } from '../types';

export const statisticsApi = {
  async overview(): Promise<StatsOverview> {
    const { data } = await api.get<StatsOverview>('/statistics/overview');
    return data;
  },

  async byDepartment(): Promise<DepartmentStats[]> {
    const { data } = await api.get<DepartmentStats[]>('/statistics/by-department');
    return data;
  },

  async byType(): Promise<TypeStats[]> {
    const { data } = await api.get<TypeStats[]>('/statistics/by-type');
    return data;
  },

  async monthly(months = 6): Promise<MonthlyStats[]> {
    const { data } = await api.get<MonthlyStats[]>('/statistics/monthly', {
      params: { months },
    });
    return data;
  },
};
