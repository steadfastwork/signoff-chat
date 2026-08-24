// Popular IRC networks (TLS ports) + a few suggested channels for discovery.
// Shared by the desktop /irc page and the mobile shell.
export interface IrcNetworkPreset {
  id: string;
  label: string;
  host: string;
  port: number;
  tls: boolean;
  suggested: string[];
}

export const IRC_NETWORKS: IrcNetworkPreset[] = [
  { id: "libera", label: "Libera.Chat", host: "irc.libera.chat", port: 6697, tls: true, suggested: ["#libera", "#python", "#linux", "#archlinux", "#programming"] },
  { id: "oftc", label: "OFTC", host: "irc.oftc.net", port: 6697, tls: true, suggested: ["#oftc", "#debian", "#tor"] },
  { id: "esper", label: "EsperNet", host: "irc.esper.net", port: 6697, tls: true, suggested: ["#esper", "#minecraft"] },
  { id: "rizon", label: "Rizon", host: "irc.rizon.net", port: 6697, tls: true, suggested: ["#rizon", "#news"] },
  { id: "undernet", label: "Undernet", host: "irc.undernet.org", port: 6697, tls: true, suggested: ["#help", "#coder-com"] },
];

export const findNetwork = (id: string) => IRC_NETWORKS.find((n) => n.id === id) ?? IRC_NETWORKS[0];
