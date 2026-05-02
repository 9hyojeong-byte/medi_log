/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MedicationRecord {
  id: string;
  isMedicated: boolean;
  hasSymptoms: boolean;
  memo: string;
  timestamp: string; // ISO string
}
