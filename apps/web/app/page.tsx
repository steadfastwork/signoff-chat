// SIGNOFF.CHAT marketing landing (public "/"). Logged-out visitors see this;
// middleware sends authenticated users straight to /messenger. Retro AIM look,
// reframed product (AIM/ICQ + IRC, no encryption claims). Server component.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SIGNOFF.CHAT — Online Messenger",
  description:
    "A best-of-breed vintage instant messenger. Sign on to AIM/ICQ and real IRC networks with a buddy list, away messages, chat rooms and that classic Online Messenger feel.",
};

const CSS = `
  .lp{--desk:#3f4778;--paper:#f6f4ee;--paperhi:#fdfcf9;--line:#e2dfd6;--edge:#8f8c82;--ink:#26262b;--inksoft:#4a4a52;--inkmute:#9a978e;--blue:#3a44b5;--blue2:#4356c0;--gold:#f2cf5b;--golddim:#c9a030;--green:#3c9468;--amber:#8a6420;
    position:relative;min-height:100vh;color:var(--ink);font-family:Tahoma,Verdana,'Segoe UI',sans-serif;
    background:var(--desk);background-image:radial-gradient(rgba(205,215,255,0.09) 1px,transparent 1px);background-size:9px 9px;-webkit-font-smoothing:antialiased}
  .lp a{color:var(--blue);text-decoration:none}
  .lp code{font-family:var(--font-ibm-plex-mono),monospace;font-size:.92em;background:#eceadf;padding:1px 4px;border-radius:3px}
  .lp .wrap{max-width:1000px;margin:0 auto;padding:0 20px}
  .lp .win{background:var(--paper);border:1px solid var(--edge);border-radius:4px;box-shadow:0 16px 40px rgba(10,15,40,.35)}
  .lp .titlebar{display:flex;align-items:center;gap:9px;background:var(--paperhi);border-bottom:1px solid var(--line);border-radius:4px 4px 0 0;padding:9px 13px;font-weight:bold;font-size:14px}
  .lp .badge{font-family:var(--font-vt323),monospace;font-size:16px;background:var(--blue2);color:var(--gold);padding:1px 6px;line-height:1.15;border-radius:2px}
  .lp .dots{margin-left:auto;color:var(--inkmute);letter-spacing:2px;font-size:13px}
  .lp nav{position:sticky;top:0;z-index:20;backdrop-filter:blur(4px);background:rgba(63,71,120,.82);border-bottom:1px solid rgba(255,255,255,.08)}
  .lp nav .wrap{display:flex;align-items:center;gap:16px;height:58px}
  .lp .navmark{font-family:var(--font-vt323),monospace;font-size:26px;letter-spacing:1px;color:var(--gold);text-shadow:1px 1px 0 rgba(20,25,60,.5)}
  .lp .links{margin-left:auto;display:flex;gap:22px;align-items:center}
  .lp .links a{color:#dfe4ff;font-size:14px}
  .lp .links a:hover{color:#fff}
  @media(max-width:620px){.lp .links a:not(.cta){display:none}}
  .lp .cta{background:var(--paperhi);border:1px solid var(--green);color:#2c7a52;font-weight:bold;font-size:14px;padding:9px 18px;border-radius:3px;display:inline-flex;align-items:center;gap:8px;cursor:pointer}
  .lp .cta:hover{background:#eaf5ef}
  .lp .hero{padding:70px 0 54px;text-align:center}
  .lp .plaque{display:inline-block;background:linear-gradient(160deg,#4a5cc4,#3a4699);border:1px solid #2b3370;border-radius:4px;padding:30px 40px 26px;box-shadow:0 18px 44px rgba(10,15,40,.45)}
  .lp .plaque h1{font-family:var(--font-vt323),monospace;font-size:64px;line-height:.9;letter-spacing:3px;color:var(--gold);text-shadow:3px 3px 0 rgba(20,25,60,.5)}
  .lp .plaque .psub{font-family:Georgia,serif;font-style:italic;color:#eef1ff;font-size:20px;margin-top:10px}
  .lp .sup{font-size:11px;vertical-align:super}
  @media(max-width:520px){.lp .plaque h1{font-size:44px}}
  .lp .tag{color:#e7ecff;max-width:620px;margin:26px auto 0;font-size:17px;line-height:1.6}
  .lp .herocta{margin-top:28px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
  .lp .ghost{background:transparent;border:1px solid rgba(255,255,255,.35);color:#e7ecff}
  .lp .ghost:hover{background:rgba(255,255,255,.08)}
  .lp .meta{margin-top:20px;font-family:var(--font-ibm-plex-mono),monospace;font-size:11px;color:#b9c3f5;letter-spacing:1.5px}
  .lp section{padding:34px 0}
  .lp .kicker{font-family:var(--font-ibm-plex-mono),monospace;font-size:12px;letter-spacing:2px;color:#b9c3f5;text-transform:uppercase;text-align:center;margin-bottom:6px}
  .lp .h2{color:#fff;text-align:center;font-size:26px;margin-bottom:26px}
  .lp .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}
  .lp .card .cbody{padding:16px 16px 18px}
  .lp .card h3{font-size:16px;margin-bottom:7px;color:var(--ink)}
  .lp .card p{font-size:14px;line-height:1.6;color:var(--inksoft)}
  .lp .glyph{font-family:var(--font-vt323),monospace;font-size:22px;color:var(--blue2)}
  .lp .showcase{display:grid;grid-template-columns:320px 1fr;gap:26px;align-items:center}
  @media(max-width:760px){.lp .showcase{grid-template-columns:1fr}}
  .lp .buddy{display:flex;align-items:center;gap:9px;padding:8px 12px 8px 26px;font-size:15px}
  .lp .dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
  .lp .on{background:var(--green)}.lp .aw{background:#d9a441}.lp .off{background:transparent;border:1px solid #c9c6bc}
  .lp .b-on{color:var(--blue);font-weight:bold}.lp .b-aw{color:#1a7a7a;font-weight:bold}.lp .b-off{color:#b5b2a8;font-style:italic}
  .lp .grouphdr{padding:9px 12px 4px;font-weight:bold;font-size:15px}
  .lp .cnt{color:var(--inkmute);font-weight:bold;font-size:14px;margin-left:5px}
  .lp .copy h2{color:#fff;font-size:24px;margin-bottom:10px}
  .lp .copy p{color:#dfe4ff;font-size:16px;line-height:1.7}
  .lp .pill{display:inline-block;margin:4px 6px 0 0;font-family:var(--font-ibm-plex-mono),monospace;font-size:12px;color:#e7ecff;border:1px solid rgba(255,255,255,.25);border-radius:12px;padding:4px 11px}
  .lp .plats{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
  .lp .plat{background:var(--paper);border:1px solid var(--edge);border-radius:4px;padding:14px 20px;font-weight:bold;color:var(--inksoft);display:flex;align-items:center;gap:9px;font-size:14px}
  .lp .plat .g{font-family:var(--font-vt323),monospace;font-size:20px;color:var(--blue2)}
  .lp footer{padding:40px 0 60px;text-align:center;color:#b9c3f5;font-size:13px}
  .lp .footmark{font-family:var(--font-vt323),monospace;font-size:22px;color:var(--gold)}
  .lp footer a{color:#dfe4ff;text-decoration:underline}
  .lp .fine{margin-top:10px;font-family:var(--font-ibm-plex-mono),monospace;font-size:11px;color:#8f9bd6}
`;

