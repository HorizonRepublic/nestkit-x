import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  APP_CONFIG,
  ENV_METADATA_KEY,
  Environment,
  IAppConfig,
  IEnvFieldMetadata,
} from '@nestkit-x/core';
import { rootPath } from 'get-root-path';

/**
 * Environment Example File Generator.
 *
 * Automatically generates environment configuration example files based on the
 * registered configurations decorated with Env decorator. This provider runs
 * only in the local development environment to support developers with configuration setup.
 *
 * @description
 * The EnvExampleProvider scans all registered configuration classes that use the
 * Env decorator and generates comprehensive .env example files with:
 * - All available environment variables
 * - Default values where applicable
 * - Example values for reference
 * - Organized sections by configuration class
 * - Smart content-based regeneration (only when configuration changes).
 *
 * @example -
 * Generated file structure:
 * ```
 * examples/env/
 * └── {app-name}.env # Main environment file
 * ```
 *
 * @example -
 * Usage in configuration class:
 * ```TypeScript
 * class DatabaseConfig {
 *   @Env('DATABASE_URL', {
 *     example: 'postgresql://user:password@localhost:5432/db',
 *     description: 'Database connection string'
 *   })
 *   public url!: string;
 * }
 * ```
 * @internal
 */
@Injectable()
export class EnvExampleProvider implements OnModuleInit {
  private static readonly examplesDir = 'examples/env' as const;

  /**
   * File generation constants.
   */
  private static readonly fileEncoding = 'utf8' as const;
  private static readonly fileExtension = '.env' as const;
  private static readonly hashAlgorithm = 'sha256' as const;

  /**
   * Template constants for generated files.
   */
  private static readonly templateHeader = `###
#
# This is auto generated file based on all config registered. Do not edit it manually.
# If some of configs are not presented here, it means that they are not used @Env() decorator.
#
###` as const;

  private readonly logger = new Logger(EnvExampleProvider.name);

  public constructor(private readonly configService: ConfigService) {}

