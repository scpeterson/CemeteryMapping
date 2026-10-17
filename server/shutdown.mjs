// Stop accepting requests, drain their work, then release the database. Sharing
// one promise makes repeated signals and explicit shutdown calls safe.
export function createGracefulShutdown(server, pool, { timeoutMs = 10_000 } = {}) {
  let shutdownPromise;
  let poolEndPromise;
  const endPool = () => poolEndPromise ??= Promise.resolve().then(() => pool.end());
  return function shutdown() {
    if (shutdownPromise) return shutdownPromise;
    let timer;
    const drained = new Promise((resolve, reject) => {
      server.close((error) => error && error.code !== "ERR_SERVER_NOT_RUNNING" ? reject(error) : resolve());
    }).then(endPool);
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        server.closeAllConnections();
        void endPool().catch(() => {});
        reject(new Error(`Server shutdown exceeded ${timeoutMs}ms`));
      }, timeoutMs);
    });
    shutdownPromise = Promise.race([drained, deadline]).finally(() => clearTimeout(timer));
    return shutdownPromise;
  };
}
