/**
 * Main-thread SharedArrayBuffer registry.
 * Worklets get the SAB via processorOptions at construct (structured clone shares memory).
 */
const Sab = {
  isolated() {
    return !!(
      typeof crossOriginIsolated !== "undefined" &&
      crossOriginIsolated &&
      typeof SharedArrayBuffer === "function"
    );
  },

  createBlock() {
    if (!this.isolated()) {
      throw new Error("SharedArrayBuffer unavailable — serve with npm start (COOP/COEP)");
    }
    let sab = new SharedArrayBuffer(AppConfig.SAB_BYTES);
    return AppConfig.wrapSab(sab);
  },

  createBulk(byteLength) {
    if (!this.isolated()) {
      throw new Error("SharedArrayBuffer unavailable — serve with npm start (COOP/COEP)");
    }
    byteLength = byteLength | 0;
    let sab = new SharedArrayBuffer(AppConfig.SAB_BULK_HDR + byteLength * 2);
    return AppConfig.wrapBulk(sab, byteLength);
  },

  inject(opts, extra) {
    extra = extra || {};
    let block = extra.block || this.createBlock();
    let bulk = extra.bulk || null;
    opts = opts ? Object.assign({}, opts) : {};
    let po = Object.assign({}, opts.processorOptions || {});
    po.sab = block.sab;
    if (bulk) {
      po.bulk = bulk.sab;
      po.bulkBytes = bulk.byteLength;
    }
    opts.processorOptions = po;
    opts._sabBlock = block;
    opts._sabBulk = bulk;
    return opts;
  },
};

(function sabSelfCheck() {
  if (typeof SharedArrayBuffer !== "function") return;
  if (typeof crossOriginIsolated !== "undefined" && !crossOriginIsolated) return;
  try {
    let b = Sab.createBlock();
    b.setSlot(0, 1.25);
    if (Math.abs(b.getSlot(0) - 1.25) > 1e-6) {
      console.error("Sab slot self-check failed");
    }
    b.setNote(7);
    if (b.getNote() !== 7) console.error("Sab note self-check failed");
    let packed = AppConfig.packEvent(1, 60, 100, 0);
    if (!b.pushEvent(packed) || b.pullEvent() !== packed) {
      console.error("Sab event self-check failed");
    }
  } catch (e) {
    console.error("Sab self-check failed", e);
  }
})();
