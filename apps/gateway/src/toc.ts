// Reusable TOC2 client for the SIGNOFF gateway. Ported from the verified smoke
// test (infra/oscar/toc-smoketest.mjs); protocol contract read from
// open-oscar-server (server/toc/*.go, wire/frames.go). One instance == one live
// OSCAR session for one user.
//
//   FLAP frame : 0x2A | type(u8) | seq(u16 BE) | len(u16 BE) | payload
//   signon     : "FLAPON\r\n\r\n" → server signon → client signon (u32 ver=1 +
//                TLV 0x0001 screenname) → toc2_login data frame
//   roast      : "0x" + hex(pw[i] XOR "Tic/Toc"[i%7])  (verified password→0x2408105c23001130)
//   inbound    : SIGN_ON / CONFIG2 / NICK / UPDATE_BUDDY / IM_IN[2|_ENC2] / ERROR
import net from "node:net";
import { EventEmitter } from "node:events";

const ROAST_STR = Buffer.from("Tic/Toc", "ascii");
const FLAP_SIGNON = 0x01;
const FLAP_DATA = 0x02;
const FLAP_KEEPALIVE = 0x05;

export function roast(pw: string): string {
  const pb = Buffer.from(pw, "ascii");
  let hex = "";
  for (let i = 0; i < pb.length; i++) hex += (pb[i] ^ ROAST_STR[i % ROAST_STR.length]).toString(16).padStart(2, "0");
  return "0x" + hex;
}

export interface IncomingIM {
  from: string;
  message: string;
  auto: boolean;
}
export interface BuddyUpdate {
  name: string;
  online: boolean;
  warnLevel: number;
  idleMinutes: number;
  userClass: string;
}

export interface TocClientEvents {
  online: () => void;
  im: (im: IncomingIM) => void;
  buddy: (b: BuddyUpdate) => void;
  error: (err: Error) => void;
  close: () => void;
}

export declare interface TocClient {
  on<K extends keyof TocClientEvents>(e: K, l: TocClientEvents[K]): this;
  once<K extends keyof TocClientEvents>(e: K, l: TocClientEvents[K]): this;
  emit<K extends keyof TocClientEvents>(e: K, ...a: Parameters<TocClientEvents[K]>): boolean;
}

export class TocClient extends EventEmitter {
  readonly screenname: string;
  private password: string;
  private host: string;
  private port: number;
  private seq = 1;
  private buf = Buffer.alloc(0);
  private sentSignon = false;
  private sock?: net.Socket;
  private keepAliveTimer?: NodeJS.Timeout;
  private connected = false;
  // Server-side roster/presence, accumulated from UPDATE_BUDDY events.
  private roster = new Map<string, BuddyUpdate>();

  constructor(screenname: string, password: string, host: string, port: number) {
    super();
    this.screenname = screenname;
    this.password = password;
    this.host = host;
    this.port = port;
  }

  private send(type: number, payload: Buffer): void {
    if (!this.sock) return;
    const head = Buffer.alloc(6);
    head[0] = 0x2a;
    head[1] = type;
    head.writeUInt16BE(this.seq & 0xffff, 2);
    head.writeUInt16BE(payload.length, 4);
    this.seq++;
    this.sock.write(Buffer.concat([head, payload]));
  }

  private sendData(str: string): void {
    this.send(FLAP_DATA, Buffer.from(str, "ascii"));
  }

  private sendClientSignon(): void {
    const sn = Buffer.from(this.screenname, "ascii");
    const tlv = Buffer.alloc(4 + sn.length);
    tlv.writeUInt16BE(0x0001, 0);
    tlv.writeUInt16BE(sn.length, 2);
    sn.copy(tlv, 4);
    this.send(FLAP_SIGNON, Buffer.concat([Buffer.from([0, 0, 0, 1]), tlv]));
  }

