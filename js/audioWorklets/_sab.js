// SAB helpers live on AppConfig (loaded first). This module is a load-order marker.
if (!globalThis.AppConfig || typeof AppConfig.bindProcessorSab !== "function") {
  console.error("AppConfig.bindProcessorSab missing — load config.js before _sab.js");
}
