import { Runtime } from '../enum/runtime.enum';

export const getRuntime = (): Runtime => {
  // @ts-expect-error: Bun global might not be in types
  if (typeof Bun !== 'undefined') {
    return Runtime.Bun;
  }

  // @ts-expect-error: Deno global might not be in types
  if (typeof Deno !== 'undefined') {
    return Runtime.Deno;
  }

  return Runtime.Node;
};