  /** Connect + sign on. Resolves on SIGN_ON, rejects on ERROR/timeout. */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (err?: Error) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve();
      };
      const to = setTimeout(() => done(new Error(`${this.screenname}: signon timeout`)), 15000);

      this.sock = net.connect(this.port, this.host, () => this.sock!.write("FLAPON\r\n\r\n"));
      this.sock.on("error", (e) => {
        clearTimeout(to);
        done(e);
        this.emit("error", e);
      });
      this.sock.on("close", () => {
        this.connected = false;
        if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
        this.emit("close");
      });
      this.sock.on("data", (chunk) => {
        this.buf = Buffer.concat([this.buf, chunk]);
        while (this.buf.length >= 6) {
          if (this.buf[0] !== 0x2a) {
            this.buf = this.buf.subarray(1);
            continue;
          }
          const len = this.buf.readUInt16BE(4);
          if (this.buf.length < 6 + len) break;
          const type = this.buf[1];
          const payload = this.buf.subarray(6, 6 + len);
          this.buf = this.buf.subarray(6 + len);
          if (type === FLAP_SIGNON && !this.sentSignon) {
            this.sentSignon = true;
            this.sendClientSignon();
            this.sendData(`toc2_login ${this.host} ${this.port} ${this.screenname} ${roast(this.password)} english TIC:TOC2`);
          } else if (type === FLAP_DATA) {
            this.onCmd(payload.toString("ascii").replace(/\0+$/, "").trim(), done, to);
          }
        }
      });
    });
  }

  private onCmd(cmd: string, done: (err?: Error) => void, to: NodeJS.Timeout): void {
    const kind = cmd.split(":", 1)[0];
    switch (kind) {
      case "SIGN_ON": {
        this.sendData("toc_init_done");
        this.connected = true;
        clearTimeout(to);
        this.keepAliveTimer = setInterval(() => this.send(FLAP_KEEPALIVE, Buffer.alloc(0)), 60000);
        done();
        this.emit("online");
        break;
      }
      case "ERROR": {
        const err = new Error(`server ${cmd}`);
        clearTimeout(to);
        done(err);
        this.emit("error", err);
        break;
      }
      case "IM_IN":
      case "IM_IN2":
      case "IM_IN_ENC2": {
        const p = cmd.split(":");
        const from = p[1];
        const auto = (p[2] || "F").toUpperCase() === "T";
        const idx = kind === "IM_IN_ENC2" ? 9 : kind === "IM_IN2" ? 4 : 3;
        this.emit("im", { from, message: p.slice(idx).join(":"), auto });
        break;
      }
      case "UPDATE_BUDDY":
      case "UPDATE_BUDDY2": {
        // UPDATE_BUDDY:<name>:<online T/F>:<evil>:<signon>:<idle>:<uc>
        const p = cmd.split(":");
        const update: BuddyUpdate = {
          name: p[1],
          online: (p[2] || "F").toUpperCase() === "T",
          warnLevel: parseInt(p[3] || "0", 10) || 0,
          idleMinutes: parseInt(p[5] || "0", 10) || 0,
          userClass: (p[6] || "").trim(),
        };
        this.roster.set(update.name.toLowerCase(), update);
        this.emit("buddy", update);
        break;
      }
      case "CONFIG":
      case "CONFIG2": {
        // Saved buddy list sent at signon. Format: lines "g:<group>" / "b:<name>[:alias…]".
        // Seed the roster (offline until an UPDATE_BUDDY reports presence).
        for (const line of cmd.split("\n")) {
          if (line.startsWith("b:")) {
            const name = line.slice(2).split(":")[0].trim();
            const key = name.toLowerCase();
            if (name && !this.roster.has(key)) {
              this.roster.set(key, { name, online: false, warnLevel: 0, idleMinutes: 0, userClass: "" });
            }
          }
        }
        break;
      }
      default:
        break; // SIGN_ON banner, NICK, etc. — ignore
    }
  }

  sendIM(dest: string, message: string, auto = false): void {
    // message is a single CSV field → quote it; server applies unescape().
    const safe = message.replace(/"/g, '\\"');
    this.sendData(`toc2_send_im ${dest} "${safe}"${auto ? " auto" : ""}`);
  }

  addBuddies(names: string[]): void {
    // Seed the roster so a just-added (possibly offline) buddy appears right away;
    // OSCAR only emits UPDATE_BUDDY for presence changes / online buddies.
    for (const n of names) {
      const key = n.toLowerCase();
      if (!this.roster.has(key)) this.roster.set(key, { name: n, online: false, warnLevel: 0, idleMinutes: 0, userClass: "" });
    }
    if (names.length) this.sendData(`toc_add_buddy ${names.join(" ")}`);
  }

  setAway(message: string): void {
    // Empty message clears the away state.
    this.sendData(message ? `toc_set_away "${message.replace(/"/g, '\\"')}"` : "toc_set_away");
  }

  isConnected(): boolean {
    return this.connected;
  }

  getRoster(): BuddyUpdate[] {
    return Array.from(this.roster.values());
  }

  close(): void {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    try {
      this.sock?.end();
    } catch {
      /* ignore */
    }
  }
}