  /**
   * Lifecycle hook that runs after module initialization.
   * Generates environment example files only in the local development environment.
   *
   * @description
   * This method:
   * 1. Checks if the current environment is local development
   * 2. Extracts all registered configurations with Env metadata
   * 3. Generates organized sections with environment variables
   * 4. Checks if content has changed by comparing with existing file
   * 5. Creates/updates the example file only when necessary.
   *
   * @throws {Error} When configuration cannot be retrieved or a file cannot be written.
   * @example -
   */
  public async onModuleInit(): Promise<void> {
    try {
      const appConfig = this.getAppConfiguration();

      if (!this.shouldGenerateExamples(appConfig.env)) return;

      const configSections = this.extractConfigurationSections();
      const templateContent = this.buildTemplate(configSections);
      const outputPath = this.buildOutputPath(appConfig.name);

      const shouldUpdate = await this.shouldUpdateFile(outputPath, templateContent);

      if (!shouldUpdate) return;

      await this.writeExampleFile(outputPath, templateContent);

      this.logger.log({
        file: outputPath,
        msg: 'Environment example file generated successfully',
        sections: configSections.length,
        size: templateContent.length,
      });
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          msg: 'Failed to generate environment example file',
        },
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Builds the output file path for the environment example file.
   *
   * @param appName Application name from configuration.
   * @returns Complete file path for the example file.
   * @example -
   */
  private buildOutputPath(appName: string): string {
    const fileName = `${appName}${EnvExampleProvider.fileExtension}`;

    return `${rootPath}/${EnvExampleProvider.examplesDir}/${fileName}`;
  }

  /**
   * Builds the complete template content with header and sections.
   *
   * @param sections Array of formatted configuration sections.
   * @returns Complete template content.
   * @example -
   */
  private buildTemplate(sections: string[]): string {
    const sectionsContent = sections.join('\n\n');

    return `${EnvExampleProvider.templateHeader}\n\n${sectionsContent}`;
  }

  /**
   * Determines the appropriate value for an environment variable.
   *
   * @param options Environment variable options.
   * @returns The determined value.
   * @example -
   */
  private determineVariableValue(options: IEnvFieldMetadata['options']): string {
    if (options.example !== undefined) return String(options.example);

    if (options.default !== undefined) return String(options.default);

    return '';
  }

  /**
   * Ensures the target directory exists, creating it if necessary.
   *
   * @param filePath Target file path.
   * @throws {Error} When directory creation fails.
   * @example -
   */
  private async ensureDirectoryExists(filePath: string): Promise<void> {
    const targetDirectory = dirname(filePath);

    if (existsSync(targetDirectory)) return;

    mkdirSync(targetDirectory, { recursive: true });

    this.logger.debug({ directory: targetDirectory, msg: 'Created output directory' });
  }

  /**
   * Extracts and processes all configuration sections with Env metadata.
   *
   * @description
   * This method:
   * 1. Accesses the internal configuration registry from ConfigService
   * 2. Iterates through all registered configuration symbols
   * 3. Extracts Env metadata from each configuration class
   * 4. Builds formatted sections with environment variables.
   *
   * @returns Array of formatted configuration sections.
   * @example -
   */
  private extractConfigurationSections(): string[] {
    const internalConfigs = this.getInternalConfigurations();
    const configSymbols = Object.getOwnPropertySymbols(internalConfigs);

    return configSymbols
      .map((symbolKey) => this.processConfigurationSymbol(symbolKey, internalConfigs))
      .filter((section): section is string => Boolean(section));
  }

  /**
   * Extracts Env decorated fields from a configuration instance.
   *
   * @param configInstance Configuration class instance.
   * @returns Array of environment field metadata.
   * @example -
   */
  private extractEnvFields(configInstance: Record<string, unknown>): IEnvFieldMetadata[] {
    return Reflect.getMetadata(ENV_METADATA_KEY, configInstance) ?? [];
  }

  /**
   * Formats a configuration section with title and variables.
   *
   * @param title Configuration section title.
   * @param variables Array of formatted environment variables.
   * @returns Formatted configuration section.
   * @example -
   */
  private formatConfigurationSection(title: string, variables: string[]): string {
    const sectionHeader = `# -- ${title}`;
    const sectionContent = variables.join('\n');

    return `${sectionHeader}\n${sectionContent}`;
  }

  /**
   * Formats a single environment variable line.
   *
   * @param key Environment variable key.
   * @param value Environment variable value.
   * @returns Formatted environment variable line.
   * @example -
   */
  private formatEnvironmentVariable(key: string, value: string): string {
    return `${key}="${value}"`;
  }

  /**
   * Formats environment variables with their values.
   *
   * @description
   * Priority order for values:
   * 1. Example value (if provided)
   * 2. Default value (if provided)
   * 3. Empty value.
   *
   * @param envFields Array of environment field metadata.
   * @returns Array of formatted environment variable lines.
   * @example -
   */
  private formatEnvironmentVariables(envFields: IEnvFieldMetadata[]): string[] {
    return envFields.map(({ key, options }) => {
      const value = this.determineVariableValue(options);

      return this.formatEnvironmentVariable(key, value);
    });
  }

  /**
   * Generates SHA256 hash for content change detection.
   *
   * @param content Content to hash.
   * @returns SHA256 hash string.
   * @example -
   */
  private generateContentHash(content: string): string {
    return createHash(EnvExampleProvider.hashAlgorithm)
      .update(content, EnvExampleProvider.fileEncoding)
      .digest('hex');
  }

  /**
   * Retrieves the application configuration.
   *
   * @returns The application configuration object.
   * @throws {Error} When APP_CONFIG is not registered or cannot be retrieved.
   * @example -
   */
  private getAppConfiguration(): IAppConfig {
    return this.configService.getOrThrow<IAppConfig>(APP_CONFIG);
  }

  /**
   * Retrieves the internal configuration registry from ConfigService.
   *
   * @returns Internal configuration registry.
   * @example -
   */
  private getInternalConfigurations(): Record<symbol, Record<string, unknown>> {
    return this.configService['internalConfig'];
  }

  /**
   * Processes a single configuration symbol and generates its section.
   *
   * @param symbolKey The configuration symbol key.
   * @param configs All configurations.
   * @returns Formatted configuration section or undefined if invalid.
   * @example -
   */
  private processConfigurationSymbol(
    symbolKey: symbol,
    configs: Record<symbol, Record<string, unknown>>,
  ): string | undefined {
    const configTitle = symbolKey.description;
    const configInstance = configs[symbolKey];

    if (!configInstance || !configTitle) {
      this.logger.warn({
        msg: 'Skipping configuration with missing title or instance',
        symbol: symbolKey.toString(),
      });
      return undefined;
    }

    const envFields = this.extractEnvFields(configInstance);

    if (envFields.length === 0) {
      return undefined;
    }

    const sectionVariables = this.formatEnvironmentVariables(envFields);

    return this.formatConfigurationSection(configTitle, sectionVariables);
  }

  /**
   * Reads and hashes existing file content for comparison.
   *
   * @param filePath Path to the existing file.
   * @returns Content hash or null if a file doesn't exist or can't be read.
   * @example -
   */
  private readExistingFileHash(filePath: string): null | string {
    try {
      if (!existsSync(filePath)) {
        return null;
      }

      const existingContent = readFileSync(filePath, EnvExampleProvider.fileEncoding);

      return this.generateContentHash(existingContent);
      // eslint-disable-next-line unused-imports/no-unused-vars,sonarjs/no-ignored-exceptions
    } catch (error) {
      return null;
    }
  }

  /**
   * Determines if environment examples should be generated based on the current environment.
   *
   * @param currentEnv The current application environment.
   * @returns True if examples should be generated, false otherwise.
   * @example -
   */
  private shouldGenerateExamples(currentEnv: Environment): boolean {
    return currentEnv === Environment.Local;
  }

  /**
   * Determines if the file should be updated based on content hash comparison.
   *
   * @param filePath Target file path.
   * @param newContent New content to compare.
   * @returns True if a file should be updated, false if content is unchanged.
   * @example -
   */
  private async shouldUpdateFile(filePath: string, newContent: string): Promise<boolean> {
    // If the main file doesn't exist, we should create it
    if (!existsSync(filePath)) {
      return true;
    }

    const newContentHash = this.generateContentHash(newContent);
    const existingContentHash = this.readExistingFileHash(filePath);

    return newContentHash !== existingContentHash;
  }

  /**
   * Writes the environment example file to the filesystem.
   *
   * @description
   * This method:
   * 1. Ensures the target directory exists
   * 2. Writes the content to the specified file path
   * 3. Logs the operation results.
   *
   * @param filePath Target file path.
   * @param content File content to write.
   * @throws {Error} When directory creation or file writing fails.
   * @example -
   */
  private async writeExampleFile(filePath: string, content: string): Promise<void> {
    await this.ensureDirectoryExists(filePath);
    await this.writeFileContent(filePath, content);
  }

  /**
   * Writes content to the specified file path.
   *
   * @param filePath Target file path.
   * @param content Content to write.
   * @throws {Error} When file writing fails.
   * @example -
   */
  private async writeFileContent(filePath: string, content: string): Promise<void> {
    writeFileSync(filePath, content, EnvExampleProvider.fileEncoding);
  }
}
