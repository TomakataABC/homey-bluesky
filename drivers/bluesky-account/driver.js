'use strict';

const Homey = require('homey');

module.exports = class BlueskyAccountDriver extends Homey.Driver {

  async onInit() {
    this.log('Bluesky account driver initialized');
  }

  _getBlueskyService() {
    return this.homey.app.bluesky;
  }

  _registerSessionHandlers(session) {
    let pairDevice = null;

    session.setHandler('login', async ({ username, password }) => {
      const account = await this._getBlueskyService().login({
        identifier: username,
        password,
      });

      pairDevice = {
        name: account.name,
        data: {
          id: account.did,
        },
        store: {
          handle: account.handle,
          did: account.did,
          service: account.service,
          serviceEndpoint: account.serviceEndpoint || '',
        },
      };

      return pairDevice;
    });

    session.setHandler('list_devices', async () => {
      return pairDevice ? [pairDevice] : [];
    });
  }

  async onPair(session) {
    this._registerSessionHandlers(session);
  }

};
