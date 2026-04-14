'use strict';

const Homey = require('homey');

module.exports = class BlueskyAccountDevice extends Homey.Device {

  async onInit() {
    this.log(`Bluesky account device initialized: ${this.getName()}`);
  }

  _getBlueskyService() {
    return this.homey.app.bluesky;
  }

  async createPost(text) {
    return this._getBlueskyService().createPost({
      did: this.getData().id,
      text,
    });
  }

  async onDeleted() {
    await this._getBlueskyService().deleteSession(this.getData().id);
  }

};
