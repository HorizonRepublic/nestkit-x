import { HttpStatus } from '@nestjs/common';

const baseRedactedPaths = [
  'password',
  'secret',
  'token',
  'authorization',
  'bearer',
  'apiKey',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'clientSecret',
  'privateKey',
  'publicKey',
  'signingKey',
  'encryptionKey',
  'csrfToken',
  'sessionId',
  'jwt',

  'email',
  'phone',
  'ssn',
  'passport',
  'driverLicense',
  'taxId',
  'nationalId',
  'dateOfBirth',
  'firstName',
  'lastName',
  'fullName',

  'creditCard',
  'cardNumber',
  'cvv',
  'bankAccount',
  'accountNumber',
  'routingNumber',
  'iban',
  'swift',

  'cookie',
  'setCookie',

  'connectionString',
  'databaseUrl',
  'dbPassword',

  'key',
  'apiKey',
  'apiToken',
  'apiSecret',
  'keys',
  'auth',
  'credentials',
  'sensitive',
  'confidential',
];

const toSnakeCase = (str: string): string =>
  str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

export const redactedPaths: string[] = [
  ...baseRedactedPaths,
  ...baseRedactedPaths.map(toSnakeCase),

  'auth.*',
  'user.*',
  'body.*',
  'headers.*',
  'req.headers.*',
  'res.headers.*',
  'config.*',
  'env.*',
  'credentials.*',
];

export const CRITICAL_CLIENT_ERRORS = new Set<number>([
  431,
  HttpStatus.CONFLICT,
  HttpStatus.FORBIDDEN,
  HttpStatus.GONE,
  HttpStatus.METHOD_NOT_ALLOWED,
  HttpStatus.NOT_ACCEPTABLE,
  HttpStatus.PAYLOAD_TOO_LARGE,
  HttpStatus.TOO_MANY_REQUESTS,
  HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  HttpStatus.URI_TOO_LONG,
]);

export const SKIP_IN_DEV = new Set<number>([HttpStatus.BAD_REQUEST, HttpStatus.UNPROCESSABLE_ENTITY]);

export const SUSPICIOUS_PATTERNS = [
  /sql/i,
  /script/i,
  /admin/i,
  /\.\.\/\.\.\//,
  /eval\(/i,
  /union.*select/i,
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i,
];
