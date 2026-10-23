// Thin wrapper over the bridge from preload.cjs: turns { ok, data | error } into return values / thrown errors.
async function unwrap(promise) {
  const res = await promise;
  if (!res.ok) {
    const err = new Error(res.error.message);
    err.code = res.error.code;
    throw err;
  }
  return res.data;
}

export const api = {
  chooseFolder: () => unwrap(window.deskflow.chooseFolder()),
  review: () => unwrap(window.deskflow.review()),
  openFolder: () => unwrap(window.deskflow.openFolder()),
  apply: (planId) => unwrap(window.deskflow.apply(planId)),
  cancel: () => unwrap(window.deskflow.cancel()),
  history: () => unwrap(window.deskflow.history()),
  undo: (opId) => unwrap(window.deskflow.undo(opId)),
  onProgress: (callback) => window.deskflow.onProgress(callback),
};