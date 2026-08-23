// Native (arm64 Node, no deps) TOC2 smoke test for the live open-oscar-server.
// Proves login + send/receive against oscar.signoff.chat:9898, and seeds the
// gateway's TOC code (Phase 3). Protocol contract read directly from the server
// source (server/toc/*.go, wire/frames.go):
//   FLAP frame  : 0x2A | type(u8) | seq(u16 BE) | len(u16 BE) | payload
//   signon      : FLAPON\r\n\r\n → server signon frame → client signon frame
//                 (u32 FLAPVersion=1 + TLV 0x0001 screenname) → toc2_login data frame
//   login cmd   : toc2_login <host> <port> <screenname> <roasted_pw> english TIC:TOC2
//   roast       : "0x" + hex(pw[i] XOR "Tic/Toc"[i%7])   (verified: password→0x2408105c23001130)
//   send IM     : toc2_send_im <user> "<message>"        (CSV/space args, quoted message)
//   incoming    : IM_IN2:<from>:<auto T/F>:<whisper T/F>:<message>
import net from "node:net";
import { EventEmitter } from "node:events";

const HOST = process.env.OSCAR_HOST || "oscar.signoff.chat";
const PORT = Number(process.env.OSCAR_TOC_PORT || 9898);
const ROAST_STR = Buffer.from("Tic/Toc", "ascii");

const FLAP_SIGNON = 0x01;
const FLAP_DATA = 0x02;

function roast(pw) {
  const pb = Buffer.from(pw, "ascii");
  let hex = "";
  for (let i = 0; i < pb.length; i++) hex += (pb[i] ^ ROAST_STR[i % ROAST_STR.length]).toString(16).padStart(2, "0");
  return "0x" + hex;
}

class TocClient extends EventEmitter {
  constructor(screenname, password) {
    super();
    this.sn = screenname;
    this.pw = password;
    this.seq = 1;
    this.buf = Buffer.alloc(0);
    this.sentSignon = false;
  }

  #flap(type, payload) {
    const head = Buffer.alloc(6);
    head[0] = 0x2a;
    head[1] = type;
    head.writeUInt16BE(this.seq & 0xffff, 2);
    head.writeUInt16BE(payload.length, 4);
    this.seq++;
    this.sock.write(Buffer.concat([head, payload]));
  }

  #sendData(str) {
    this.#flap(FLAP_DATA, Buffer.from(str, "ascii"));
  }

  #sendClientSignon() {
    const sn = Buffer.from(this.sn, "ascii");
    const tlv = Buffer.alloc(4 + sn.length);
    tlv.writeUInt16BE(0x0001, 0); // LoginTLVTagsScreenName
    tlv.writeUInt16BE(sn.length, 2);
    sn.copy(tlv, 4);
    this.#flap(FLAP_SIGNON, Buffer.concat([Buffer.from([0, 0, 0, 1]), tlv]));
  }

  connect() {
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error(`${this.sn}: signon timeout`)), 12000);
      this.sock = net.connect(PORT, HOST, () => this.sock.write("FLAPON\r\n\r\n"));
      this.sock.on("error", (e) => { clearTimeout(to); reject(e); });
      this.sock.on("data", (chunk) => {
        this.buf = Buffer.concat([this.buf, chunk]);
        while (this.buf.length >= 6) {
          if (this.buf[0] !== 0x2a) { this.buf = this.buf.subarray(1); continue; }
          const len = this.buf.readUInt16BE(4);
          if (this.buf.length < 6 + len) break;
          const type = this.buf[1];
          const payload = this.buf.subarray(6, 6 + len);
          this.buf = this.buf.subarray(6 + len);
          if (type === FLAP_SIGNON && !this.sentSignon) {
            // Server's signon frame arrived → send ours + the login command.
            this.sentSignon = true;
            this.#sendClientSignon();
            this.#sendData(`toc2_login ${HOST} ${PORT} ${this.sn} ${roast(this.pw)} english TIC:TOC2`);
          } else if (type === FLAP_DATA) {
            const cmd = payload.toString("ascii").replace(/\0+$/, "").trim();
            this.#onCmd(cmd, resolve, reject, to);
          }
        }
      });
    });
  }

  #onCmd(cmd, resolve, reject, to) {
    const kind = cmd.split(":", 1)[0];
    if (kind === "SIGN_ON") {
      this.#sendData("toc_init_done");
      clearTimeout(to);
      resolve(cmd);
    } else if (kind === "ERROR") {
      clearTimeout(to);
      reject(new Error(`${this.sn}: server ${cmd}`));
    } else if (kind === "IM_IN2" || kind === "IM_IN" || kind === "IM_IN_ENC2") {
      const p = cmd.split(":");
      const from = p[1];
      // IM_IN:<from>:<auto>:<msg>  IM_IN2:<from>:<auto>:<whisper>:<msg>
      // IM_IN_ENC2:<from>:<auto>:F:T:<class>:F:L:<lang>:<msg>
      const idx = kind === "IM_IN_ENC2" ? 9 : kind === "IM_IN2" ? 4 : 3;
      const message = p.slice(idx).join(":");
      this.emit("im", { from, message });
    }
    this.emit("cmd", cmd);
  }

  sendIM(dest, message) {
    this.#sendData(`toc2_send_im ${dest} "${message}"`);
  }

  close() { try { this.sock.end(); } catch {} }
}

