/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MedicationRecord {
  id: string;
  type?: 'status' | 'prescription';
  isMedicated: boolean;
  hasSymptoms: boolean;
  memo: string;
  imageUrl?: string; // Base64 string or URL
  timestamp: string; // ISO string
}
