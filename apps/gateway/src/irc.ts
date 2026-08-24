// Minimal IRC client for the SIGNOFF gateway. One instance == one connection to
// one IRC network for one user. Line-based RFC1459-ish protocol over TLS.
import tls from "node:tls";
import net from "node:net";
import { EventEmitter } from "node:events";

export interface IrcMessage {
  network: string;
  target: string; // channel (#foo) or, for a PM, the sender's nick
  from: string;
  message: string;
  isPM: boolean;
}
export interface IrcNames {
  network: string;
  channel: string;
  users: string[];
}

export interface IrcClientEvents {
  registered: () => void;
  message: (m: IrcMessage) => void;
  names: (n: IrcNames) => void;
  system: (s: { network: string; text: string }) => void;
  error: (err: Error) => void;
  close: () => void;
}

export declare interface IrcClient {
  on<K extends keyof IrcClientEvents>(e: K, l: IrcClientEvents[K]): this;
  emit<K extends keyof IrcClientEvents>(e: K, ...a: Parameters<IrcClientEvents[K]>): boolean;
}

interface ParsedLine {
  prefix?: string;
  command: string;
  params: string[];
}

function parseLine(line: string): ParsedLine {
  let rest = line;
  let prefix: string | undefined;
  if (rest.startsWith(":")) {
    const sp = rest.indexOf(" ");
    prefix = rest.slice(1, sp);
    rest = rest.slice(sp + 1);
  }
  const params: string[] = [];
  while (rest.length) {
    if (rest.startsWith(":")) {
      params.push(rest.slice(1));
      break;
    }
    const sp = rest.indexOf(" ");
    if (sp === -1) {
      params.push(rest);
      break;
    }
    params.push(rest.slice(0, sp));
    rest = rest.slice(sp + 1);
  }
  const command = params.shift() ?? "";
  return { prefix, command, params };
}

const nickOf = (prefix?: string) => (prefix ? prefix.split("!")[0] : "");

export class IrcClient extends EventEmitter {
  readonly network: string;
  private host: string;
  private port: number;
  private useTLS: boolean;
  nick: string;
  private wantedNick: string; // the nick the user asked for (pre-433 fallback)
  private sock?: tls.TLSSocket | net.Socket;
  private buf = "";
  private registered = false;
  private saslPassword?: string;
  private capReqSent = false;
  private channels = new Map<string, Set<string>>(); // channel -> nicks
  private namesAccum = new Map<string, string[]>();
  // Channel LIST browsing (RPL_LIST 322 → RPL_LISTEND 323).
  private listAccum: { channel: string; users: number; topic: string }[] = [];
  private pendingList?: { resolve: (v: { channel: string; users: number; topic: string }[]) => void; timer: NodeJS.Timeout };

  constructor(network: string, host: string, port: number, useTLS: boolean, nick: string) {
    super();
    this.network = network;
    this.host = host;
    this.port = port;
    this.useTLS = useTLS;
    this.nick = nick;
    this.wantedNick = nick;
  }

  private write(line: string) {
    this.sock?.write(line + "\r\n");
  }

