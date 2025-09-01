/***
 * FIXME: Scheduler's use of SharedArrayBuffer will require cross-origin isolation
 * https://github.com/facebook/react/issues/20829#issuecomment-802088260
 **/
if (!self.crossOriginIsolated) SharedArrayBuffer = ArrayBuffer;
