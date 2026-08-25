// IRC text formatting: the mIRC control codes real IRC clients use, so messages
// with color/bold/italic/underline render (incoming) and can be sent (outgoing).
//   \x03 NN[,BB]  color (fg[,bg])   \x02 bold   \x1D italic   \x1F underline
//   \x0F reset
// The 16 standard mIRC colors (0-15), as hex. White/light map poorly onto our
// cream paper, but we keep the standard so we interop with other clients.
export const MIRC_COLORS: string[] = [
  "#ffffff", "#000000", "#00007f", "#009300", "#ff0000", "#7f0000", "#9c009c", "#fc7f00",
  "#d9d000", "#009300", "#009393", "#00a7a7", "#0000fc", "#c000c0", "#7f7f7f", "#a0a0a0",
];

// Curated, readable-on-cream palette for the color picker → mIRC index.
export const IRC_PALETTE: { hex: string; code: number; label: string }[] = [
  { hex: "#26262b", code: 1, label: "ink" },
  { hex: "#0000fc", code: 12, label: "blue" },
  { hex: "#009300", code: 3, label: "green" },
  { hex: "#ff0000", code: 4, label: "red" },
  { hex: "#9c009c", code: 6, label: "purple" },
  { hex: "#fc7f00", code: 7, label: "orange" },
  { hex: "#009393", code: 10, label: "teal" },
  { hex: "#c000c0", code: 13, label: "magenta" },
];

/** Wrap a plain message in a mIRC color code (reset at the end). */
export function withMircColor(message: string, code: number | null): string {
  if (code == null) return message;
  const nn = String(code).padStart(2, "0");
  return `\x03${nn}${message}\x0f`;
}

export interface IrcSegment {
  text: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/** Parse a string with mIRC control codes into styled segments. */
export function parseIrcSegments(input: string): IrcSegment[] {
  const segs: IrcSegment[] = [];
  let cur: Omit<IrcSegment, "text"> = {};
  let buf = "";
  const flush = () => {
    if (buf) segs.push({ text: buf, ...cur });
    buf = "";
  };
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const code = input.charCodeAt(i);
    if (code === 0x03) {
      // color: optional 1-2 fg digits, optional ,bg digits
      flush();
      let j = i + 1;
      let fg = "";
      while (j < input.length && /\d/.test(input[j]) && fg.length < 2) fg += input[j++];
      if (input[j] === "," && /\d/.test(input[j + 1] ?? "")) {
        j++; // skip comma
        let bg = "";
        while (j < input.length && /\d/.test(input[j]) && bg.length < 2) bg += input[j++];
      }
      cur = { ...cur, color: fg === "" ? undefined : MIRC_COLORS[parseInt(fg, 10) % 16] };
      i = j - 1;
    } else if (code === 0x02) {
      flush();
      cur = { ...cur, bold: !cur.bold };
    } else if (code === 0x1d) {
      flush();
      cur = { ...cur, italic: !cur.italic };
    } else if (code === 0x1f) {
      flush();
      cur = { ...cur, underline: !cur.underline };
    } else if (code === 0x0f) {
      flush();
      cur = {};
    } else {
      buf += ch;
    }
  }
  flush();
  return segs.length ? segs : [{ text: input }];
}
