/* ─── src/hooks/useLocks.js ─────────────────────────────────────────── */
// Nota: useState, useEffect e useRef são declarados em app.js (escopo global)
// Não redeclarar aqui para evitar SyntaxError "already been declared"

function useLocks(user) {
  const [locks, setLocks] = React.useState({});
  const myLockRef = React.useRef(null);

  const setLock = async (num) => {
    if (!user || !num) return;
    const lockKey = `lock_${num}`;
    const lockData = { user: user.nome || user.login, ts: Date.now() };
    myLockRef.current = num;
    await ST.set(lockKey, lockData);
  };

  const releaseLock = async (num) => {
    const n = num || myLockRef.current;
    if (!n) return;
    await ST.del(`lock_${n}`);
    myLockRef.current = null;
  };

  // Limpeza de locks expirados (> 5 min)
  const cleanOldLocks = async () => {
    const allLocks = await ST.list("lock_");
    const now = Date.now();
    for (const l of allLocks) {
      if (now - l.value.ts > 5 * 60 * 1000) {
        await ST.del(l.key);
      }
    }
  };

  React.useEffect(() => {
    if (!_sbReady) return;
    
    const fetchLocks = async () => {
      const currentLocks = await ST.list("lock_");
      const map = {};
      currentLocks.forEach(l => { map[l.key.replace('lock_', '')] = l.value; });
      setLocks(map);
    };

    fetchLocks();
    const interval = setInterval(fetchLocks, 10000);

    // Realtime para locks
    const channel = _sb.channel('locks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cgel_store', filter: 'chave=ilike.lock_%' }, fetchLocks)
      .subscribe();

    return () => {
      clearInterval(interval);
      _sb.removeChannel(channel);
    };
  }, []);

  return { locks, setLock, releaseLock };
}
