import { tags } from 'typia';

export type SemVer = Lowercase<string> & tags.Pattern<'^[0-9]+\\.[0-9]+\\.[0-9]+$'>;
