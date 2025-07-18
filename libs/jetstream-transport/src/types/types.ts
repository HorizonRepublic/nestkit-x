/**
 * Error codes for JetStream API operations.
 */
export enum JetStreamErrorCode {
  ConsumerNotFound = 10014,
  ConsumerExists = 10013,
}

/**
 * Represents JetStream API error structure.
 */
export interface IJetStreamError {
  message: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  api_error?: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    err_code: number;
    description?: string;
  };
}
