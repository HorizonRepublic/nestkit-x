import { tags } from 'typia';

import { constants } from '../constants/index';

export type Port = number &
  tags.Maximum<typeof constants.network.ports.maximal> &
  tags.Minimum<typeof constants.network.ports.minimal>;
