import { tags } from 'typia';
import { Environment } from '../enums';
import { Pattern } from 'typia/lib/tags/Pattern';
import { Default } from 'typia/lib/tags/Default';

export interface IAppConfig {
  readonly env: Environment;

  readonly host: string & tags.Default<'127.0.0.1'>;

  readonly name: string & Pattern<'^[a-z][a-z0-9]*(-[a-z0-9]+)*$'>;

  readonly port: number & tags.Type<'uint32'>;

  readonly generateEnvExample: boolean & Default<true>;
}