const ok = (m) => console.log(`\x1b[32m✓\x1b[0m ${m}`);
const info = (m) => console.log(`  ${m}`);

async function main() {
  const SEND_SN = process.env.SEND_SN || "craig";
  const RECV_SN = process.env.RECV_SN || "signofftest";
  const SEND_PW = process.env.SEND_PW || process.env.CRAIG_PW;
  const RECV_PW = process.env.RECV_PW || process.env.TEST_PW;
  if (!SEND_PW || !RECV_PW) throw new Error("set SEND_PW and RECV_PW env vars");

  info(`connecting to ${HOST}:${PORT} …`);
  const recv = new TocClient(RECV_SN, RECV_PW);
  const send = new TocClient(SEND_SN, SEND_PW);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  if (process.env.TOC_DEBUG) {
    recv.on("cmd", (c) => console.log(`\x1b[36m[signofftest]\x1b[0m ${c.slice(0, 160)}`));
    send.on("cmd", (c) => console.log(`\x1b[35m[craig]\x1b[0m ${c.slice(0, 160)}`));
  }

  await recv.connect();
  ok("signofftest signed on (auth accepted)");
  await send.connect();
  ok("craig signed on (auth accepted)");

  const gotIM = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("no IM received within 8s")), 8000);
    recv.once("im", (im) => { clearTimeout(t); resolve(im); });
  });

  // Let both sessions finish init_done / feedbag load before routing the IM.
  await sleep(1500);
  const text = "hello from the TOC smoke test";
  info(`${SEND_SN} → ${RECV_SN}: "${text}"`);
  send.sendIM(RECV_SN, text);

  const im = await gotIM;
  if (im.from.toLowerCase().replace(/\s/g, "") !== SEND_SN.toLowerCase().replace(/\s/g, "")) throw new Error(`unexpected sender: ${im.from}`);
  if (!im.message.includes("hello from the TOC smoke test")) throw new Error(`unexpected message: "${im.message}"`);
  ok(`signofftest received from ${im.from}: "${im.message}"`);

  send.close();
  recv.close();
  console.log("\n\x1b[32mSMOKE TEST PASSED\x1b[0m — login + send/receive work against the live OSCAR server.");
  process.exit(0);
}

main().catch((e) => { console.error(`\x1b[31m✗ FAILED:\x1b[0m ${e.message}`); process.exit(1); });
