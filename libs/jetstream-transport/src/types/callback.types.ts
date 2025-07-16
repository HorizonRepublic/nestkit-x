import { Observable } from 'rxjs';

export type AnyCallbackResult = void | Promise<void> | Observable<void>;
export type AnyCallback = () => AnyCallbackResult;