export default function LandingPage() {
  return (
    <div className="lp">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <nav>
        <div className="wrap">
          <span className="navmark">SIGNOFF.CHAT</span>
          <div className="links">
            <a href="#features">Features</a>
            <a href="#buddies">Buddy List</a>
            <a href="#platforms">Get it</a>
            <a className="cta" href="/login">Sign On &rarr;</a>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="wrap">
          <div className="plaque">
            <h1>SIGNOFF.CHAT</h1>
            <div className="psub">Online Messenger<span className="sup">&trade;</span></div>
          </div>
          <p className="tag">The vintage instant messenger, brought back to life. Sign on to <b>AIM / ICQ</b> and real <b>IRC</b> networks from one buddy list &mdash; with away messages, chat rooms, presence and that unmistakable late-&rsquo;90s desktop feel.</p>
          <div className="herocta">
            <a className="cta" href="/login"><span>Sign On</span></a>
            <a className="cta ghost" href="#features">See what&rsquo;s inside</a>
          </div>
          <div className="meta">TOC2 &middot; IRC (RFC 1459) &middot; WEB &middot; DESKTOP &middot; MOBILE</div>
        </div>
      </header>

      <section id="features">
        <div className="wrap">
          <div className="kicker">Everything you remember</div>
          <div className="h2">One login. Every old-school network.</div>
          <div className="grid">
            <div className="win card"><div className="titlebar"><span className="badge">S/C</span><span>AIM &amp; ICQ</span><span className="dots">&mdash; &times;</span></div><div className="cbody"><h3><span className="glyph">&#9787;</span> Your screen name is back</h3><p>Register a classic screen name and sign on to our hosted OSCAR server. Add buddies, see who&rsquo;s online, and IM in real time &mdash; exactly like it&rsquo;s 1999.</p></div></div>
            <div className="win card"><div className="titlebar"><span className="badge">S/C</span><span>IRC, built in</span><span className="dots">&mdash; &times;</span></div><div className="cbody"><h3><span className="glyph">#</span> Real networks, one client</h3><p>Connect to Libera.Chat, OFTC, EsperNet and more. NickServ login, a channel browser, and slash-commands (<code>/join</code>, <code>/me</code>, <code>/msg</code>) make it as capable as Pidgin.</p></div></div>
            <div className="win card"><div className="titlebar"><span className="badge">S/C</span><span>Away Messages</span><span className="dots">&mdash; &times;</span></div><div className="cbody"><h3><span className="glyph">&#9790;</span> &ldquo;brb &mdash; back around %t&rdquo;</h3><p>Set an auto-response with the classic <code>%n</code>, <code>%d</code>, <code>%t</code> tokens, save your favorites, and let buddies know you&rsquo;re gone without saying a word.</p></div></div>
            <div className="win card"><div className="titlebar"><span className="badge">S/C</span><span>Chat Rooms</span><span className="dots">&mdash; &times;</span></div><div className="cbody"><h3><span className="glyph">&#9673;</span> Public rooms &amp; hangouts</h3><p>Duck into a room, see who&rsquo;s here, and pick up the thread. The lobby&rsquo;s always open.</p></div></div>
            <div className="win card"><div className="titlebar"><span className="badge">S/C</span><span>Buddy List</span><span className="dots">&mdash; &times;</span></div><div className="cbody"><h3><span className="glyph">&#9787;</span> Groups, stars &amp; status</h3><p>Organize buddies into groups, star your favorites, and flip between Online / Away / Invisible. Green dots, door chimes, the works.</p></div></div>
            <div className="win card"><div className="titlebar"><span className="badge">S/C</span><span>The Feel</span><span className="dots">&mdash; &times;</span></div><div className="cbody"><h3><span className="glyph">&#9834;</span> Sounds &amp; skins</h3><p>Door-open on sign-on, a slam on sign-off, message blips, VT323 type and cream windows. Pixel-honest, not a filter.</p></div></div>
          </div>
        </div>
      </section>

      <section id="buddies">
        <div className="wrap">
          <div className="showcase">
            <div className="win">
              <div className="titlebar"><span className="badge">S/C</span><span>craig&rsquo;s Buddy List</span><span className="dots">&mdash; &times;</span></div>
              <div style={{ padding: "6px 0 10px" }}>
                <div className="grouphdr">&#9662; Buddies <span className="cnt">(2/4)</span></div>
                <div className="buddy"><span className="dot on" /><span className="b-on">glowstickgrrl</span> <span style={{ color: "var(--golddim)" }}>&#9733;</span></div>
                <div className="buddy"><span className="dot aw" /><span className="b-aw">dialtone88</span> <span style={{ marginLeft: "auto", fontSize: 11, fontStyle: "italic", color: "var(--amber)" }}>away</span></div>
                <div className="buddy"><span className="dot off" /><span className="b-off">pixelpusher86</span></div>
                <div className="buddy"><span className="dot off" /><span className="b-off">moonl4nding</span></div>
                <div className="grouphdr">&#9662; Co-Workers <span className="cnt">(0/1)</span></div>
                <div className="buddy"><span className="dot off" /><span className="b-off">v1rusdotexe</span></div>
                <div style={{ padding: "10px 12px", fontFamily: "var(--font-ibm-plex-mono),monospace", fontSize: 13, color: "#a5a29a" }}>+ new group</div>
              </div>
            </div>
            <div className="copy">
              <h2>The buddy list, faithfully.</h2>
              <p>Presence dots, away tags, favorite stars and real groups synced from your list. Tap a name to start an IM; someone new says hi and you get the classic <i>Accept Message</i> prompt.</p>
              <div style={{ marginTop: 14 }}>
                <span className="pill">presence</span><span className="pill">away tags</span><span className="pill">groups</span><span className="pill">favorites</span><span className="pill">accept-message</span><span className="pill">door sounds</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platforms">
        <div className="wrap">
          <div className="kicker">Sign on anywhere</div>
          <div className="h2">Web today. Desktop &amp; mobile too.</div>
          <div className="plats">
            <div className="plat"><span className="g">&#9969;</span> Web &mdash; signoff.chat</div>
            <div className="plat"><span className="g">&#9635;</span> Desktop (Mac / Windows)</div>
            <div className="plat"><span className="g">&#9636;</span> iOS &amp; Android</div>
          </div>
          <p style={{ textAlign: "center", color: "#b9c3f5", fontSize: 13, marginTop: 16, fontFamily: "var(--font-ibm-plex-mono),monospace" }}>Same screen name, everywhere you sign on.</p>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="footmark">SIGNOFF.CHAT</div>
          <p style={{ marginTop: 8 }}><a href="/login">Sign On</a> &middot; <a href="#features">Features</a> &middot; <a href="#buddies">Buddy List</a></p>
          <div className="fine">Online Messenger&trade; &middot; AIM/ICQ over TOC2 + IRC &middot; &copy; SIGNOFF.CHAT</div>
        </div>
      </footer>
    </div>
  );
}
