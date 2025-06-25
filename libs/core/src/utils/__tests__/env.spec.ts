import 'reflect-metadata';
import { Type } from '@nestjs/common';
import { ConfigFactory, ConfigFactoryKeyHost } from '@nestjs/config';

import { Env, registerConfig } from '../env';

// Test configuration classes
class TestConfig {
  @Env('TEST_BOOLEAN', { default: true, type: Boolean })
  public booleanValue!: boolean;

  @Env('TEST_NUMBER', { default: 42, type: Number })
  public numberValue!: number;

  @Env('TEST_REQUIRED')
  public requiredValue!: string;

  @Env('TEST_STRING', { default: 'default-value' })
  public stringValue!: string;
}

class ValidatedConfig {
  @Env('VALIDATED_NAME', { default: 'test-app' })
  public name!: string;

  @Env('VALIDATED_PORT', { default: 3000, type: Number })
  public port!: number;
}

// Mock validator functions
const mockValidator = <T>(config: T): T => config;

const strictValidator = (config: ValidatedConfig): ValidatedConfig => {
  if (config.port < 1 || config.port > 65535) {
    throw new Error('Port must be between 1 and 65535');
  }

  if (config.name.length < 3) {
    throw new Error('Name must be at least 3 characters');
  }

  return config;
};

describe('registerConfig', () => {
  const originalEnv = process.env;
  const TEST_TOKEN = Symbol('TEST_CONFIG');

  beforeEach(() => {
    // Clear process.env before each test
    process.env = {};
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('basic functionality', () => {
    it('should create a config factory with default values', () => {
      // Arrange
      process.env['TEST_REQUIRED'] = 'required-value';

      // Act
      const factory = registerConfig(TEST_TOKEN, TestConfig, mockValidator);

      // Assert
      expect(factory).toBeDefined();
      expect(typeof factory).toBe('function');
      expect(factory.KEY).toBe(TEST_TOKEN);

      const config = factory() as TestConfig;

      expect(config.stringValue).toBe('default-value');
      expect(config.numberValue).toBe(42);
      expect(config.booleanValue).toBe(true);
      expect(config.requiredValue).toBe('required-value');
    });

    it('should override defaults with environment variables', () => {
      // Arrange
      process.env['TEST_STRING'] = 'env-string';
      process.env['TEST_NUMBER'] = '123';
      process.env['TEST_BOOLEAN'] = 'false';
      process.env['TEST_REQUIRED'] = 'env-required';

      // Act
      const factory = registerConfig(TEST_TOKEN, TestConfig, mockValidator);
      const config = factory() as TestConfig;

      // Assert
      expect(config.stringValue).toBe('env-string');
      expect(config.numberValue).toBe(123);
      expect(config.booleanValue).toBe(false);
      expect(config.requiredValue).toBe('env-required');
    });

    it('should handle boolean environment variables correctly', () => {
      // Arrange & Act & Assert
      const testCases = [
        { envValue: 'true', expected: true },
        { envValue: '1', expected: true },
        { envValue: 'false', expected: false },
        { envValue: '0', expected: false },
        { envValue: 'anything-else', expected: false },
      ];

      testCases.forEach(({ envValue, expected }) => {
        process.env = {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          TEST_BOOLEAN: envValue,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          TEST_REQUIRED: 'test',
        };
        const factory = registerConfig(TEST_TOKEN, TestConfig, mockValidator);
        const config = factory() as TestConfig;

        expect(config.booleanValue).toBe(expected);
      });
    });
  });

  describe('validation', () => {
    it('should apply validator function to config', () => {
      // Arrange
      process.env['VALIDATED_PORT'] = '8080';
      process.env['VALIDATED_NAME'] = 'my-app';

      // Act
      const factory = registerConfig(Symbol('VALIDATED'), ValidatedConfig, strictValidator);
      const config = factory() as ValidatedConfig;

      // Assert
      expect(config.port).toBe(8080);
      expect(config.name).toBe('my-app');
    });

    it('should throw validation error for invalid port', () => {
      // Arrange
      process.env['VALIDATED_PORT'] = '99999';
      process.env['VALIDATED_NAME'] = 'valid-name';

      // Act & Assert
      expect(() => {
        registerConfig(Symbol('INVALID'), ValidatedConfig, strictValidator);
      }).toThrow('Port must be between 1 and 65535');
    });

    it('should throw validation error for short name', () => {
      // Arrange
      process.env['VALIDATED_PORT'] = '3000';
      process.env['VALIDATED_NAME'] = 'ab';

      // Act & Assert
      expect(() => {
        registerConfig(Symbol('INVALID'), ValidatedConfig, strictValidator);
      }).toThrow('Name must be at least 3 characters');
    });
  });

  describe('error handling', () => {
    it('should throw error for missing required environment variable', () => {
      // Arrange - don't set TEST_REQUIRED

      // Act & Assert
      expect(() => {
        registerConfig(TEST_TOKEN, TestConfig, mockValidator);
      }).toThrow('Missing required environment variable: TEST_REQUIRED');
    });

    it('should throw error for invalid number conversion', () => {
      // Arrange
      process.env['TEST_NUMBER'] = 'not-a-number';
      process.env['TEST_REQUIRED'] = 'test';

      // Act & Assert
      expect(() => {
        registerConfig(TEST_TOKEN, TestConfig, mockValidator);
      }).toThrow('Invalid value for TEST_NUMBER: Cannot convert "not-a-number" to number');
    });

    it('should handle validator throwing errors', () => {
      // Arrange
      const errorValidator = (): never => {
        throw new Error('Validation failed');
      };

      process.env['TEST_REQUIRED'] = 'test';

      // Act & Assert
      expect(() => {
        registerConfig(TEST_TOKEN, TestConfig, errorValidator);
      }).toThrow('Validation failed');
    });
  });

  describe('return type properties', () => {
    it('should return object with correct KEY property', () => {
      // Arrange
      process.env['TEST_REQUIRED'] = 'test';
      const token = Symbol('UNIQUE_TOKEN');

      // Act
      const factory = registerConfig(token, TestConfig, mockValidator);

      // Assert
      expect(factory.KEY).toBe(token);
    });

    it('should return function that produces config', () => {
      // Arrange
      process.env['TEST_REQUIRED'] = 'test-value';

      // Act
      const factory = registerConfig(TEST_TOKEN, TestConfig, mockValidator);

      // Assert
      expect(typeof factory).toBe('function');

      const config1 = factory() as TestConfig;
      const config2 = factory() as TestConfig;

      expect(config1).toEqual(config2);
      expect(config1.requiredValue).toBe('test-value');
    });
  });

  describe('integration with NestJS types', () => {
    it('should satisfy ConfigFactory interface', () => {
      // Arrange
      process.env['TEST_REQUIRED'] = 'test';

      // Act
      const factory = registerConfig(TEST_TOKEN, TestConfig, mockValidator);

      // Assert
      // Type check - should compile without errors
      const configFactory: ConfigFactory = factory;
      const keyHost: ConfigFactoryKeyHost<TestConfig> = factory;

      expect(configFactory).toBeDefined();
      expect(keyHost.KEY).toBe(TEST_TOKEN);
    });

    it('should work with Type<T> parameter', () => {
      // Arrange
      process.env['TEST_REQUIRED'] = 'test';
      const configClass: Type<TestConfig> = TestConfig;

      // Act & Assert
      expect(() => {
        registerConfig(TEST_TOKEN, configClass, mockValidator);
      }).not.toThrow();
    });
  });
});
