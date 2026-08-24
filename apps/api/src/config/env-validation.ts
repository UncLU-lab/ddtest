function isMissing(value: string | undefined): boolean {
  return value === undefined || value === '';
}

function validateBooleanFlag(name: string, value: string | undefined): void {
  if (value === undefined) {
    return;
  }

  const normalized = value.toLowerCase();

  if (normalized !== 'true' && normalized !== 'false') {
    throw new Error(
      `Invalid production configuration: ${name} must be "true" or "false" when set.`,
    );
  }
}

function validatePort(name: string, value: string | undefined): void {
  if (value === undefined) {
    return;
  }

  if (value.trim() === '' || !/^\d+$/.test(value.trim())) {
    throw new Error(
      `Invalid production configuration: ${name} must be a valid integer port.`,
    );
  }

  const port = Number.parseInt(value.trim(), 10);

  if (port < 1 || port > 65535) {
    throw new Error(
      `Invalid production configuration: ${name} must be a valid integer port.`,
    );
  }
}

export function readPositiveIntegerEnvironmentValue(
  name: string,
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `Invalid configuration: ${name} must be a positive integer.`,
    );
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(
      `Invalid configuration: ${name} must be a positive integer.`,
    );
  }

  return parsed;
}

function validateCommaSeparatedValues(name: string, value: string): string[] {
  const values = value.split(',').map((entry) => entry.trim());

  if (values.length === 0 || values.some((entry) => entry === '')) {
    throw new Error(
      `Invalid production configuration: ${name} must contain one or more non-empty comma-separated values.`,
    );
  }

  return values;
}

export function validateProductionEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  if (isMissing(env.DB_ENABLED)) {
    throw new Error(
      'Invalid production configuration: DB_ENABLED must be explicitly set to "true" or "false".',
    );
  }

  validateBooleanFlag('DB_ENABLED', env.DB_ENABLED);
  validatePort('PORT', env.PORT);
  validatePort('DB_PORT', env.DB_PORT);
  readPositiveIntegerEnvironmentValue('DB_POOL_MAX', env.DB_POOL_MAX, 2);
  validateBooleanFlag('DB_SSL', env.DB_SSL);
  validateBooleanFlag(
    'DB_SSL_REJECT_UNAUTHORIZED',
    env.DB_SSL_REJECT_UNAUTHORIZED,
  );
  if (env.CORS_ORIGINS !== undefined) {
    validateCommaSeparatedValues('CORS_ORIGINS', env.CORS_ORIGINS);
  }
}

export function validateProductionDatabaseEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): void {
  validateProductionEnvironment(env);

  if (env.NODE_ENV !== 'production') {
    return;
  }

  if (env.DB_ENABLED?.toLowerCase() !== 'true') {
    return;
  }

  if (!isMissing(env.DATABASE_URL)) {
    return;
  }

  const missing = [
    'DB_HOST',
    'DB_PORT',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_DATABASE',
  ].filter((name) => isMissing(env[name]));

  if (missing.length > 0) {
    throw new Error(
      `Invalid production configuration: when DB_ENABLED is true, set DATABASE_URL or all of: ${missing.join(', ')}.`,
    );
  }
}

export function getProductionCorsOrigins(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  validateProductionEnvironment(env);

  if (env.NODE_ENV !== 'production') {
    return [];
  }

  const value = env.CORS_ORIGINS;

  if (isMissing(value)) {
    throw new Error(
      'Invalid production configuration: CORS_ORIGINS must be set to one or more comma-separated origins.',
    );
  }

  return validateCommaSeparatedValues('CORS_ORIGINS', value as string);
}

export function validateAuthenticationEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.DB_ENABLED?.toLowerCase() !== 'true') {
    return;
  }

  const authMode = env.AUTH_MODE?.trim().toLowerCase();

  if (authMode !== 'firebase' && authMode !== 'development') {
    throw new Error(
      'Invalid authentication configuration: AUTH_MODE must be "firebase" or "development" when DB_ENABLED is true.',
    );
  }

  if (env.NODE_ENV === 'production' && authMode !== 'firebase') {
    throw new Error(
      'Invalid authentication configuration: production requires AUTH_MODE="firebase".',
    );
  }

  if (authMode === 'firebase') {
    if (isMissing(env.FIREBASE_PROJECT_ID)) {
      throw new Error(
        'Invalid authentication configuration: FIREBASE_PROJECT_ID is required in Firebase authentication mode.',
      );
    }

    const hasClientEmail = !isMissing(env.FIREBASE_CLIENT_EMAIL);
    const hasPrivateKey = !isMissing(env.FIREBASE_PRIVATE_KEY);
    if (hasClientEmail !== hasPrivateKey) {
      throw new Error(
        'Invalid authentication configuration: FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY must be provided together.',
      );
    }
  }

  if (authMode === 'development') {
    const missing = [
      'AUTH_DEVELOPMENT_TOKEN',
      'AUTH_DEVELOPMENT_FIREBASE_UID',
    ].filter((name) => isMissing(env[name]));

    if (missing.length > 0) {
      throw new Error(
        `Invalid authentication configuration: development mode requires ${missing.join(', ')}.`,
      );
    }
  }
}