  connect(realname = "SIGNOFF user", saslPassword?: string): Promise<void> {
    this.saslPassword = saslPassword || undefined;
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (err?: Error) => {
        if (settled) return;
        settled = true;
        err ? reject(err) : resolve();
      };
      const to = setTimeout(() => done(new Error(`${this.network}: registration timeout`)), 20000);

      const onConnect = () => {
        // SASL requires CAP negotiation before registration completes.
        if (this.saslPassword) this.write("CAP LS 302");
        this.write(`NICK ${this.nick}`);
        this.write(`USER ${this.nick} 0 * :${realname}`);
      };
      this.sock = this.useTLS
        ? tls.connect({ host: this.host, port: this.port, servername: this.host }, onConnect)
        : net.connect({ host: this.host, port: this.port }, onConnect);

      this.sock.on("error", (e) => {
        clearTimeout(to);
        done(e as Error);
        this.emit("error", e as Error);
      });
      this.sock.on("close", () => this.emit("close"));
      this.sock.setEncoding("utf8");
      this.sock.on("data", (chunk: string) => {
        this.buf += chunk;
        let idx;
        while ((idx = this.buf.indexOf("\n")) !== -1) {
          const line = this.buf.slice(0, idx).replace(/\r$/, "");
          this.buf = this.buf.slice(idx + 1);
          if (line) this.handle(line, done, to);
        }
      });
    });
  }

  private handle(line: string, done: (e?: Error) => void, to: NodeJS.Timeout) {
    const { prefix, command, params } = parseLine(line);
    switch (command) {
      case "PING":
        this.write(`PONG :${params[0] ?? ""}`);
        return;
      // ── SASL PLAIN (only when a password was provided) ──────────────────
      case "CAP": {
        const sub = params[1];
        if (sub === "LS") {
          // CAP LS 302 caps can carry values (`sasl=PLAIN,EXTERNAL`) and can be
          // split across lines: `CAP * LS * :...` means more follow. Strip the
          // `=value` and detect a cap *named* sasl in whichever field holds caps.
          const more = params[2] === "*"; // continuation marker
          const capStr = more ? params[3] ?? "" : params[2] ?? "";
          const caps = capStr.split(" ").map((c) => c.split("=")[0]);
          if (this.saslPassword && !this.capReqSent && caps.includes("sasl")) {
            this.capReqSent = true;
            this.write("CAP REQ :sasl");
          } else if (!more && !this.capReqSent) {
            // LS finished and sasl isn't available → end negotiation so
            // registration can complete instead of hanging to timeout.
            this.write("CAP END");
          }
        } else if (sub === "ACK") {
          this.write("AUTHENTICATE PLAIN");
        } else if (sub === "NAK") {
          this.write("CAP END");
        }
        return;
      }
      case "AUTHENTICATE": {
        if (params[0] === "+" && this.saslPassword) {
          // authcid must be the account name (the nick the user asked for), NOT
          // this.nick — a 433 may already have suffixed it to `nick_`, which is
          // not a real account and would make SASL fail.
          const cred = Buffer.from(`\0${this.wantedNick}\0${this.saslPassword}`).toString("base64");
          this.write(`AUTHENTICATE ${cred}`);
        }
        return;
      }
      case "903": // RPL_SASLSUCCESS
        this.write("CAP END");
        return;
      case "902": // nick locked
      case "904": // SASL failed
      case "905": // message too long
      case "906": // aborted
      case "908": // mechanisms
        this.emit("system", { network: this.network, text: `SASL auth failed: ${params.slice(1).join(" ")}` });
        this.write("CAP END");
        return;
      case "001": // RPL_WELCOME
        this.registered = true;
        clearTimeout(to);
        done();
        this.emit("registered");
        // If 433 forced us onto a suffixed nick, try to reclaim the real one.
        // GHOST kills a lingering session (usually our own ghost from a gateway
        // restart); RELEASE frees a NickServ-enforced hold. Both no-op harmlessly
        // if not applicable. Then take the nick back.
        if (this.nick !== this.wantedNick && this.saslPassword) {
          this.write(`PRIVMSG NickServ :GHOST ${this.wantedNick} ${this.saslPassword}`);
          this.write(`PRIVMSG NickServ :RELEASE ${this.wantedNick} ${this.saslPassword}`);
          // GHOST can take a moment to free the nick; try the reclaim twice.
          setTimeout(() => { if (this.nick !== this.wantedNick) this.write(`NICK ${this.wantedNick}`); }, 2500);
          setTimeout(() => { if (this.nick !== this.wantedNick) this.write(`NICK ${this.wantedNick}`); }, 5000);
        }
        return;
      case "NICK": {
        // Track our own nick changes (e.g. a successful reclaim above).
        if (nickOf(prefix) === this.nick) {
          this.nick = params[0] ?? this.nick;
          this.emit("system", { network: this.network, text: `you are now known as ${this.nick}` });
        }
        return;
      }
      case "433": {
        // nick in use → append underscore and retry (only before registration)
        if (!this.registered) {
          this.nick = this.nick + "_";
          this.write(`NICK ${this.nick}`);
        }
        return;
      }
      case "PRIVMSG": {
        const target = params[0] ?? "";
        const text = params[1] ?? "";
        const from = nickOf(prefix);
        const isPM = !target.startsWith("#") && !target.startsWith("&");
        this.emit("message", { network: this.network, target: isPM ? from : target, from, message: text, isPM });
        return;
      }
      case "353": {
        // RPL_NAMREPLY: params = [nick, '=', #chan, "n1 n2 n3"]
        const channel = params[2] ?? "";
        const names = (params[3] ?? "").split(" ").filter(Boolean).map((n) => n.replace(/^[@+%~&]/, ""));
        const acc = this.namesAccum.get(channel) ?? [];
        acc.push(...names);
        this.namesAccum.set(channel, acc);
        return;
      }
      case "366": {
        // RPL_ENDOFNAMES
        const channel = params[1] ?? "";
        const users = this.namesAccum.get(channel) ?? [];
        this.namesAccum.delete(channel);
        this.channels.set(channel, new Set(users));
        this.emit("names", { network: this.network, channel, users });
        return;
      }
      case "JOIN": {
        const channel = (params[0] ?? "").replace(/^:/, "");
        const who = nickOf(prefix);
        if (who === this.nick) {
          // Our own join confirmed — register the channel immediately.
          if (!this.channels.has(channel)) this.channels.set(channel, new Set([this.nick]));
          this.emit("system", { network: this.network, text: `you joined ${channel}` });
        } else if (who) {
          const set = this.channels.get(channel) ?? new Set();
          set.add(who);
          this.channels.set(channel, set);
          this.emit("names", { network: this.network, channel, users: Array.from(set) });
        }
        return;
      }
      // Common join/registration errors → surface them so the user knows why.
      case "471": // full
      case "473": // invite only
      case "474": // banned
      case "475": // bad key
      case "477": // registration required (nick/account)
      case "479": // illegal channel name
      case "403": // no such channel
      case "465": // banned from server
      case "464": {
        // password mismatch
        this.emit("system", { network: this.network, text: params.slice(1).join(" ") || command });
        return;
      }
      case "PART":
      case "QUIT": {
        const who = nickOf(prefix);
        for (const [chan, set] of this.channels) {
          if (set.delete(who)) this.emit("names", { network: this.network, channel: chan, users: Array.from(set) });
        }
        return;
      }
      case "322": {
        // RPL_LIST: <nick> <channel> <# users> :<topic>
        if (this.listAccum.length < 5000) {
          this.listAccum.push({ channel: params[1] ?? "", users: parseInt(params[2] ?? "0", 10) || 0, topic: params[3] ?? "" });
        }
        return;
      }
      case "323": {
        // RPL_LISTEND
        if (this.pendingList) {
          clearTimeout(this.pendingList.timer);
          this.pendingList.resolve(this.listAccum.slice());
          this.pendingList = undefined;
        }
        return;
      }
      case "NOTICE": {
        this.emit("system", { network: this.network, text: params[1] ?? "" });
        return;
      }
      default:
        return;
    }
  }

  join(channel: string) {
    this.write(`JOIN ${channel}`);
  }
  part(channel: string) {
    this.write(`PART ${channel}`);
    this.channels.delete(channel);
  }
  say(target: string, message: string) {
    this.write(`PRIVMSG ${target} :${message}`);
  }
  /** Send a raw IRC line (used for slash-commands: /nick, /topic, /whois, …). */
  raw(line: string) {
    this.write(line);
  }
  getChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  /** Run LIST (optionally filtered) and return channels sorted by popularity. */
  list(filter?: string): Promise<{ channel: string; users: number; topic: string }[]> {
    return new Promise((resolve) => {
      this.listAccum = [];
      const finish = () => resolve(this.listAccum.slice().sort((a, b) => b.users - a.users).slice(0, 500));
      const timer = setTimeout(() => {
        this.pendingList = undefined;
        finish();
      }, 10000);
      this.pendingList = { resolve: () => finish(), timer };
      this.write(filter ? `LIST ${filter}` : "LIST");
    });
  }
  isRegistered() {
    return this.registered;
  }
  close() {
    try {
      this.write("QUIT :SIGNOFF");
      this.sock?.end();
    } catch {
      /* ignore */
    }
  }
}
