'use strict';

class HomeyJsonStore {

  constructor({ homey, settingsKey }) {
    this.homey = homey;
    this.settingsKey = settingsKey;
  }

  _readAll() {
    return this.homey.settings.get(this.settingsKey) || {};
  }

  _writeAll(value) {
    this.homey.settings.set(this.settingsKey, value);
  }

  async set(key, value) {
    const current = this._readAll();
    current[key] = value;
    this._writeAll(current);
  }

  async get(key) {
    const current = this._readAll();
    return current[key];
  }

  async del(key) {
    const current = this._readAll();
    delete current[key];
    this._writeAll(current);
  }

}

module.exports = HomeyJsonStore;
