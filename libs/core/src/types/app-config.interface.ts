import { tags } from 'typia';

import { constants } from '../constants/index';
import { Environment } from '../enums';

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
}
