export type SyncEntityType = 'TASK' | 'ALERT' | 'CROP' | 'LOT' | 'COMMENT';

export type SyncOperationType = 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELETE';

export type SyncItemStatus = 'PENDING' | 'SYNCING' | 'FAILED';

export interface OutboxAttachment {
  fieldName: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
}

export interface OutboxOperation {
  id: string;
  entity: SyncEntityType;
  operation: SyncOperationType;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload: any;
  isMultipart?: boolean;
  attachments?: OutboxAttachment[];
  farmId: string;
  description: string;
  localRefId?: string;
  createdAt: string;
  retryCount: number;
  status: SyncItemStatus;
  lastError?: string;
}

export interface CachedEnvelope<T> {
  savedAt: string;
  data: T;
}
