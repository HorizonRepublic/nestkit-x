import { constants } from '@nestkit-x/core/constants';
import { Env } from '@nestkit-x/core/enums';
import { numbers } from '@nestkit-x/core/types';
import { tags } from 'typia';

export interface IAppConfig {
  env: Env;
  host: string & tags.Default<typeof constants.network.host>;
  name: string & tags.Pattern<typeof constants.patterns.kebabPattern>;
  port: numbers.Port & tags.Default<typeof constants.network.ports.nest>;
  version: string & tags.Default<'0.0.1'> & tags.Pattern<typeof constants.patterns.semverPattern>;
}
