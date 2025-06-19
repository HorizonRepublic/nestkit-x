import { constants, Environment } from '@nestkit-x/core';
import { tags } from 'typia';

export interface IAppConfig {
  readonly env: Environment;

  readonly host: string & tags.Default<typeof constants.network.host>;

  readonly name: string &
    tags.MaxLength<20> &
    tags.MinLength<3> &
    tags.Pattern<typeof constants.patterns.kebabPattern>;

  readonly port: number &
    tags.Default<typeof constants.network.ports.nest> &
    tags.Maximum<typeof constants.network.ports.maximal> &
    tags.Minimum<typeof constants.network.ports.minimal> &
    tags.Type<'uint32'>;

  readonly version: string &
    tags.Default<'0.0.1'> &
    tags.Pattern<typeof constants.patterns.semverPattern>;
}
