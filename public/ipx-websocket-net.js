(function () {
  function dispatchStatus(detail) {
    window.dispatchEvent(new CustomEvent("doscloud-ipx-status", { detail }));
  }

  window.createIpxWebSocketNet = function createIpxWebSocketNet(multiplayer, launchId) {
    return new Promise((resolve, reject) => {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const url = protocol + "//" + location.host + "/ws/ipx?token=" + encodeURIComponent(launchId);
      let ws = null, reconnectTimer = null, reconnectAttempts = 0, stopped = false;
      let hostAnnounced = false;
      const retryDelay = () => Math.round(Math.min(16000,600*Math.pow(2,Math.min(reconnectAttempts++,5)))*(0.8+Math.random()*0.4));

      const inbox = [];
      let inboxHead = 0;
      let maxQueueDepth = 0;
      let sentPackets = 0;
      let receivedPackets = 0;
      const connected = new Set();
      const hostWaiters = [];
      const roomReadyWaiters = [];
      let roomReady = false;
      let peerId = 0;
      let hostPeerId = Number(multiplayer.hostPeerId || 1);
      let hostOnline = multiplayer.role === "host";
      let hostReady = multiplayer.role === "host";
      let localServerReady = false;
      let settled = false;

      function resolveHostWaiters() {
        if (!hostOnline || !hostReady || !hostPeerId) return;
        while (hostWaiters.length) {
          hostWaiters.shift()([{ alias: "host", peerId: hostPeerId }]);
        }
      }

      function markRoomReady(detail = {}) {
        if (roomReady) return;
        roomReady = true;
        while (roomReadyWaiters.length) roomReadyWaiters.shift()();
        dispatchStatus({
          state: "room-ready",
          roomCode: multiplayer.code,
          expectedPlayers: multiplayer.expectedPlayers,
          ...detail,
        });
      }

      const net = {
        get peerId() { return peerId; },
        connected,
        get roomReady() { return roomReady; },
        get localServerReady() { return localServerReady; },
        stats() {
          return {
            sentPackets, receivedPackets,
            queuedPackets: inbox.length - inboxHead, peakQueuedPackets: maxQueueDepth,
            websocketBufferedBytes: ws?.bufferedAmount || 0,
          };
        },
        announceHostReady() {
          if (multiplayer.role !== "host") return false;
          hostAnnounced = true;
          if (ws?.readyState !== WebSocket.OPEN) return false;
          if (!localServerReady) {
            ws.send(JSON.stringify({ type: "ipx-server-ready" }));
            localServerReady = true;
          }
          return true;
        },
        waitForRoomReady() {
          if (roomReady) return Promise.resolve();
          return new Promise(resolveReady => roomReadyWaiters.push(resolveReady));
        },
        wait() {},
        registerAlias() { return Promise.resolve(); },
        unregisterAlias() {},
        queryAliases(query) {
          if (query !== "=host") return Promise.resolve([]);
          if (hostOnline && hostReady && hostPeerId) {
            return Promise.resolve([{ alias: "host", peerId: hostPeerId }]);
          }
          return new Promise(resolveAlias => hostWaiters.push(resolveAlias));
        },
        sendBinary(data, targetPeerId) {
          if (ws?.readyState !== WebSocket.OPEN) return 0;
          if (!targetPeerId || targetPeerId === peerId) return 0;
          if (ws.bufferedAmount > 2 * 1024 * 1024) {
            dispatchStatus({ state: "overloaded", bufferedBytes: ws.bufferedAmount });
            ws.close(1013, "IPX send backlog exceeded");
            return 0;
          }
          const payload = data instanceof Uint8Array ? data : new Uint8Array(data);
          const frame = new Uint8Array(payload.length + 4);
          new DataView(frame.buffer).setUint32(0, Number(targetPeerId), false);
          frame.set(payload, 4);
          ws.send(frame);
          sentPackets++;
          connected.add(Number(targetPeerId));
          return payload.length || 1;
        },
        recvBinary() {
          if (inboxHead >= inbox.length) return null;
          const packet = inbox[inboxHead++];
          // O(1) reads rather than Array.shift() on every IPX packet.
          if (inboxHead === inbox.length) {
            inbox.length = 0;
            inboxHead = 0;
          } else if (inboxHead >= 256 && inboxHead * 2 >= inbox.length) {
            inbox.splice(0, inboxHead);
            inboxHead = 0;
          }
          return packet;
        },
        disconnect(targetPeerId) {
          connected.delete(Number(targetPeerId));
        },
        shutdown() {
          stopped = true;
          clearTimeout(reconnectTimer);
          clearTimeout(timeout);
          if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING))
            ws.close(1000, "DOS runtime closed");
        },
      };

      function connectSocket() {
        if (stopped) return;
        clearTimeout(reconnectTimer);
        let next;
        try { next = new WebSocket(url); }
        catch (error) {
          reconnectTimer = setTimeout(connectSocket,retryDelay());
          return;
        }
        ws = next;
        ws.binaryType = "arraybuffer";
        ws.addEventListener("open", () => {
          if (ws !== next || stopped) return;
          reconnectAttempts = 0;
          dispatchStatus({state:"transport-open",roomCode:multiplayer.code});
        });
      ws.addEventListener("message", event => {
        if (ws !== next || stopped) return;
        if (typeof event.data === "string") {
          let message;
          try { message = JSON.parse(event.data); } catch { return; }
          if (message.type === "welcome") {
            peerId = Number(message.peerId);
            hostPeerId = Number(message.hostPeerId || 1);
            hostOnline = Boolean(message.hostOnline) || message.role === "host";
            hostReady = Boolean(message.hostReady) || message.role === "host";
            for (const peer of message.peers || []) {
              if (Number(peer.peerId) !== peerId) connected.add(Number(peer.peerId));
              if (peer.role === "host") hostOnline = true;
            }
            resolveHostWaiters();
            if (hostAnnounced && multiplayer.role === "host" && !localServerReady) {
              localServerReady = true;
              ws.send(JSON.stringify({type:"ipx-server-ready"}));
            }
            if (message.roomReady) markRoomReady({ connectedPlayers: (message.peers || []).length });
            dispatchStatus({ state: "connected", peerId, roomCode: message.roomCode, role: message.role });
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              resolve(net);
            }
          } else if (message.type === "peer-joined") {
            const id = Number(message.peerId);
            if (id && id !== peerId) connected.add(id);
            if (message.role === "host") {
              hostPeerId = id;
              hostOnline = true;
              hostReady = false;
              resolveHostWaiters();
            }
            dispatchStatus({ state: "peer-joined", peerId: id, role: message.role });
          } else if (message.type === "host-ready") {
            hostPeerId = Number(message.hostPeerId || hostPeerId);
            hostOnline = true;
            hostReady = true;
            resolveHostWaiters();
            dispatchStatus({ state: "host-ready", hostPeerId });
          } else if (message.type === "room-ready") {
            markRoomReady({
              connectedPlayers: Number(message.connectedPlayers || multiplayer.expectedPlayers),
            });
          } else if (message.type === "peer-left") {
            const id = Number(message.peerId);
            connected.delete(id);
            if (message.role === "host" || id === hostPeerId) {
              hostOnline = false;
              hostReady = false;
            }
            dispatchStatus({ state: "peer-left", peerId: id, role: message.role });
          }
          return;
        }

        // Never let an early guest registration enter the host emulator before
        // DOSBox-X has established its own IPX server and loopback client.
        if (multiplayer.role === "host" && !localServerReady) return;
        const frame = new Uint8Array(event.data);
        if (frame.length < 5) return;
        const sourcePeerId = new DataView(frame.buffer, frame.byteOffset, frame.byteLength).getUint32(0, false);
        // js-dos' network bridge expects a standalone, zero-offset packet
        // buffer. A subarray retaining the four-byte relay header can be
        // misinterpreted by its WASM boundary, so copy only at this boundary.
        connected.add(sourcePeerId);
        inbox.push({ data: frame.slice(4), peerId: sourcePeerId });
        receivedPackets++;
        maxQueueDepth = Math.max(maxQueueDepth, inbox.length - inboxHead);
      });

      ws.addEventListener("close", event => {
        if (ws !== next || stopped) return;
        inbox.length = 0;
        inboxHead = 0;
        connected.clear();
        hostOnline = false;
        hostReady = false;
        localServerReady = false;
        roomReady = false;
        dispatchStatus({ state: "reconnecting", code: event.code, reason: event.reason || "" });
        ws = null;
        reconnectTimer = setTimeout(connectSocket,retryDelay());
      });

      ws.addEventListener("error", () => {
        if (ws !== next || stopped) return;
        dispatchStatus({ state: "error" });
        try { ws.close(); } catch {}
      });
      }
      window.addEventListener("online",()=>{
        if (!stopped && ws?.readyState !== WebSocket.OPEN) {
          clearTimeout(reconnectTimer);
          reconnectTimer=setTimeout(connectSocket,0);
        }
      });
      window.addEventListener("pagehide",()=>net.shutdown(),{once:true});
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        stopped = true;
        clearTimeout(reconnectTimer);
        try { ws?.close(); } catch {}
        reject(new Error("Timed out connecting to the multiplayer IPX relay"));
      }, 60000);
      connectSocket();
    });
  };
})();