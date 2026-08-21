// Fill TURN with Metered / Twilio / coturn. Empty urls = STUN only.
const RTC_TURN = {
  urls: "",
  username: "",
  credential: "",
};

const RTC_STUN_HOSTS = [
  "stun.l.google.com:19302",
  "stun1.l.google.com:19302",
  "stun2.l.google.com:19302",
  "stun3.l.google.com:19302",
  "stun4.l.google.com:19302",
  "stun.l.google.com",
  "stun.rixtelecom.se",
  "stun.schlund.de",
  "stun.stunprotocol.org:3478",
  "stun.voiparound.com",
  "stun.voipbuster.com",
  "stun.voipstunt.com",
  "stun.voxgratia.org",
  "stun.ekiga.net",
];

function stunUrlFromHost(host) {
  if (!host) return null;
  if (host.indexOf("stun:") == 0) return host;
  if (host.indexOf(":") >= 0) return "stun:" + host;
  if (host.indexOf("google.com") >= 0) return "stun:" + host + ":19302";
  return "stun:" + host + ":3478";
}

function buildIceServers() {
  let servers = [];
  let seen = {};
  for (let host of RTC_STUN_HOSTS) {
    let url = stunUrlFromHost(host);
    if (!url || seen[url]) continue;
    seen[url] = true;
    servers.push({ urls: url });
  }
  if (RTC_TURN && RTC_TURN.urls) {
    let entry = { urls: RTC_TURN.urls };
    if (RTC_TURN.username) entry.username = RTC_TURN.username;
    if (RTC_TURN.credential) entry.credential = RTC_TURN.credential;
    servers.push(entry);
  }
  return servers;
}

function peerJsConfig() {
  return {
    config: {
      iceServers: buildIceServers(),
    },
  };
}
