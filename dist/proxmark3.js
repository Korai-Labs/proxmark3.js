(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('lodash')) :
  typeof define === 'function' && define.amd ? define(['exports', 'lodash'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Proxmark3 = {}, global._));
})(this, (function (exports, _) { 'use strict';

  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  var ___default = /*#__PURE__*/_interopDefaultLegacy(_);

  class BufferLE extends Uint8Array {
    constructor (...args) {
      super(...args);
      this.dv = new DataView(this.buffer, this.byteOffset, this.byteLength);
    }

    static fromView (view) {
      if (!ArrayBuffer.isView(view)) throw new TypeError('invalid view')
      return new BufferLE(view.buffer, view.byteOffset, view.byteLength)
    }

    static fromHex (hex) {
      return new BufferLE(___default["default"].map(hex.match(/.{2}/g), b => ___default["default"].parseInt(b, 16)))
    }

    static fromUtf8 (utf8) {
      return BufferLE.fromView(new TextEncoder().encode(utf8))
    }

    static merge (...bufs) {
      if (bufs.length < 2) return bufs.length ? bufs[0] : new BufferLE()
      const len = ___default["default"].sumBy(bufs, 'byteLength');
      const merged = new BufferLE(len);
      ___default["default"].reduce(bufs, (offset, buf) => {
        merged.set(buf, offset);
        return offset + buf.byteLength
      }, 0);
      return merged
    }

    // 共通屬性
    get hex () { return ___default["default"].map(this, b => `0${b.toString(16)}`.slice(-2)).join('') }
    get utf8 () { return new TextDecoder().decode(this) }

    // DataView getter
    dvGetter (key, byteOffset, littleEndian = true) {
      if (byteOffset < 0) byteOffset += this.dv.byteLength;
      return this.dv[key](byteOffset, littleEndian)
    }

    getBigInt64 (...args) { return this.dvGetter('getBigInt64', ...args) }
    getBigUint64 (...args) { return this.dvGetter('getBigUint64', ...args) }
    getFloat32 (...args) { return this.dvGetter('getFloat32', ...args) }
    getFloat64 (...args) { return this.dvGetter('getFloat64', ...args) }
    getInt16 (...args) { return this.dvGetter('getInt16', ...args) }
    getInt32 (...args) { return this.dvGetter('getInt32', ...args) }
    getInt8 (...args) { return this.dvGetter('getInt8', ...args) }
    getUint16 (...args) { return this.dvGetter('getUint16', ...args) }
    getUint32 (...args) { return this.dvGetter('getUint32', ...args) }
    getUint8 (...args) { return this.dvGetter('getUint8', ...args) }

    // DataView setter
    dvSetter (key, byteOffset, value, littleEndian = true) {
      if (byteOffset < 0) byteOffset += this.dv.byteLength;
      return this.dv[key](byteOffset, value, littleEndian)
    }

    setBigInt64 (...args) { return this.dvSetter('setBigInt64', ...args) }
    setBigUint64 (...args) { return this.dvSetter('setBigUint64', ...args) }
    setFloat32 (...args) { return this.dvSetter('setFloat32', ...args) }
    setFloat64 (...args) { return this.dvSetter('setFloat64', ...args) }
    setInt16 (...args) { return this.dvSetter('setInt16', ...args) }
    setInt32 (...args) { return this.dvSetter('setInt32', ...args) }
    setInt8 (...args) { return this.dvSetter('setInt8', ...args) }
    setUint16 (...args) { return this.dvSetter('setUint16', ...args) }
    setUint32 (...args) { return this.dvSetter('setUint32', ...args) }
    setUint8 (...args) { return this.dvSetter('setUint8', ...args) }
  }

  const logTime = (...args) => console.log(`[${new Date().toTimeString().slice(0, 8)}]`, ...args);

  const sleep = t => new Promise(resolve => setTimeout(resolve, t));

  const uintToPadHex = (num, len) => {
    return ___default["default"].padStart(num.toString(16), len, '0')
  };

  class PacketResponseNG {
    // https://github.com/RfidResearchGroup/proxmark3/blob/master/doc/new_frame_format.md
    // magic 4 + length 2 + status 2 + cmd 2 + data max 512 + crc 2
    constructor (buf) {
      if (!buf || !(buf instanceof BufferLE)) throw new TypeError('invalid buf')
      this.buf = buf;
      this.data = buf.subarray(10 + (this.ng ? 0 : 24), buf.byteLength - 2);
    }

    get len () { return this.buf.byteLength }
    get ng () { return (this.buf.getUint8(5) & 0x80) > 0 }
    get status () { return this.buf.getInt16(6) }
    get cmd () { return this.buf.getUint16(8) }
    get crc () { return this.buf.getUint16(this.buf.byteLength - 2) }
    getArg (index) { return this.buf.getBigUint64(10 + (index << 3)) }
  }

  class PacketResponseOLD {
    constructor (buf) {
      if (!buf || !(buf instanceof BufferLE)) throw new TypeError('invalid buf')
      this.buf = buf;
      this.data = buf.subarray(32);
    }

    get cmd () { return Number(BigInt.asUintN(16, this.buf.getBigUint64(0))) }
    getArg (index) { return this.buf.getBigUint64(8 + (index << 3)) }
  }

  class WebSerial { // Web Serial
    constructor (filters) {
      this.filters = filters;
      this.port = null;
      this.reader = null;
    }

    static isSupported () {
      return 'serial' in navigator
    }

    async requestPort () {
      if (!WebSerial.isSupported()) throw new Error('不支援 WebSerial')
      this.port = await navigator.serial.requestPort({ filters: this.filters });
      await this.port.open({ baudRate: 9600 });
    }

    async ensurePortOpen () {
      if (this.port) return
      await this.requestPort(this.filters);
    }

    async read () {
      await this.ensurePortOpen();
      if (!this.reader) {
        for (let i = 0; i < 100; i++) { // wait 1s for this.port.readable
          if (this.port.readable) break
          if (i === 99) throw new Error('SerialPort is not readable')
          await sleep(10);
        }
        this.reader = this.port.readable.getReader();
      }
      if (!this.reader) throw new Error('Failed to getReader')
      const { value, done } = await this.reader.read();
      if (done) {
        this.reader.releaseLock();
        this.reader = null;
      }
      // - console.log('serial.read', value)
      return BufferLE.fromView(value)
    }

    async write (data) {
      if (!(data instanceof BufferLE)) throw new TypeError('data should be BufferLE')
      logTime(`write ${data.byteLength} bytes`, data);
      await this.ensurePortOpen();
      for (let i = 0; i < 100; i++) { // wait 1s for this.port.writable
        if (this.port.writable) break
        if (i === 99) throw new Error('SerialPort is not writable')
        await sleep(10);
      }
      const writer = this.port.writable.getWriter();
      if (!writer) throw new Error('Failed to getWriter')
      await writer.write(data);
      writer.releaseLock();
    }
  }

  const CMD = {
    ACK: 0x00ff,
    HF_ISO14443A_READER: 0x0385,
    HF_MIFARE_READBL: 0x0620,
    HF_MIFARE_READSC: 0x0621,
    NACK: 0x00fe,
    UNKNOWN: 0xffff,
    WTX: 0x0116,
  };

  class Adapter {
    constructor () {
      this.serial = new WebSerial([
        // http://www.linux-usb.org/usb.ids
        // about://device-log
        { usbVendorId: 0x2d2d, usbProductId: 0x504d }, // proxmark.org: Proxmark3
        { usbVendorId: 0x9ac4, usbProductId: 0x4b8f }, // J. Westhues: ProxMark-3 RFID Instrument (old)
        { usbVendorId: 0x1d6b, usbProductId: 0x0106 }, // iCopy-X
      ]);
    }

    async sendCommandNG ({ cmd, data = null, ng = true }) {
      if (data && !(data instanceof BufferLE)) throw new TypeError('data should be BufferLE')
      const dataLen = data?.byteLength ?? 0;
      if (dataLen > 512) throw new TypeError('data.byteLength > 512')
      const buf = new BufferLE(dataLen + 10); // magic 4 + length 2 + cmd 2 + dataLen + crc 2
      buf.set(BufferLE.fromUtf8('PM3a'));
      buf.setUint16(4, dataLen + (ng ? 0x8000 : 0));
      buf.setUint16(6, Number(BigInt.asUintN(16, BigInt(cmd))));
      if (dataLen) buf.set(data, 8);
      buf.set(BufferLE.fromUtf8('a3'), dataLen + 8); // COMMANDNG_POSTAMBLE_MAGIC = a3
      await this.serial.write(buf);
    }

    async sendCommandMix ({ cmd, arg = [], data = null }) {
      if (data && !(data instanceof BufferLE)) throw new TypeError('data should be BufferLE')
      const dataLen = data?.byteLength ?? 0;
      if (dataLen > 488) throw new TypeError('data.byteLength > 488')
      const newData = new BufferLE(dataLen + 24); // mix format: 3 * arg 8
      if (dataLen) newData.set(data, 24);
      for (let i = 0; i < 3; i++) {
        arg[i] = arg[i] ?? 0n;
        if (typeof arg[i] !== 'bigint') throw new TypeError(`arg${i + 1} should be BigInt`)
        newData.setBigUint64(i << 3, arg[i]);
      }
      return await this.sendCommandNG({ cmd, data: newData, ng: false })
    }

    clearSerialReadBuffer () {
      if (!this.serialReadBuffer) this.serialReadBuffer = {};
      const ctx = this.serialReadBuffer;
      ctx.chunks = [];
      ctx.len = 0;
    }

    async readBytes (len) {
      if (!___default["default"].isSafeInteger(len) || len < 1) throw new TypeError(`invalid len = ${len}`)
      if (!this.serialReadBuffer) this.clearSerialReadBuffer();
      const ctx = this.serialReadBuffer;
      while (ctx.len < len) {
        const chunk = await this.serial.read();
        ctx.chunks.push(chunk);
        ctx.len += chunk.byteLength;
      }
      const merged = BufferLE.merge(...ctx.chunks);
      const resp = merged.slice(0, len);
      ctx.len = merged.byteLength - len;
      ctx.chunks = ctx.len > 0 ? [merged.slice(len)] : [];
      // - console.log('readBytes', resp)
      return resp
    }

    async readResp () {
      // https://github.com/RfidResearchGroup/proxmark3/blob/master/doc/new_frame_format.md
      // magic 4 + length 2 + status 2 + cmd 2 + data max 512 + crc 2
      const pre = await this.readBytes(10);
      // - console.log('pre', pre)
      const resp = pre.getUint32(0) === 0x62334d50 // PM3b
        ? new PacketResponseNG(BufferLE.merge(pre, await this.readBytes((pre.getUint16(4) & 0x7fff) + 2)))
        : new PacketResponseOLD(BufferLE.merge(pre, await this.readBytes(534)));
      logTime('readResp', resp);
      return resp
    }

    async waitRespTimeout (cmd, timeout = 25e2) {
      await this.serial.ensurePortOpen();
      timeout += 100; // communication_delay 100ms
      const ctx = { startedAt: Date.now(), finished: 0 };
      try {
        return await Promise.race([
          (async () => {
            while (!ctx.finished) {
              const resp = await this.readResp();
              if (cmd === CMD.UNKNOWN || resp.cmd === cmd) return resp
              if (resp.cmd === CMD.WTX && resp.data.byteLength === 2) {
                const wtx = resp.data.getUint16(0);
                if (wtx < 0xffff) {
                  logTime(`waiting time extend: ${timeout} + ${wtx} = ${timeout + wtx} ms`);
                  timeout += wtx;
                }
              }
            }
          })(),
          (async () => {
            if (timeout < 0) return new Promise(resolve => {}) // 不設定 timeout
            while (!ctx.finished) {
              const sleepts = ctx.startedAt + timeout - Date.now();
              if (sleepts < 0) throw new Error(`waitRespTimeout ${timeout}ms`)
              await sleep(sleepts);
            }
          })(),
        ])
      } finally {
        ctx.finished = 1;
      }
    }
  }

  var adapter = new Adapter();

  class Iso14aCardSelect {
    constructor (buf) {
      // uid 10 + uidlen 1 + atqa 2 + sak 1 + ats_len 1 + ats 256 = 271
      if (!buf || !(buf instanceof BufferLE) || buf.byteLength < 15) throw new TypeError('invalid buf')
      this.buf = buf;
      this.uid = buf.subarray(0, buf.getUint8(10));
      this.ats = buf.subarray(15, 15 + buf.getUint8(14));
    }

    get atqa () { return this.buf.getUint16(11) }
    get sak () { return this.buf.getUint8(13) }
  }

  class HF14A {
    constructor () {
      this.adapter = adapter;
    }

    async CmdDisconnect () {
      await this.adapter.sendCommandMix({ cmd: CMD.HF_ISO14443A_READER });
    }

    // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhf14a.c#L1713
    async CmdInfo (isSelect = false) {
      try {
        this.adapter.clearSerialReadBuffer();
        await this.adapter.sendCommandMix({ cmd: CMD.HF_ISO14443A_READER, arg: [0b11n] });
        const resp = await this.adapter.waitRespTimeout(CMD.ACK); // cmd = ack
        const status = Number(resp.getArg(0));
        const card = new Iso14aCardSelect(resp.data); // mix format: 3 * arg 8
        if (status === 0) { // 0: couldn't read, 1: OK, with ATS, 2: OK, no ATS, 3: proprietary Anticollision
          if (isSelect) throw new Error('failed to select iso14443a card')
          return
        } else if (status === 3) {
          throw new Error(`Card doesn't support standard iso14443-3 anticollision, ATQA: ${uintToPadHex(card.atqa, 4)}`)
        }
        const res = {
          uid: card.uid.hex,
          atqa: uintToPadHex(card.atqa, 4),
          sak: uintToPadHex(card.sak, 2),
          status,
        };
        return res
      } catch (err) {
        console.error(err);
        throw err
      } finally {
        if (this.serial?.port?.writable) await this.CmdHF14ADisconnect();
      }
    }

    // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/mifare/mifarehost.c#L807
    async CmdMfRdBl (blockNo, keyType, key) {
      if (!(key instanceof BufferLE)) throw new TypeError('key should be BufferLE')
      if (key.byteLength !== 6) throw new TypeError('invalid key')
      const data = new BufferLE(8);
      data.setUint8(0, blockNo);
      data.setUint8(1, keyType);
      data.set(key, 2);
      this.adapter.clearSerialReadBuffer();
      await this.adapter.sendCommandNG({ cmd: CMD.HF_MIFARE_READBL, data });
      const resp = await this.adapter.waitRespTimeout(CMD.HF_MIFARE_READBL);
      if (resp.status) throw new Error('Failed to read block')
      return resp.data
    }

    // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/mifare/mifarehost.c#L786
    async CmdMfRdSc (sectorNo, keyType, key) {
      if (!(key instanceof BufferLE)) throw new TypeError('key should be BufferLE')
      if (key.byteLength !== 6) throw new TypeError('invalid key')
      this.adapter.clearSerialReadBuffer();
      await this.adapter.sendCommandMix({ cmd: CMD.HF_MIFARE_READSC, arg: [BigInt(sectorNo), BigInt(keyType)], data: key });
      const resp = await this.adapter.waitRespTimeout(CMD.ACK);
      const status = Number(resp.getArg(0)) & 0xff;
      if (!status) throw new Error('Failed to read block')
      return resp.data.slice(0, 64)
    }
  }

  var version = "0.1.0";

  exports.BufferLE = BufferLE;
  exports.HF14A = HF14A;
  exports.WebSerial = WebSerial;
  exports.version = version;

  Object.defineProperty(exports, '__esModule', { value: true });

}));