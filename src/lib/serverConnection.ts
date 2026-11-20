export function connectServer(
  onMessage: (event: string, data: any) => void,
  onConnection: (connected: boolean) => void,
) {
  let disposed = false;
  let socket: WebSocket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  const connect = () => {
    if (disposed) return;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}/ws`);
    socket = ws;
    ws.onopen = () => { attempts = 0; onConnection(true); };
    ws.onmessage = (message) => {
      if (disposed) return;
      try {
        const { event, data } = JSON.parse(message.data);
        onMessage(event, data);
      } catch (error) { console.error('Vapor WebSocket:', error); }
    };
    ws.onerror = () => ws.close();
    ws.onclose = () => {
      if (disposed) return;
      onConnection(false);
      timer = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 15000));
    };
  };
  connect();
  return () => {
    disposed = true;
    clearTimeout(timer);
    if (socket) {
      socket.onclose = null;
      socket.onopen = null;
      socket.onmessage = null;
      socket.close();
    }
  };
}
