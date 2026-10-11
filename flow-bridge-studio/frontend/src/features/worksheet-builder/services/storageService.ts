import type { Worksheet } from '../types';

const STORAGE_KEY = 'flow_bridge_worksheets_v1';
const ACTIVE_ID_KEY = 'flow_bridge_active_worksheet_id';

export interface StorageProvider {
  listWorksheets(): Promise<Worksheet[]>;
  getWorksheet(id: string): Promise<Worksheet | null>;
  saveWorksheet(worksheet: Worksheet): Promise<void>;
  deleteWorksheet(id: string): Promise<void>;
}

export class LocalWorksheetStorage implements StorageProvider {
  async listWorksheets(): Promise<Worksheet[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load worksheets from storage', e);
      return [];
    }
  }

  async getWorksheet(id: string): Promise<Worksheet | null> {
    const list = await this.listWorksheets();
    return list.find((w) => w.id === id) || null;
  }

  async saveWorksheet(worksheet: Worksheet): Promise<void> {
    const list = await this.listWorksheets();
    const existingIndex = list.findIndex((w) => w.id === worksheet.id);

    const updated = {
      ...worksheet,
      updatedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      list[existingIndex] = updated;
    } else {
      list.unshift(updated);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    localStorage.setItem(ACTIVE_ID_KEY, worksheet.id);
  }

  async deleteWorksheet(id: string): Promise<void> {
    const list = await this.listWorksheets();
    const filtered = list.filter((w) => w.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }

  getActiveWorksheetId(): string | null {
    return localStorage.getItem(ACTIVE_ID_KEY);
  }

  setActiveWorksheetId(id: string): void {
    localStorage.setItem(ACTIVE_ID_KEY, id);
  }
}

export const worksheetStorage = new LocalWorksheetStorage();
